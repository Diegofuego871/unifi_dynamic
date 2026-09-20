"""Integration "UniFi Dynamic Clients"."""

from __future__ import annotations

import asyncio
import logging

from datetime import time as dt_time
from pathlib import Path
from time import monotonic
from typing import Any

import voluptuous as vol
from homeassistant.components.http import StaticPathConfig
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
    ACTION_EXCLUDE,
    ATTR_DEVICE_ID,
    ATTR_DRY_RUN,
    ATTR_ENTRY_ID,
    ATTR_MAC,
    BRAND_DIR,
    CONF_PURGE_EXCLUDE,
    CONF_PURGE_TIME,
    CONF_SCAN_INTERVAL,
    DATA_PUSH_IMAGE,
    DEFAULT_PURGE_TIME,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    EVENT_NOTIFICATION_ACTION,
    NEW_CLIENT_WAIT_INTERVAL,
    NEW_CLIENT_WAIT_TIMEOUT,
    PURGE_STARTUP_DELAY,
    PUSH_IMAGE_FILE,
    PUSH_IMAGE_URL,
    SERVICE_PURGE_NOW,
    SERVICE_REMOVE_CLIENT,
    STATIC_URL_PATH,
)
from .coordinator import (
    PurgeResult,
    UnifiDynamicCoordinator,
    client_slug,
    preferred_client_name,
)
from .notification import (
    async_send_controller_offline,
    async_send_controller_recovered,
    async_send_exclusion_notice,
    async_send_new_clients_report,
    async_send_purge_report,
    async_send_removal_notice,
    message_fields,
    missing_message_fields,
    parse_client_action,
)

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
    await _async_register_brand_path(hass)

    coordinator = UnifiDynamicCoordinator(hass, entry)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    # Cache laden, BEVOR die erste Abfrage läuft. Sonst verlieren gerade
    # offline Clients ihre zuletzt bekannten Werte und ihr _seen_at.
    _register_new_client_handler(hass, entry, coordinator)
    # Vor dem ersten Refresh: Schlägt schon der fehl, soll er mitgezählt
    # werden und eine spätere Störungsmeldung auslösen können.
    _register_contact_handler(hass, entry, coordinator)

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
    # Assistant async_reload_entry NICHT auf; das Abfrageintervall und die
    # Purge-Zeit würden erst nach einem Neustart greifen. Nur diese beiden
    # Werte werden beim Setup eingefroren, alles andere liest der Code bei
    # jedem Lauf frisch aus dem Entry. Deshalb wird auch nur für sie neu
    # geladen: die Ausnahmeliste per Meldungsaktion zu ergänzen würde sonst
    # jedes Mal sämtliche Entitäten neu aufbauen.
    signature = _reload_signature(entry)

    async def _options_updated(
        _hass: HomeAssistant, updated: ConfigEntry
    ) -> None:
        nonlocal signature

        current = _reload_signature(updated)
        if current == signature:
            _LOGGER.debug(
                "Options geändert, ohne Reload wirksam: %s", updated.options
            )
            return

        signature = current
        await hass.config_entries.async_reload(updated.entry_id)

    entry.async_on_unload(entry.add_update_listener(_options_updated))

    _register_notification_action_handler(hass, entry, coordinator)

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
            hass.services.async_remove(DOMAIN, SERVICE_REMOVE_CLIENT)

    return unload_ok


def _reload_signature(entry: ConfigEntry) -> tuple[int, str]:
    """
    Die Options, die einen Reload erfordern.

    Abfrageintervall und Purge-Zeit werden beim Setup in den Coordinator bzw.
    in async_track_time_change übernommen und ändern sich sonst nicht mehr.
    Alle übrigen Options - Schwelle, Ausnahmeliste, Meldungsziel und -inhalt -
    werden bei jeder Verwendung frisch aus dem Entry gelesen und brauchen
    keinen Reload.
    """
    raw = entry.options.get(
        CONF_SCAN_INTERVAL, entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
    )
    try:
        scan_interval = int(raw)
    except (TypeError, ValueError):
        scan_interval = DEFAULT_SCAN_INTERVAL

    return scan_interval, _purge_time(entry).isoformat()


@callback
def _register_notification_action_handler(
    hass: HomeAssistant, entry: ConfigEntry, coordinator: UnifiDynamicCoordinator
) -> None:
    """
    Nimmt den Tastendruck "Nie entfernen" aus einer Push-Meldung entgegen.

    Der Event-Bus ist global: es kommen auch Aktionen anderer Integrationen
    und anderer UniFi-Hosts an. Gefiltert wird deshalb über den Aktions-Key,
    der die Entry-ID mitführt.
    """
    lock = asyncio.Lock()

    async def _handle(event: Event) -> None:
        parsed = parse_client_action(str(event.data.get("action") or ""))
        if parsed is None:
            return

        kind, entry_id, mac = parsed
        if entry_id != entry.entry_id:
            return

        # Name vor dem Entfernen bestimmen, danach ist er aus dem Cache weg.
        name = preferred_client_name(coordinator.client_data(mac), mac)

        # Serialisiert, damit zwei schnell hintereinander getippte Buttons
        # nicht beide vom selben Ausgangsstand lesen und einer davon verloren
        # geht.
        async with lock:
            if kind == ACTION_EXCLUDE:
                changed = _exclude_mac(hass, entry, mac)
            else:
                changed = coordinator.remove_client_now(mac) is not None

        try:
            if kind == ACTION_EXCLUDE:
                if changed:
                    _LOGGER.info(
                        "Client %s (%s) per Meldungsaktion vom Entfernen "
                        "ausgenommen",
                        name,
                        mac,
                    )
                else:
                    _LOGGER.debug(
                        "Client %s (%s) stand bereits auf der Ausnahmeliste",
                        name,
                        mac,
                    )
                # Auch beim zweiten Tippen bestätigen: der Zustand stimmt dann
                # ja bereits.
                await async_send_exclusion_notice(hass, entry, mac, name)
            else:
                await async_send_removal_notice(
                    hass, entry, mac, name, removed=changed
                )
        except Exception:  # noqa: BLE001 - Rückmeldung darf nichts kippen
            _LOGGER.exception("Bestätigung für %s fehlgeschlagen", mac)

    entry.async_on_unload(
        hass.bus.async_listen(EVENT_NOTIFICATION_ACTION, _handle)
    )


@callback
def _register_contact_handler(
    hass: HomeAssistant, entry: ConfigEntry, coordinator: UnifiDynamicCoordinator
) -> None:
    """
    Meldet Ausfall und Rückkehr des Controllers.

    Der Coordinator entscheidet anhand der fehlgeschlagenen Abfragen, wann ein
    Zustandswechsel vorliegt, und ruft hier genau einmal je Wechsel an. Damit
    hängt die Meldung direkt am Abfragezyklus: Die Störung kommt beim
    Erreichen der eingestellten Zahl an Fehlversuchen, die Entwarnung mit der
    ersten geglückten Abfrage.
    """

    async def _handle(offline: bool, seconds: float | None, failures: int) -> None:
        try:
            if offline:
                await async_send_controller_offline(
                    hass, entry, coordinator.host, seconds, failures
                )
            else:
                await async_send_controller_recovered(
                    hass, entry, coordinator.host, seconds
                )
        except Exception:  # noqa: BLE001 - Meldung darf den Abfragezyklus nie kippen
            _LOGGER.exception(
                "Meldung zur Controller-Erreichbarkeit fehlgeschlagen"
            )

    coordinator.async_set_contact_callback(_handle)
    entry.async_on_unload(lambda: coordinator.async_set_contact_callback(None))


@callback
def _exclude_mac(hass: HomeAssistant, entry: ConfigEntry, mac: str) -> bool:
    """
    Ergänzt die MAC in der Ausnahmeliste der Options.

    Bewusst dieselbe Liste wie im Optionsdialog, nicht ein zweiter Speicher:
    So bleibt der Eintrag dort sichtbar und lässt sich auch wieder entfernen.
    Gibt False zurück, wenn die MAC schon drinstand.
    """
    current = [
        str(item).strip().lower()
        for item in (entry.options.get(CONF_PURGE_EXCLUDE) or [])
        if str(item).strip()
    ]

    if mac in current:
        return False

    hass.config_entries.async_update_entry(
        entry,
        options={**entry.options, CONF_PURGE_EXCLUDE: [*current, mac]},
    )
    return True


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

    def _incomplete(
        clients: list[tuple[str, dict]]
    ) -> dict[str, list[str]]:
        """
        MAC -> noch fehlende Angaben, nur für unvollständige Clients.

        Neben den gewünschten Inhalten wird auch das Gerät abgewartet: Der
        Klick auf die Meldung soll auf dessen Seite führen, und die Registry
        kennt es erst, wenn die Plattformen die Entitäten angelegt haben.
        """
        fields = message_fields(entry)
        dev_reg = dr.async_get(hass)
        out: dict[str, list[str]] = {}

        for mac, data in clients:
            missing = missing_message_fields(mac, data, fields)
            if dev_reg.async_get_device(identifiers={(DOMAIN, mac)}) is None:
                missing.append("device")
            if missing:
                out[mac] = missing

        return out

    def _refresh(clients: list[tuple[str, dict]]) -> list[tuple[str, dict]]:
        return [
            (mac, coordinator.client_snapshot(mac) or snapshot)
            for mac, snapshot in clients
        ]

    async def _wait_then_send(clients: list[tuple[str, dict]]) -> None:
        """
        Meldung zurückhalten, bis alle gewünschten Angaben vorliegen.

        Die Werte stammen vom Controller, nicht von Home Assistant: Hostname
        und IP brauchen die DHCP-Lease, der AP-Name die Geräteliste. Die Gruppe
        wartet gemeinsam, damit die Sammelmeldung ab mehreren neuen Clients
        erhalten bleibt. Nach Ablauf der Grenze wird mit dem gesendet, was da
        ist; die Meldung fällt also nie aus.
        """
        deadline = monotonic() + NEW_CLIENT_WAIT_TIMEOUT

        while True:
            clients = _refresh(clients)
            incomplete = _incomplete(clients)

            if not incomplete:
                break

            if monotonic() >= deadline:
                _LOGGER.debug(
                    "Wartezeit von %s s abgelaufen, Meldung wird unvollständig "
                    "gesendet: %s",
                    NEW_CLIENT_WAIT_TIMEOUT,
                    incomplete,
                )
                break

            await asyncio.sleep(NEW_CLIENT_WAIT_INTERVAL)

        await _send_when_started(clients)

    async def _handle(clients: list[tuple[str, dict]]) -> None:
        incomplete = _incomplete(clients)

        if not incomplete:
            await _send_when_started(clients)
            return

        _LOGGER.debug(
            "Meldung über %s neue Client(s) wartet auf fehlende Angaben (%s), "
            "höchstens %s s",
            len(clients),
            incomplete,
            NEW_CLIENT_WAIT_TIMEOUT,
        )
        entry.async_create_background_task(
            hass,
            _wait_then_send(clients),
            f"{DOMAIN}_new_client_wait",
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
# Mitgeliefertes Bild für Push-Meldungen
# ---------------------------------------------------------------------------


async def _async_register_brand_path(hass: HomeAssistant) -> None:
    """
    Macht den Ordner brand/ unter STATIC_URL_PATH abrufbar.

    Statische Pfade werden ohne Authentifizierung ausgeliefert, genau wie
    /local/. Nur so kann die Companion-App das Bild laden. Läuft einmal pro
    Home-Assistant-Instanz, nicht pro Config-Entry.
    """
    if DATA_PUSH_IMAGE in hass.data:
        return

    brand_path = Path(__file__).parent / BRAND_DIR
    image_path = brand_path / PUSH_IMAGE_FILE

    exists = await hass.async_add_executor_job(image_path.is_file)
    if not exists:
        hass.data[DATA_PUSH_IMAGE] = None
        _LOGGER.debug(
            "%s nicht gefunden, Push-Meldungen werden ohne Bild gesendet",
            image_path,
        )
        return

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL_PATH, str(brand_path), True)]
        )
    except Exception as err:  # noqa: BLE001 - Bild ist nur Kosmetik
        hass.data[DATA_PUSH_IMAGE] = None
        _LOGGER.warning(
            "Statischer Pfad %s konnte nicht registriert werden (%s), "
            "Push-Meldungen werden ohne Bild gesendet",
            STATIC_URL_PATH,
            err,
        )
        return

    hass.data[DATA_PUSH_IMAGE] = PUSH_IMAGE_URL
    _LOGGER.debug("Bild für Push-Meldungen bereitgestellt unter %s", PUSH_IMAGE_URL)


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
    """Registriert die Services der Integration einmalig."""
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

    async def _handle_remove_client(call: ServiceCall) -> ServiceResponse:
        wanted_entry = call.data.get(ATTR_ENTRY_ID)
        targets: list[tuple[str | None, str]] = []

        for device_id in _as_list(call.data.get(ATTR_DEVICE_ID)):
            resolved = _mac_from_device(hass, str(device_id))
            if resolved is None:
                _LOGGER.warning(
                    "Gerät %s gehört nicht zu dieser Integration", device_id
                )
                continue
            targets.append(resolved)

        for raw in _as_list(call.data.get(ATTR_MAC)):
            mac = _normalize_mac(str(raw))
            if mac is None:
                _LOGGER.warning("Ungültige MAC-Adresse: %s", raw)
                continue
            targets.append((None, mac))

        results: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        for entry_id, mac in targets:
            # Ohne Entry-ID gilt der Aufruf für jeden Host, der die MAC kennt.
            # Dieselbe MAC kann in getrennten Netzen mehrfach vorkommen.
            candidates = (
                [entry_id]
                if entry_id
                else [wanted_entry]
                if wanted_entry
                else list(hass.data.get(DOMAIN, {}))
            )

            hit = False
            for candidate in candidates:
                coordinator = hass.data.get(DOMAIN, {}).get(candidate)
                if coordinator is None:
                    continue
                if (candidate, mac) in seen:
                    hit = True
                    continue

                name = preferred_client_name(coordinator.client_data(mac), mac)
                online = coordinator.is_client_online(mac)
                removed = coordinator.remove_client_now(mac)
                if removed is None:
                    continue

                seen.add((candidate, mac))
                hit = True
                results.append(
                    {
                        "entry_id": candidate,
                        "mac": mac,
                        "name": name,
                        "removed_entities": removed[0],
                        "removed_devices": removed[1],
                        # War der Client zuletzt online, legt ihn der nächste
                        # Abgleich wieder an - mit neuen Entity-IDs.
                        "was_online": bool(online),
                    }
                )

            if not hit:
                _LOGGER.info("Zu %s ist nichts bekannt, nichts entfernt", mac)
                results.append({"mac": mac, "removed": False, "reason": "unknown"})

        return {"results": results}

    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_CLIENT,
        _handle_remove_client,
        schema=vol.Schema(
            vol.All(
                {
                    vol.Optional(ATTR_DEVICE_ID): vol.Any(cv.string, [cv.string]),
                    vol.Optional(ATTR_MAC): vol.Any(cv.string, [cv.string]),
                    vol.Optional(ATTR_ENTRY_ID): cv.string,
                },
                cv.has_at_least_one_key(ATTR_DEVICE_ID, ATTR_MAC),
            )
        ),
        supports_response=SupportsResponse.OPTIONAL,
    )


def _as_list(value: Any) -> list[Any]:
    """Einzelwert oder Liste einheitlich als Liste."""
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return list(value)
    return [value]


def _normalize_mac(raw: str) -> str | None:
    """
    Bringt eine MAC auf das intern genutzte Format aa:bb:cc:11:22:33.

    Akzeptiert Doppelpunkte, Bindestriche, Punkte und blanke Hexfolgen, damit
    ein aus einem Log oder aus der UniFi-Oberfläche kopierter Wert direkt
    funktioniert.
    """
    token = "".join(c for c in raw.strip().lower() if c not in ":-. ")
    if len(token) != 12:
        return None
    try:
        int(token, 16)
    except ValueError:
        return None
    return ":".join(token[i : i + 2] for i in range(0, 12, 2))


@callback
def _mac_from_device(hass: HomeAssistant, device_id: str) -> tuple[str, str] | None:
    """
    Löst eine Geräteauswahl in (Entry-ID, MAC) auf.

    Geräte dieser Integration tragen die MAC als Identifier, siehe
    _sync_device_names. Fremde Geräte werden übersprungen.
    """
    device = dr.async_get(hass).async_get(device_id)
    if device is None:
        return None

    mac = next(
        (value for domain, value in device.identifiers if domain == DOMAIN), None
    )
    if mac is None:
        return None

    entry_id = next(
        (eid for eid in device.config_entries if eid in hass.data.get(DOMAIN, {})),
        None,
    )
    if entry_id is None:
        return None

    return entry_id, mac.lower()


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
