"""Coordinator mit persistentem Client-Cache und Purge-Logik."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from aiohttp import ClientError, ClientTimeout
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import slugify

from .const import (
    AP_NAMES_RETRY,
    AP_NAMES_TTL,
    CLIENT_FIELDS,
    CLIENTS_PATH,
    CONF_API_KEY,
    CONF_HOST,
    CONF_PURGE_DAYS,
    CONF_SCAN_INTERVAL,
    CONF_VERIFY_SSL,
    DEVICES_PATH,
    DEFAULT_PURGE_DAYS,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_VERIFY_SSL,
    DOMAIN,
    DOWNTIME_GRACE_SECONDS,
    FIELD_AP_NAME,
    FIELD_SEEN_AT,
    OFFLINE_AFTER_SECONDS,
    REQUEST_TIMEOUT_SECONDS,
    STORAGE_SAVE_DELAY,
    STORAGE_VERSION,
    STORE_ANCHOR,
    STORE_AP_NAMES,
    STORE_CLIENT_CACHE,
    STORE_KNOWN_NAMES,
    STORE_MIGRATION_FLAG,
)

_LOGGER = logging.getLogger(__name__)

REQUEST_TIMEOUT = ClientTimeout(total=REQUEST_TIMEOUT_SECONDS)


# ---------------------------------------------------------------------------
# Hilfsfunktionen (zentral, damit Slug-Logik nicht mehrfach existiert)
# ---------------------------------------------------------------------------


def as_epoch_seconds(value: Any) -> float | None:
    """Wandelt einen Zeitwert in Epoch-Sekunden. Toleriert Millisekunden."""
    if value is None or isinstance(value, bool):
        return None

    try:
        v = float(value)
    except (TypeError, ValueError):
        return None

    if v <= 0:
        return None

    # Manche Quellen liefern Millisekunden.
    if v > 10_000_000_000:
        v /= 1000.0

    return v


def preferred_client_name(data: dict[str, Any], mac: str) -> str:
    """Anzeigename eines Clients: Name, sonst Hostname, sonst MAC."""
    return str(data.get("name") or data.get("hostname") or mac)


def client_slug(data: dict[str, Any], mac: str) -> str:
    """
    Slug für entity_ids: <name>_<letzte 4 Hex der MAC>.

    Bewusst an einer Stelle definiert; sensor.py, binary_sensor.py und
    __init__.py importieren diese Funktion, damit die IDs nicht auseinander
    laufen können.
    """
    name = preferred_client_name(data, mac)
    mac_suffix = slugify(mac.replace(":", "")[-4:]) if isinstance(mac, str) else "mac"
    return f"{slugify(name)}_{mac_suffix}"


def _extract_clients(payload: Any) -> dict[str, dict[str, Any]]:
    """Extrahiert die Clientliste aus der UniFi-Antwort."""
    if not isinstance(payload, dict):
        return {}

    data = payload.get("data")
    if not isinstance(data, list):
        return {}

    out: dict[str, dict[str, Any]] = {}
    for client in data:
        if not isinstance(client, dict):
            continue
        mac = client.get("mac")
        if mac:
            out[str(mac).lower()] = client
    return out


def _get_int_option(entry: ConfigEntry, key: str, default: int) -> int:
    raw = entry.options.get(key, entry.data.get(key, default))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return int(default)


# ---------------------------------------------------------------------------
# Purge-Ergebnis
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class PurgedClient:
    """Ein im Purge entfernter (oder im Testlauf ermittelter) Client."""

    mac: str
    name: str
    seen_at: float
    age_seconds: float
    entities: int

    @property
    def age_hours(self) -> float:
        return self.age_seconds / 3600

    @property
    def age_days(self) -> float:
        return self.age_seconds / 86400


@dataclass(slots=True)
class PurgeResult:
    """Ergebnis eines Purge-Laufs, Grundlage für Log und Benachrichtigung."""

    purge_days: int
    cache_size: int
    dry_run: bool = False
    skipped: bool = False
    clients: list[PurgedClient] = field(default_factory=list)
    removed_entities: int = 0
    removed_devices: int = 0
    orphan_devices: int = 0

    @property
    def removed_clients(self) -> int:
        return len(self.clients)

    @property
    def changed(self) -> bool:
        """True, wenn etwas entfernt wurde bzw. würde."""
        return bool(self.clients) or self.orphan_devices > 0


# ---------------------------------------------------------------------------
# Coordinator
# ---------------------------------------------------------------------------


class UnifiDynamicCoordinator(DataUpdateCoordinator[dict[str, dict[str, Any]]]):
    """Pollt /stat/sta, pflegt einen persistenten Client-Cache und purged."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.entry = entry

        self.host: str = entry.data[CONF_HOST]
        self.api_key: str = entry.data[CONF_API_KEY]
        self.verify_ssl: bool = bool(entry.data.get(CONF_VERIFY_SSL, DEFAULT_VERIFY_SSL))

        # Geteilte HA-Session statt eigener ClientSession.
        self.session = async_get_clientsession(hass, verify_ssl=self.verify_ssl)

        self._client_cache: dict[str, dict[str, Any]] = {}
        self._known_names: dict[str, str] = {}

        # MAC -> Name der UniFi-Geräte (Access Points, Switches, Gateway).
        self._ap_names: dict[str, str] = {}
        self._ap_names_updated: float | None = None
        self._ap_names_warned = False

        # Ankerzeitpunkt für die Downtime-Gutschrift: letzter erfolgreicher Poll
        # bzw. letzte Gutschrift. Verhindert doppeltes Gutschreiben.
        self._anchor: float | None = None

        self._migration_done = False
        self._removal_callbacks: list[Callable[[str], None]] = []
        self._new_client_callback: (
            Callable[[list[tuple[str, dict[str, Any]]]], Awaitable[None]] | None
        ) = None

        # Eigene Storage-Datei pro Config-Entry (mehrere UniFi-Hosts möglich).
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}_{entry.entry_id}_cache"
        )

        super().__init__(
            hass,
            logger=_LOGGER,
            name=f"{DOMAIN}_{self.host}",
            update_interval=timedelta(
                seconds=_get_int_option(entry, CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
            ),
            config_entry=entry,
        )

    # -- Store --------------------------------------------------------------

    def _data_to_save(self) -> dict[str, Any]:
        return {
            STORE_CLIENT_CACHE: self._client_cache,
            STORE_AP_NAMES: self._ap_names,
            STORE_KNOWN_NAMES: self._known_names,
            STORE_ANCHOR: self._anchor,
            STORE_MIGRATION_FLAG: self._migration_done,
        }

    def _schedule_save(self) -> None:
        """Entprelltes persistentes Speichern."""
        self._store.async_delay_save(self._data_to_save, STORAGE_SAVE_DELAY)

    async def async_save_now(self) -> None:
        """Sofortiger Save, z. B. bei Unload oder Shutdown."""
        try:
            await self._store.async_save(self._data_to_save())
        except Exception as err:  # noqa: BLE001 - Save darf nie den Unload kippen
            _LOGGER.warning("Cache konnte nicht gespeichert werden: %s", err)

    async def async_load_cache(self) -> None:
        """
        Lädt den persistierten Client-Cache.

        Muss vor async_config_entry_first_refresh() laufen, damit offline
        Clients ihre letzten bekannten Werte und ihr _seen_at behalten.
        """
        try:
            stored = await self._store.async_load()
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Persistenter Cache konnte nicht geladen werden: %s", err)
            return

        if not isinstance(stored, dict):
            return

        self._migration_done = bool(stored.get(STORE_MIGRATION_FLAG, False))
        self._anchor = as_epoch_seconds(stored.get(STORE_ANCHOR))

        names = stored.get(STORE_KNOWN_NAMES)
        if isinstance(names, dict):
            self._known_names = {
                str(mac).lower(): str(name) for mac, name in names.items()
            }

        ap_names = stored.get(STORE_AP_NAMES)
        if isinstance(ap_names, dict):
            # Zeitstempel bewusst nicht persistiert: der erste Poll nach einem
            # Neustart holt die Liste frisch, die gespeicherten Namen überbrücken
            # nur die Zeit bis dahin.
            self._ap_names = {
                str(mac).lower(): str(name) for mac, name in ap_names.items()
            }

        cache = stored.get(STORE_CLIENT_CACHE)
        if isinstance(cache, dict):
            self._client_cache = self._normalise_cache(cache)

        _LOGGER.debug("Persistenter Cache geladen: %s Clients", len(self._client_cache))

        self._credit_downtime()

    def _normalise_cache(self, stored: dict[str, Any]) -> dict[str, dict[str, Any]]:
        """
        Reduziert den gespeicherten Cache auf die Whitelist und stellt sicher,
        dass jeder Client ein _seen_at hat.

        Altbestand ohne _seen_at wird aus dem früheren UniFi-Feld last_seen
        abgeleitet, sonst konservativ auf jetzt gesetzt. Damit löscht der erste
        Purge nach dem Update nichts zu früh.
        """
        now = time.time()
        out: dict[str, dict[str, Any]] = {}
        backfilled = 0

        for mac, raw in stored.items():
            if not isinstance(raw, dict):
                continue

            mac_l = str(mac).lower()
            entry: dict[str, Any] = {
                key: raw[key] for key in CLIENT_FIELDS if raw.get(key) is not None
            }
            entry["mac"] = mac_l

            seen_at = as_epoch_seconds(raw.get(FIELD_SEEN_AT))
            if seen_at is None:
                seen_at = as_epoch_seconds(raw.get("last_seen"))
                if seen_at is None:
                    seen_at = now
                backfilled += 1

            entry[FIELD_SEEN_AT] = min(seen_at, now)
            out[mac_l] = entry

        if backfilled:
            _LOGGER.info(
                "%s Clients ohne %s aus Altbestand übernommen",
                backfilled,
                FIELD_SEEN_AT,
            )

        return out

    def _credit_downtime(self) -> None:
        """
        Schreibt eine HA-Ausfallzeit allen _seen_at gut.

        Ohne das würde ein Neustart nach längerem Stillstand alle Clients
        gleichzeitig als stale einstufen und in einem Lauf löschen.
        """
        if self._anchor is None or not self._client_cache:
            return

        now = time.time()
        gap = now - self._anchor
        if gap <= DOWNTIME_GRACE_SECONDS:
            return

        for data in self._client_cache.values():
            seen = as_epoch_seconds(data.get(FIELD_SEEN_AT))
            data[FIELD_SEEN_AT] = now if seen is None else min(seen + gap, now)

        # Anker nachziehen, damit die gleiche Lücke nicht zweimal gutgeschrieben
        # wird, falls der nächste Poll ebenfalls fehlschlägt.
        self._anchor = now

        _LOGGER.info(
            "Kein erfolgreicher UniFi-Poll seit %.1f Stunden; Purge-Alter aller "
            "Clients um diese Zeit gutgeschrieben",
            gap / 3600,
        )
        self._schedule_save()

    # -- Migrationsflag -----------------------------------------------------

    @property
    def migration_done(self) -> bool:
        return self._migration_done

    @callback
    def mark_migration_done(self) -> None:
        """
        Merkt die erledigte Entity-ID-Migration im Store.

        Bewusst nicht in entry.options: ein Options-Write würde den
        Update-Listener und damit einen Reload während des Setups auslösen.
        """
        if not self._migration_done:
            self._migration_done = True
            self._schedule_save()

    # -- Removal-Callbacks --------------------------------------------------

    @callback
    def async_add_removal_callback(
        self, target: Callable[[str], None]
    ) -> Callable[[], None]:
        """
        Registriert einen Callback, der bei gepurgten MACs aufgerufen wird.

        Die Plattformen räumen damit ihre known-Sets auf. Ohne das bleibt eine
        zurückkehrende MAC bis zum nächsten Reload ohne Entities.
        """
        self._removal_callbacks.append(target)

        @callback
        def _remove() -> None:
            if target in self._removal_callbacks:
                self._removal_callbacks.remove(target)

        return _remove

    @callback
    def async_set_new_client_callback(
        self,
        target: Callable[[list[tuple[str, dict[str, Any]]]], Awaitable[None]] | None,
    ) -> None:
        """
        Setzt den Handler für erstmals gesehene Clients.

        Der Handler bekommt die fertigen Cache-Einträge mitgeliefert, nicht nur
        die MACs. So hängt er nicht davon ab, ob self.data zum Zeitpunkt der
        Ausführung schon aktualisiert ist.
        """
        self._new_client_callback = target

    @callback
    def _notify_removed(self, mac: str) -> None:
        for target in list(self._removal_callbacks):
            try:
                target(mac)
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Removal-Callback fehlgeschlagen: %s", err)

    # -- Cache-Zugriff für Entities ----------------------------------------

    def client_data(self, mac: str) -> dict[str, Any]:
        return (self.data or {}).get(mac, {})

    def access_point_name(self, ap_mac: Any) -> str | None:
        """Name des Access Points, sonst dessen MAC, sonst None."""
        key = str(ap_mac or "").strip().lower()
        if not key:
            return None
        return self._ap_names.get(key) or key

    def client_snapshot(self, mac: str) -> dict[str, Any]:
        """
        Kopie des Cache-Eintrags plus aufgelöstem AP-Namen.

        Liest bewusst aus dem Cache und nicht aus self.data, damit sie auch
        während eines laufenden Updates korrekte Werte liefert.
        """
        data = dict(self._client_cache.get(mac.lower(), {}))
        if not data:
            return data

        ap_name = self.access_point_name(data.get("ap_mac"))
        if ap_name:
            data[FIELD_AP_NAME] = ap_name
        return data

    def seen_at(self, mac: str) -> float | None:
        return as_epoch_seconds(self.client_data(mac).get(FIELD_SEEN_AT))

    def is_client_online(self, mac: str) -> bool:
        """
        Online, wenn der Client beim letzten erfolgreichen Poll gesehen wurde.

        Referenz ist bewusst der letzte erfolgreiche Poll, nicht die Wanduhr:
        bei einem Controller-Ausfall friert der Zustand ein, statt alle Clients
        nach einer Minute auf offline zu kippen.
        """
        seen = self.seen_at(mac)
        if seen is None:
            return False

        reference = self._anchor if self._anchor is not None else time.time()
        return (reference - seen) <= OFFLINE_AFTER_SECONDS

    # -- Update -------------------------------------------------------------

    def _merge_client(self, mac: str, new: dict[str, Any], now: float) -> None:
        mac_l = mac.lower()
        current = self._client_cache.setdefault(mac_l, {"mac": mac_l})

        for key in CLIENT_FIELDS:
            value = new.get(key)
            if value is None:
                continue
            current[key] = value

        current["mac"] = mac_l
        current[FIELD_SEEN_AT] = now

    def _log_name_changes(self, fresh: dict[str, dict[str, Any]]) -> None:
        for mac, data in fresh.items():
            mac_l = mac.lower()
            new_name = preferred_client_name(data, mac_l)
            old_name = self._known_names.get(mac_l)

            if old_name is not None and old_name != new_name:
                _LOGGER.info(
                    "Client-Name geändert: %s -> %s (%s)", old_name, new_name, mac_l
                )

            self._known_names[mac_l] = new_name

    async def _async_update_data(self) -> dict[str, dict[str, Any]]:
        """
        Holt die aktive Clientliste.

        Netzwerkfehler sind hier nicht fatal: der bestehende Cache wird
        weitergegeben. Der Purge läuft bewusst NICHT hier, sondern nur
        zeitgesteuert aus __init__.py, damit Purge-Fehler nicht als API-Fehler
        getarnt werden.
        """
        url = f"https://{self.host}{CLIENTS_PATH}"
        headers = {"X-API-KEY": self.api_key, "Accept": "application/json"}

        try:
            async with self.session.get(
                url, headers=headers, timeout=REQUEST_TIMEOUT
            ) as resp:
                if resp.status >= 400:
                    text = await resp.text()
                    _LOGGER.warning(
                        "UniFi API HTTP %s, verwende bestehenden Cache weiter: %s",
                        resp.status,
                        text[:200],
                    )
                    return dict(self._client_cache)

                payload = await resp.json(content_type=None)

        except asyncio.TimeoutError:
            _LOGGER.warning("UniFi API Timeout, verwende bestehenden Cache weiter")
            return dict(self._client_cache)

        except ClientError as err:
            _LOGGER.warning(
                "UniFi API Netzwerkfehler, verwende bestehenden Cache weiter: %s", err
            )
            return dict(self._client_cache)

        except ValueError as err:
            _LOGGER.warning(
                "UniFi API lieferte kein gültiges JSON, verwende bestehenden Cache "
                "weiter: %s",
                err,
            )
            return dict(self._client_cache)

        # Ab hier bewusst ohne try: Fehler in der eigenen Verarbeitung sollen
        # als echter Coordinator-Fehler sichtbar werden, nicht als API-Problem.
        fresh = _extract_clients(payload)
        now = time.time()

        # Erstbefüllung erkennen, bevor gemerged wird. Ohne diese Prüfung würde
        # eine Neuinstallation eine Meldung pro bereits vorhandenem Client
        # auslösen.
        first_fill = not self._client_cache
        new_macs = [mac for mac in fresh if mac not in self._client_cache]

        self._log_name_changes(fresh)

        for mac, data in fresh.items():
            self._merge_client(mac, data, now)

        self._anchor = now

        # Vor der Meldung über neue Clients, damit dort der AP-Name steht.
        if self._needs_ap_refresh():
            await self._async_refresh_ap_names()

        self._schedule_save()

        if new_macs:
            self._handle_new_clients(new_macs, first_fill)

        return dict(self._client_cache)

    @callback
    def _handle_new_clients(self, new_macs: list[str], first_fill: bool) -> None:
        """Loggt erstmals gesehene Clients und stösst die Meldung an."""
        if first_fill:
            _LOGGER.info(
                "Erstbefüllung des Caches mit %s Clients, keine Meldung über "
                "neue Geräte",
                len(new_macs),
            )
            return

        clients: list[tuple[str, dict[str, Any]]] = []
        for mac in new_macs:
            data = self.client_snapshot(mac)
            _LOGGER.info(
                "Neuer Client erkannt: %s (%s)",
                preferred_client_name(data, mac),
                mac,
            )
            clients.append((mac, data))

        if self._new_client_callback is not None and clients:
            self.hass.async_create_task(self._new_client_callback(clients))

    # -- AP-Namen -----------------------------------------------------------

    def _needs_ap_refresh(self) -> bool:
        if self._ap_names_updated is None:
            return True

        age = time.time() - self._ap_names_updated
        if age >= AP_NAMES_TTL:
            return True

        if age < AP_NAMES_RETRY:
            return False

        # Ein Client hängt an einem AP, dessen MAC wir nicht kennen.
        return any(
            str(data.get("ap_mac") or "").lower() not in self._ap_names
            for data in self._client_cache.values()
            if data.get("ap_mac")
        )

    async def _async_refresh_ap_names(self) -> None:
        """
        Holt die UniFi-Geräteliste, um AP-MACs auf Namen abzubilden.

        Rein kosmetisch: schlägt der Aufruf fehl, zeigen die Sensoren die
        AP-MAC statt des Namens. Der Client-Poll bleibt davon unberührt.
        """
        url = f"https://{self.host}{DEVICES_PATH}"
        headers = {"X-API-KEY": self.api_key, "Accept": "application/json"}

        try:
            async with self.session.get(
                url, headers=headers, timeout=REQUEST_TIMEOUT
            ) as resp:
                if resp.status >= 400:
                    self._log_ap_problem(f"HTTP {resp.status}")
                    return
                payload = await resp.json(content_type=None)
        except (asyncio.TimeoutError, ClientError, ValueError) as err:
            self._log_ap_problem(str(err))
            return

        entries = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(entries, list):
            self._log_ap_problem("unerwartetes Antwortformat")
            return

        names: dict[str, str] = {}
        for device in entries:
            if not isinstance(device, dict):
                continue
            mac = str(device.get("mac") or "").strip().lower()
            if not mac:
                continue
            names[mac] = str(device.get("name") or device.get("model") or mac)

        self._ap_names_updated = time.time()

        if not names:
            self._log_ap_problem("keine Geräte in der Antwort")
            return

        if names != self._ap_names:
            self._ap_names = names
            self._schedule_save()

        self._ap_names_warned = False
        _LOGGER.debug("AP-Namen aktualisiert: %s UniFi-Geräte", len(names))

    def _log_ap_problem(self, reason: str) -> None:
        """Einmal deutlich warnen, danach nur noch Debug."""
        self._ap_names_updated = time.time()

        if self._ap_names_warned:
            _LOGGER.debug("AP-Namen konnten nicht geladen werden: %s", reason)
            return

        self._ap_names_warned = True
        _LOGGER.warning(
            "AP-Namen konnten nicht von %s geladen werden (%s). Die Sensoren "
            "zeigen bis auf Weiteres die AP-MAC statt des Namens.",
            DEVICES_PATH,
            reason,
        )

    # -- Purge --------------------------------------------------------------

    async def async_purge_stale(self, dry_run: bool = False) -> PurgeResult:
        """
        Entfernt Clients, die seit purge_days nicht mehr gesehen wurden.

        Grundlage ist ausschliesslich das selbst gesetzte _seen_at. Mit
        dry_run=True wird nur ermittelt, was entfernt würde; es wird nichts
        verändert.
        """
        purge_days = _get_int_option(self.entry, CONF_PURGE_DAYS, DEFAULT_PURGE_DAYS)
        result = PurgeResult(
            purge_days=purge_days,
            cache_size=len(self._client_cache),
            dry_run=dry_run,
        )

        if purge_days <= 0:
            result.skipped = True
            _LOGGER.debug("Purge deaktiviert (purge_days=%s)", purge_days)
            return result

        dev_reg = dr.async_get(self.hass)
        ent_reg = er.async_get(self.hass)
        entries = er.async_entries_for_config_entry(ent_reg, self.entry.entry_id)

        threshold = purge_days * 86400
        now = time.time()
        stale: list[tuple[str, float]] = []

        for mac, data in list(self._client_cache.items()):
            seen = as_epoch_seconds(data.get(FIELD_SEEN_AT))
            if seen is None:
                # Darf nach _normalise_cache nicht vorkommen. Defensiv
                # nachziehen statt löschen.
                if not dry_run:
                    data[FIELD_SEEN_AT] = now
                _LOGGER.warning(
                    "Client %s ohne %s, Zeitstempel neu gesetzt", mac, FIELD_SEEN_AT
                )
                continue

            if now - seen >= threshold:
                stale.append((mac, seen))

        for mac, seen in stale:
            client_entries = self._entity_entries_for_mac(entries, mac)
            client = PurgedClient(
                mac=mac,
                name=self._known_names.get(mac)
                or preferred_client_name(self._client_cache.get(mac, {}), mac),
                seen_at=seen,
                age_seconds=now - seen,
                entities=len(client_entries),
            )
            result.clients.append(client)
            result.removed_entities += client.entities

            _LOGGER.info(
                "Purge %s Client %s (%s), %.1f Tage nicht gesehen, %s Entitäten",
                "ermittelt" if dry_run else "entfernt",
                client.name,
                mac,
                client.age_days,
                client.entities,
            )

            device = dev_reg.async_get_device(identifiers={(DOMAIN, mac)})

            if dry_run:
                if device is not None:
                    result.removed_devices += 1
                continue

            for ent in client_entries:
                ent_reg.async_remove(ent.entity_id)

            if device is not None:
                dev_reg.async_remove_device(device.id)
                result.removed_devices += 1

            self._client_cache.pop(mac, None)
            self._known_names.pop(mac, None)

            # Auch aus dem aktuellen Snapshot entfernen, sonst könnte die
            # MAC vor dem nächsten Poll erneut angelegt werden.
            if self.data:
                self.data.pop(mac, None)

            self._notify_removed(mac)

        if stale and not dry_run:
            self._schedule_save()

        result.orphan_devices = self._purge_orphan_devices(dev_reg, ent_reg, dry_run)
        result.removed_devices += result.orphan_devices

        if result.changed:
            _LOGGER.info(
                "Purge abgeschlossen%s: %s Clients (>%s Tage nicht gesehen), "
                "%s Entitäten, %s Geräte (davon %s leere Geräte)",
                " (Testlauf)" if dry_run else "",
                result.removed_clients,
                purge_days,
                result.removed_entities,
                result.removed_devices,
                result.orphan_devices,
            )
        else:
            _LOGGER.debug(
                "Purge abgeschlossen%s: nichts zu entfernen (%s Clients im Cache, "
                "Schwelle %s Tage)",
                " (Testlauf)" if dry_run else "",
                result.cache_size,
                purge_days,
            )

        return result

    def _entity_entries_for_mac(
        self, entries: list[er.RegistryEntry], mac: str
    ) -> list[er.RegistryEntry]:
        mac_l = mac.lower()
        prefix = f"{DOMAIN}.{self.entry.entry_id}."
        return [
            ent
            for ent in entries
            if ent.unique_id
            and ent.unique_id.startswith(prefix)
            and ent.unique_id.endswith(f".{mac_l}")
        ]

    def _purge_orphan_devices(
        self,
        dev_reg: dr.DeviceRegistry,
        ent_reg: er.EntityRegistry,
        dry_run: bool = False,
    ) -> int:
        """
        Entfernt Geräte dieser Integration, die keine Entities mehr haben.

        er.async_entries_for_device liefert Entities aller Integrationen, ein
        mit einer anderen Integration verschmolzenes Gerät ist also geschützt.
        """
        removed = 0

        for device in list(
            dr.async_entries_for_config_entry(dev_reg, self.entry.entry_id)
        ):
            domain_macs = [
                identifier[1]
                for identifier in (device.identifiers or set())
                if len(identifier) == 2 and identifier[0] == DOMAIN
            ]
            if not domain_macs:
                continue

            if er.async_entries_for_device(
                ent_reg, device.id, include_disabled_entities=True
            ):
                continue

            _LOGGER.info(
                "Purge %s leeres Gerät %s (%s)",
                "ermittelt:" if dry_run else "entfernt",
                device.id,
                domain_macs,
            )
            if not dry_run:
                dev_reg.async_remove_device(device.id)
            removed += 1

        return removed

    # -- Teardown -----------------------------------------------------------

    async def async_close(self) -> None:
        """Finaler, nicht entprellter Save. Die Session ist geteilt und bleibt."""
        await self.async_save_now()
