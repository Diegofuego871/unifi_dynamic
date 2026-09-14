"""Integration "UniFi Dynamic Clients"."""

from __future__ import annotations

import asyncio
import logging

from datetime import time as dt_time

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, Platform
from homeassistant.core import (
    Event,
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
    callback,
)
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_time_change
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_DRY_RUN,
    ATTR_ENTRY_ID,
    CONF_PURGE_TIME,
    DEFAULT_PURGE_TIME,
    DOMAIN,
    NEW_CLIENT_NAME_GRACE,
    PURGE_STARTUP_DELAY,
    SERVICE_PURGE_NOW,
)
from .coordinator import (
    PurgeResult,
    UnifiDynamicCoordinator,
    client_slug,
    preferred_client_name,
)
from .notification import async_send_new_clients_report, async_send_purge_report

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.BINARY_SENSOR, Platform.SENSOR]

# kind aus der unique_id -> Suffix in der entity_id
_KIND_SUFFIX = {
    "client_online": "online",
    "ip": "ip",
    "ssid": "ssid",
    "connection": "connection",
    "last_seen": "last_seen",
    "mac": "mac",
}


# ---------------------------------------------------------------------------
# Setup / Unload
# ---------------------------------------------------------------------------


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = UnifiDynamicCoordinator(hass, entry)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    # Cache laden, BEVOR die erste Abfrage läuft. Sonst verlieren gerade
    # offline Clients ihre zuletzt bekannten Werte und ihr _seen_at.
    _register_new_client_handler(hass, entry, coordinator)

    await coordinator.async_load_cache()
    await coordinator.async_config_entry_first_refresh()

    # Migration vor dem Plattform-Setup, damit HA direkt die neuen IDs nutzt.
    _migrate_entity_ids(hass, entry, coordinator)

    # Ebenfalls vor dem Plattform-Setup, sonst würde die Entity erst angelegt
    # und gleich wieder entfernt.
    _cleanup_wireless_only_entities(hass, entry, coordinator)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    _sync_device_names(hass, coordinator)

    @callback
    def _handle_coordinator_update() -> None:
        _sync_device_names(hass, coordinator)

    entry.async_on_unload(coordinator.async_add_listener(_handle_coordinator_update))

    # Options-Änderungen wirksam machen. Ohne diesen Listener ruft Home
    # Assistant async_reload_entry NICHT auf; scan_interval und purge_days
    # würden erst nach einem Neustart greifen.
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))

    async def _run_startup_purge(_now=None) -> None:
        # Beim Start nur melden, wenn tatsächlich etwas entfernt wurde. Sonst
        # gäbe es nach jedem Neustart eine Meldung.
        await _async_run_purge(hass, entry, report_empty=False)

    async def _run_daily_purge(_now=None) -> None:
        await _async_run_purge(hass, entry, report_empty=True)

    # Einmal verzögert nach dem Start: Plattform-Setup und Restore-States von
    # Home Assistant sind dann sicher durch.
    entry.async_on_unload(
        async_call_later(hass, PURGE_STARTUP_DELAY, _run_startup_purge)
    )

    # Danach täglich. Bewusst immer geplant; ob gepurged wird, entscheidet
    # purge_days innerhalb von async_purge_stale.
    purge_time = _purge_time(entry)
    _LOGGER.debug(
        "Täglicher Purge geplant für %s (lokale Zeit)", purge_time.strftime("%H:%M:%S")
    )
    entry.async_on_unload(
        async_track_time_change(
            hass,
            _run_daily_purge,
            hour=purge_time.hour,
            minute=purge_time.minute,
            second=purge_time.second,
        )
    )

    _async_register_services(hass)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        coordinator: UnifiDynamicCoordinator | None = hass.data.get(DOMAIN, {}).pop(
            entry.entry_id, None
        )
        if coordinator is not None:
            await coordinator.async_close()

        if not hass.data.get(DOMAIN):
            hass.services.async_remove(DOMAIN, SERVICE_PURGE_NOW)

    return unload_ok


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload nach Options-Änderung. Zieht auch eine geänderte Purge-Zeit nach."""
    await hass.config_entries.async_reload(entry.entry_id)


@callback
def _register_new_client_handler(
    hass: HomeAssistant, entry: ConfigEntry, coordinator: UnifiDynamicCoordinator
) -> None:
    """
    Hängt die Meldung über erstmals gesehene Clients an den Coordinator.

    Wird bewusst vor dem ersten Refresh registriert, damit auch Clients gemeldet
    werden, die während einer HA-Auszeit dazugekommen sind.
    """

    async def _send(clients: list[tuple[str, dict]]) -> None:
        try:
            await async_send_new_clients_report(hass, entry, clients)
        except Exception:
            _LOGGER.exception("Meldung über neue Clients fehlgeschlagen")

    async def _send_when_started(clients: list[tuple[str, dict]]) -> None:
        if hass.is_running:
            await _send(clients)
            return

        # Während des HA-Starts ist der Notify-Service oft noch nicht
        # registriert. Die Meldung wartet dann bis zum fertigen Start.
        async def _after_start(_event: Event) -> None:
            await _send(clients)

        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _after_start)

    async def _send_after_grace(clients: list[tuple[str, dict]]) -> None:
        """
        Meldung für noch namenlose Clients verzögern.

        Der Name stammt vom Controller, nicht von Home Assistant: beim ersten
        Auftauchen ist die DHCP-Lease oft noch nicht durch, der Hostname kommt
        wenige Sekunden später. In der Wartezeit pollt der Coordinator weiter,
        danach wird der Cache erneut gelesen.
        """
        await asyncio.sleep(NEW_CLIENT_NAME_GRACE)

        refreshed = [
            (mac, coordinator.client_snapshot(mac) or snapshot)
            for mac, snapshot in clients
        ]
        await _send_when_started(refreshed)

    def _is_named(mac: str, data: dict) -> bool:
        return preferred_client_name(data, mac).lower() != mac.lower()

    async def _handle(clients: list[tuple[str, dict]]) -> None:
        named = [(mac, data) for mac, data in clients if _is_named(mac, data)]
        unnamed = [(mac, data) for mac, data in clients if not _is_named(mac, data)]

        if named:
            await _send_when_started(named)

        if unnamed:
            _LOGGER.debug(
                "%s neuer Client bzw. Clients noch ohne Namen, Meldung wartet %s s",
                len(unnamed),
                NEW_CLIENT_NAME_GRACE,
            )
            entry.async_create_background_task(
                hass,
                _send_after_grace(unnamed),
                f"{DOMAIN}_new_client_grace",
                eager_start=True,
            )

    coordinator.async_set_new_client_callback(_handle)
    entry.async_on_unload(lambda: coordinator.async_set_new_client_callback(None))


def _purge_time(entry: ConfigEntry) -> dt_time:
    """Konfigurierte tägliche Purge-Zeit, mit Fallback auf den Standard."""
    raw = entry.options.get(
        CONF_PURGE_TIME, entry.data.get(CONF_PURGE_TIME, DEFAULT_PURGE_TIME)
    )

    parsed = dt_util.parse_time(str(raw)) if raw else None
    if parsed is None:
        _LOGGER.warning(
            "Ungültige Purge-Zeit '%s', verwende %s", raw, DEFAULT_PURGE_TIME
        )
        parsed = dt_util.parse_time(DEFAULT_PURGE_TIME)

    return parsed


# ---------------------------------------------------------------------------
# Purge-Ausführung und Service
# ---------------------------------------------------------------------------


async def _async_run_purge(
    hass: HomeAssistant,
    entry: ConfigEntry,
    *,
    dry_run: bool = False,
    report_empty: bool = True,
) -> PurgeResult | None:
    """Führt den Purge aus und meldet das Ergebnis. Fehler bleiben lokal."""
    coordinator: UnifiDynamicCoordinator | None = hass.data.get(DOMAIN, {}).get(
        entry.entry_id
    )
    if coordinator is None:
        return None

    try:
        result = await coordinator.async_purge_stale(dry_run=dry_run)
    except Exception:
        _LOGGER.exception("Purge fehlgeschlagen (%s)", entry.title)
        return None

    try:
        await async_send_purge_report(hass, entry, result, report_empty=report_empty)
    except Exception:
        _LOGGER.exception("Purge-Benachrichtigung fehlgeschlagen (%s)", entry.title)

    return result


def _result_to_dict(entry: ConfigEntry, result: PurgeResult) -> dict:
    return {
        "entry_id": entry.entry_id,
        "title": entry.title,
        "dry_run": result.dry_run,
        "skipped": result.skipped,
        "purge_days": result.purge_days,
        "cache_size": result.cache_size,
        "removed_clients": result.removed_clients,
        "removed_entities": result.removed_entities,
        "removed_devices": result.removed_devices,
        "orphan_devices": result.orphan_devices,
        "protected": result.protected,
        "clients": [
            {
                "mac": client.mac,
                "name": client.name,
                "age_days": round(client.age_days, 1),
                "entities": client.entities,
            }
            for client in result.clients
        ],
    }


@callback
def _async_register_services(hass: HomeAssistant) -> None:
    """Registriert unifi_dynamic.purge_now einmalig."""
    if hass.services.has_service(DOMAIN, SERVICE_PURGE_NOW):
        return

    async def _handle_purge_now(call: ServiceCall) -> ServiceResponse:
        dry_run = bool(call.data.get(ATTR_DRY_RUN, False))
        wanted = call.data.get(ATTR_ENTRY_ID)

        entry_ids = list(hass.data.get(DOMAIN, {}))
        if wanted:
            entry_ids = [eid for eid in entry_ids if eid == wanted]

        results = []
        for entry_id in entry_ids:
            entry = hass.config_entries.async_get_entry(entry_id)
            if entry is None:
                continue
            result = await _async_run_purge(
                hass, entry, dry_run=dry_run, report_empty=True
            )
            if result is not None:
                results.append(_result_to_dict(entry, result))

        return {"results": results}

    hass.services.async_register(
        DOMAIN,
        SERVICE_PURGE_NOW,
        _handle_purge_now,
        schema=vol.Schema(
            {
                vol.Optional(ATTR_DRY_RUN, default=False): cv.boolean,
                vol.Optional(ATTR_ENTRY_ID): cv.string,
            }
        ),
        supports_response=SupportsResponse.OPTIONAL,
    )


# ---------------------------------------------------------------------------
# Gerätenamen
# ---------------------------------------------------------------------------


@callback
def _sync_device_names(
    hass: HomeAssistant, coordinator: UnifiDynamicCoordinator
) -> None:
    """
    Zieht geänderte Client-Namen in die Device Registry nach.

    Geräte werden stabil über (DOMAIN, MAC) identifiziert. Manuell in HA
    gesetzte Namen (name_by_user) werden nie überschrieben.
    """
    dev_reg = dr.async_get(hass)

    for mac, data in (coordinator.data or {}).items():
        device = dev_reg.async_get_device(identifiers={(DOMAIN, mac)})
        if device is None or device.name_by_user:
            continue

        desired_name = preferred_client_name(data, mac)
        if (device.name or "") != desired_name:
            _LOGGER.debug(
                "Aktualisiere Gerätenamen für %s: '%s' -> '%s'",
                mac,
                device.name,
                desired_name,
            )
            dev_reg.async_update_device(device.id, name=desired_name)


# ---------------------------------------------------------------------------
# Aufräumen
# ---------------------------------------------------------------------------


@callback
def _cleanup_wireless_only_entities(
    hass: HomeAssistant, entry: ConfigEntry, coordinator: UnifiDynamicCoordinator
) -> None:
    """
    Entfernt WLAN-Entities von Clients, die nie im WLAN gesehen wurden.

    Diese Entities hätten dauerhaft den Zustand "Unbekannt". Ein einmal
    gesehenes Feld bleibt im Cache erhalten, ein Wechsel auf Kabel löst die
    Entfernung also nicht aus.
    """
    ent_reg = er.async_get(hass)
    removed = 0

    for kind, required_field in (("ssid", "essid"), ("access_point", "ap_mac")):
        for mac, data in (coordinator.data or {}).items():
            if (data or {}).get(required_field):
                continue

            entity_id = ent_reg.async_get_entity_id(
                Platform.SENSOR.value,
                DOMAIN,
                f"{DOMAIN}.{entry.entry_id}.{kind}.{mac}",
            )
            if entity_id:
                ent_reg.async_remove(entity_id)
                removed += 1

    if removed:
        _LOGGER.info(
            "%s WLAN-Entities von reinen Kabel-Clients entfernt", removed
        )


# ---------------------------------------------------------------------------
# Einmalige Entity-ID-Migration
# ---------------------------------------------------------------------------


def _free_entity_id(ent_reg: er.EntityRegistry, domain: str, object_id: str) -> str:
    """Freie entity_id ohne async_generate_entity_id (versionsstabil)."""
    candidate = f"{domain}.{object_id}"
    if candidate not in ent_reg.entities:
        return candidate

    index = 2
    while True:
        candidate = f"{domain}.{object_id}_{index}"
        if candidate not in ent_reg.entities:
            return candidate
        index += 1


@callback
def _migrate_entity_ids(
    hass: HomeAssistant, entry: ConfigEntry, coordinator: UnifiDynamicCoordinator
) -> None:
    """
    Benennt Altbestand um auf sensor.unifi_dynamic_<client>_<kind> bzw.
    binary_sensor.unifi_dynamic_<client>_online.

    Läuft genau einmal; das Flag liegt im Store, nicht in entry.options.
    """
    if coordinator.migration_done:
        return

    ent_reg = er.async_get(hass)
    prefix = f"{DOMAIN}.{entry.entry_id}."

    renamed = 0
    skipped = 0

    for existing in [
        e
        for e in ent_reg.entities.values()
        if e.config_entry_id == entry.entry_id and e.platform == DOMAIN
    ]:
        object_id = existing.entity_id.split(".", 1)[1]
        if object_id.startswith(f"{DOMAIN}_"):
            skipped += 1
            continue

        unique_id = existing.unique_id or ""
        if not unique_id.startswith(prefix):
            skipped += 1
            continue

        parts = unique_id.split(".")
        if len(parts) != 4:
            skipped += 1
            continue

        kind, mac = parts[2], parts[3]
        suffix = _KIND_SUFFIX.get(kind)
        if suffix is None:
            skipped += 1
            continue

        data = (coordinator.data or {}).get(mac, {}) or {}
        new_object_id = f"{DOMAIN}_{client_slug(data, mac)}_{suffix}"
        new_entity_id = _free_entity_id(ent_reg, existing.domain, new_object_id)

        if new_entity_id == existing.entity_id:
            skipped += 1
            continue

        try:
            ent_reg.async_update_entity(
                existing.entity_id, new_entity_id=new_entity_id
            )
            renamed += 1
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning(
                "Entity-ID-Rename fehlgeschlagen (%s -> %s): %s",
                existing.entity_id,
                new_entity_id,
                err,
            )
            skipped += 1

    if renamed:
        _LOGGER.info(
            "Entity-ID-Migration: %s umbenannt, %s übersprungen", renamed, skipped
        )

    coordinator.mark_migration_done()
