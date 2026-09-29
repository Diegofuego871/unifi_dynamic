"""
Antwortzeit der Clients per Ping (ICMP).

Pingt in einem festen Intervall alle Clients, die laut UniFi gerade online
sind und eine IP haben - die IP kommt aus UniFi, damit klappt es auch mit
DHCP ohne Pflege. Pro Client und Runde gehen mehrere Pings raus; die Werte
landen in 5-Minuten-Blöcken (24 Stunden, eigene Datei) für das Panel. Die
Entitäten (Ping, Paketverlust) jedes Clients zeigen den letzten
abgeschlossenen 5-Minuten-Block und ändern sich damit höchstens alle 5 Minuten.

Kennzahlen:
- Median statt Mittelwert: ein einzelner Ausreisser (Handy wacht gerade auf)
  verzerrt ihn nicht.
- Schwankung (Jitter): mittlere Differenz aufeinanderfolgender Antwortzeiten.
- Paketverlust in Prozent.

Viele Geräte antworten grundsätzlich nicht auf Ping (Windows-Firewall,
schlafende Handys und IoT-Geräte, Firewall zwischen VLANs). Das ist kein
Fehler und wird als "antwortet nicht auf Ping" geführt.

Ping braucht entweder Root-Rechte oder die Freigabe für unprivilegierten
Ping im System. Fehlt beides, bleibt die Messung aus und das Panel zeigt
einen Hinweis (status "permission").
"""

from __future__ import annotations

import logging
import statistics
import time
from collections.abc import Callable
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store

from .const import (
    CONF_PING_ENABLED,
    CONF_PING_INTERVAL,
    DEFAULT_PING_ENABLED,
    DEFAULT_PING_INTERVAL,
    DOMAIN,
    PING_BUCKET_SECONDS,
    PING_CONCURRENCY,
    PING_COUNT,
    PING_HOUR_SECONDS,
    PING_HOURLY_KEEP_SECONDS,
    PING_KEEP_SECONDS,
    PING_RANGES,
    PING_SAVE_DELAY,
    PING_SPACING,
    PING_STORE_SUFFIX,
    PING_TIMEOUT,
    STORAGE_VERSION,
)
# Wertebereich des Intervalls, gemeinsam für Optionsdialog und Panel.
from .options_api import PING_INTERVAL_RANGE

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry

    from .coordinator import UnifiDynamicCoordinator

_LOGGER = logging.getLogger(__name__)


STATUS_DISABLED = "disabled"
STATUS_STARTING = "starting"
STATUS_OK = "ok"
STATUS_PERMISSION = "permission"
STATUS_UNAVAILABLE = "unavailable"

# Entitäten pro Client (Schlüssel in unique_id und entity_id).
PING_ENTITY_KINDS = ("ping", "packet_loss")


# Zustand eines Clients
CLIENT_OK = "ok"
CLIENT_NO_REPLY = "no_reply"


def ping_enabled(entry: ConfigEntry) -> bool:
    return bool(entry.options.get(CONF_PING_ENABLED, DEFAULT_PING_ENABLED))


def ping_interval(entry: ConfigEntry) -> int:
    try:
        value = int(entry.options.get(CONF_PING_INTERVAL, DEFAULT_PING_INTERVAL))
    except (TypeError, ValueError):
        value = DEFAULT_PING_INTERVAL
    low, high = PING_INTERVAL_RANGE
    return min(high, max(low, value))


# -- Kennzahlen (rein, ohne Home Assistant; auch für Tests) --------------------


def jitter(rtts: list[float]) -> float | None:
    """Mittlere Differenz aufeinanderfolgender Antwortzeiten."""
    if len(rtts) < 2:
        return None
    return sum(abs(b - a) for a, b in zip(rtts, rtts[1:])) / (len(rtts) - 1)


def bucket_from(rtts: list[float], sent: int, received: int, start: float) -> list[Any]:
    """Block als Liste: [Start, Median, Jitter, gesendet, empfangen]."""
    return [
        round(start),
        round(statistics.median(rtts), 2) if rtts else None,
        round(jitter(rtts), 2) if jitter(rtts) is not None else None,
        int(sent),
        int(received),
    ]


def hour_from(hour: list[Any]) -> list[Any]:
    """Stunden-Block aus [Start, Block-Mediane, Block-Jitter, gesendet, empfangen]."""
    return [
        round(hour[0]),
        round(statistics.median(hour[1]), 2) if hour[1] else None,
        round(sum(hour[2]) / len(hour[2]), 2) if hour[2] else None,
        int(hour[3]),
        int(hour[4]),
    ]


def summarize(buckets: list[list[Any]]) -> dict[str, Any] | None:
    """
    Zusammenfassung über mehrere Blöcke.

    Median: Median der Block-Mediane (jeder Block zählt gleich, egal wie viele
    Antworten er hatte). Schwankung: Mittel der Block-Werte. Verlust: über alle
    gesendeten Pings.
    """
    sent = sum(b[3] for b in buckets)
    if not sent:
        return None
    received = sum(b[4] for b in buckets)
    medians = [b[1] for b in buckets if b[1] is not None]
    jitters = [b[2] for b in buckets if b[2] is not None]
    return {
        "median": round(statistics.median(medians), 1) if medians else None,
        "jitter": round(sum(jitters) / len(jitters), 1) if jitters else None,
        "loss": round((1 - received / sent) * 100, 1),
        "sent": sent,
        "received": received,
        "status": CLIENT_OK if received else CLIENT_NO_REPLY,
    }


# -- Messung ------------------------------------------------------------------


class PingMonitor:
    """Ping-Messung eines Hubs."""

    def __init__(self, hass: HomeAssistant, coordinator: UnifiDynamicCoordinator) -> None:
        self.hass = hass
        self.coordinator = coordinator
        self.entry = coordinator.entry
        self.status = STATUS_DISABLED if not ping_enabled(self.entry) else STATUS_STARTING
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}_{self.entry.entry_id}_{PING_STORE_SUFFIX}"
        )
        # Abgeschlossene Blöcke pro MAC, älteste zuerst.
        self._buckets: dict[str, list[list[Any]]] = {}
        # Laufender Block pro MAC: [Start, Antwortzeiten, gesendet, empfangen].
        self._open: dict[str, list[Any]] = {}
        # Stunden-Blöcke für 7 und 30 Tage, gleiches Format wie die 5-Minuten-
        # Blöcke. Daraus statt aus allen Pings: 30 Tage in 5-Minuten-Auflösung
        # wären bei vielen Clients eine zu grosse Datei.
        self._hourly: dict[str, list[list[Any]]] = {}
        # Laufende Stunde pro MAC: [Start, Block-Mediane, Block-Jitter,
        # gesendet, empfangen].
        self._open_hour: dict[str, list[Any]] = {}
        # Letzte Runde pro MAC, für das Panel.
        self._last: dict[str, dict[str, Any]] = {}
        # Werte der Entitäten pro MAC: letzter abgeschlossener 5-Minuten-Block.
        # Ändert sich nur alle 5 Minuten statt jede Runde: weniger Zustände im
        # Recorder, und der Median über 5 Minuten ist aussagekräftiger.
        self._entity: dict[str, dict[str, Any]] = {}
        self._privileged: bool | None = None
        self._unsub: Callable[[], None] | None = None
        self._listeners: list[Callable[[], None]] = []
        self._running = False
        self.last_round: float | None = None

    # -- Lebenszyklus ------------------------------------------------------

    async def async_start(self) -> None:
        if not ping_enabled(self.entry):
            self.status = STATUS_DISABLED
            return
        stored = await self._store.async_load() or {}
        self._load(stored, time.time())
        self.status = await self._async_detect()
        if self.status != STATUS_OK:
            _LOGGER.warning(
                "Ping-Messung nicht möglich (%s): Home Assistant darf keine "
                "ICMP-Pakete senden",
                self.status,
            )
            return
        self._unsub = async_track_time_interval(
            self.hass,
            self._async_tick,
            timedelta(seconds=ping_interval(self.entry)),
            name=f"{DOMAIN} ping {self.entry.entry_id}",
        )
        # Erste Runde kurz nach dem Start, nicht erst nach einem Intervall.
        self.hass.async_create_background_task(
            self._async_round(), f"{DOMAIN} ping first round"
        )

    async def async_stop(self) -> None:
        if self._unsub is not None:
            self._unsub()
            self._unsub = None
        if self.status == STATUS_OK:
            await self._store.async_save(self._store_data())

    async def _async_detect(self) -> str:
        """Wie die Ping-Integration von HA: erst unprivilegiert, dann privilegiert."""
        try:
            from icmplib import (  # noqa: PLC0415
                SocketPermissionError,
                async_ping,
            )
        except ImportError:
            return STATUS_UNAVAILABLE
        for privileged in (False, True):
            try:
                await async_ping("127.0.0.1", count=0, timeout=0, privileged=privileged)
            except SocketPermissionError:
                continue
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Ping-Test fehlgeschlagen: %s", err)
                continue
            self._privileged = privileged
            return STATUS_OK
        return STATUS_PERMISSION

    # -- Abonnenten (Entitäten) ------------------------------------------------

    @callback
    def async_add_listener(self, target: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(target)

        @callback
        def _remove() -> None:
            if target in self._listeners:
                self._listeners.remove(target)

        return _remove

    # -- Runde -----------------------------------------------------------------

    async def _async_tick(self, _now: Any = None) -> None:
        await self._async_round()

    def _targets(self) -> dict[str, list[str]]:
        """IP -> MACs aller Clients, die online sind und eine IP haben."""
        targets: dict[str, list[str]] = {}
        for row in self.coordinator.panel_clients():
            ip = row.get("ip")
            if row.get("online") and ip:
                targets.setdefault(str(ip), []).append(row["mac"])
        return targets

    async def _async_round(self) -> None:
        if self._running or self.status != STATUS_OK:
            return
        self._running = True
        try:
            from icmplib import async_multiping  # noqa: PLC0415

            targets = self._targets()
            now = time.time()
            results: dict[str, Any] = {}
            if targets:
                try:
                    hosts = await async_multiping(
                        list(targets),
                        count=PING_COUNT,
                        interval=PING_SPACING,
                        timeout=PING_TIMEOUT,
                        concurrent_tasks=PING_CONCURRENCY,
                        privileged=bool(self._privileged),
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning("Ping-Runde fehlgeschlagen: %s", err)
                    return
                results = {host.address: host for host in hosts}
            self._record(targets, results, now)
            self.last_round = now
            changed = self._update_entities(now)
        finally:
            self._running = False
        # Entitäten nur schreiben, wenn sich ihr Wert geändert hat.
        if changed:
            for target in list(self._listeners):
                target()

    def _record(self, targets: dict[str, list[str]], results: dict[str, Any], now: float) -> None:
        pinged: set[str] = set()
        for ip, macs in targets.items():
            host = results.get(ip)
            if host is None:
                continue
            rtts = [float(r) for r in (host.rtts or [])]
            sent = int(host.packets_sent)
            received = int(host.packets_received)
            for mac in macs:
                pinged.add(mac)
                self._add(mac, rtts, sent, received, now)
                self._last[mac] = {
                    "at": now,
                    "ip": ip,
                    "median": round(statistics.median(rtts), 1) if rtts else None,
                    "jitter": round(jitter(rtts), 1) if jitter(rtts) is not None else None,
                    "loss": round((1 - received / sent) * 100, 1) if sent else None,
                }
        # Nicht (mehr) gepingte Clients: letzte Runde verwerfen, damit die
        # Entität nicht einen alten Wert als aktuell zeigt.
        for mac in list(self._last):
            if mac not in pinged:
                self._last.pop(mac)
        self._prune(now)
        self._store.async_delay_save(self._store_data, PING_SAVE_DELAY)

    def _update_entities(self, now: float) -> bool:
        """
        Werte der Entitäten aus dem letzten abgeschlossenen 5-Minuten-Block.

        Abgelaufene laufende Blöcke werden hier abgeschlossen, auch von Clients,
        die nicht mehr gepingt werden. Ein Client zählt nur, solange er in
        dieser Runde gepingt wurde und sein letzter Block frisch ist (höchstens
        ein Intervall plus einen Block alt); sonst ist die Entität unbekannt.
        Rückgabe: ob sich ein Wert geändert hat.
        """
        start = now - (now % PING_BUCKET_SECONDS)
        for mac in [m for m, o in self._open.items() if o[0] != start]:
            self._close(mac)
        oldest = start - PING_BUCKET_SECONDS - ping_interval(self.entry)
        values: dict[str, dict[str, Any]] = {}
        for mac, last in self._last.items():
            buckets = self._buckets.get(mac)
            if not buckets or buckets[-1][0] < oldest:
                continue
            summary = summarize([buckets[-1]])
            if summary is None:
                continue
            values[mac] = {
                "median": summary["median"],
                "jitter": summary["jitter"],
                "loss": summary["loss"],
                "ip": last.get("ip"),
            }
        changed = values != self._entity
        self._entity = values
        return changed

    def _add(self, mac: str, rtts: list[float], sent: int, received: int, now: float) -> None:
        start = now - (now % PING_BUCKET_SECONDS)
        current = self._open.get(mac)
        if current is not None and current[0] != start:
            self._close(mac)
            current = None
        if current is None:
            current = [start, [], 0, 0]
            self._open[mac] = current
        current[1].extend(rtts)
        current[2] += sent
        current[3] += received

    def _close(self, mac: str) -> None:
        current = self._open.pop(mac, None)
        if current is None or not current[2]:
            return
        bucket = bucket_from(current[1], current[2], current[3], current[0])
        self._buckets.setdefault(mac, []).append(bucket)
        self._feed_hour(mac, bucket)

    def _feed_hour(self, mac: str, bucket: list[Any]) -> None:
        """Fertigen 5-Minuten-Block in die laufende Stunde übernehmen."""
        start = bucket[0] - (bucket[0] % PING_HOUR_SECONDS)
        hour = self._open_hour.get(mac)
        if hour is not None and hour[0] != start:
            self._close_hour(mac)
            hour = None
        if hour is None:
            hour = [start, [], [], 0, 0]
            self._open_hour[mac] = hour
        if bucket[1] is not None:
            hour[1].append(bucket[1])
        if bucket[2] is not None:
            hour[2].append(bucket[2])
        hour[3] += bucket[3]
        hour[4] += bucket[4]

    def _close_hour(self, mac: str) -> None:
        hour = self._open_hour.pop(mac, None)
        if hour is not None and hour[3]:
            self._hourly.setdefault(mac, []).append(hour_from(hour))

    def _prune(self, now: float) -> None:
        for store, keep in ((self._buckets, PING_KEEP_SECONDS), (self._hourly, PING_HOURLY_KEEP_SECONDS)):
            limit = now - keep
            for mac in list(store):
                kept = [b for b in store[mac] if b[0] >= limit]
                if kept:
                    store[mac] = kept
                else:
                    store.pop(mac)

    def _load(self, stored: dict[str, Any], now: float) -> None:
        def blocks(raw: Any) -> dict[str, list[list[Any]]]:
            return {
                str(mac): [list(b) for b in items if isinstance(b, list) and len(b) == 5]
                for mac, items in (raw or {}).items()
                if isinstance(items, list)
            }

        self._buckets = blocks(stored.get("buckets"))
        self._hourly = blocks(stored.get("hourly"))
        self._open = {
            str(mac): [o[0], list(o[1]), int(o[2]), int(o[3])]
            for mac, o in (stored.get("open") or {}).items()
            if isinstance(o, list) and len(o) == 4
        }
        self._open_hour = {
            str(mac): [o[0], list(o[1]), list(o[2]), int(o[3]), int(o[4])]
            for mac, o in (stored.get("open_hours") or {}).items()
            if isinstance(o, list) and len(o) == 5
        }
        if "hourly" not in stored:
            # Stand von 2.14.0/2.14.1: nur 5-Minuten-Blöcke. Die Stunden
            # daraus nachbilden, damit 7 und 30 Tage nicht leer beginnen.
            for mac, items in self._buckets.items():
                for bucket in sorted(items, key=lambda b: b[0]):
                    self._feed_hour(mac, bucket)
        self._prune(now)

    def _store_data(self) -> dict[str, Any]:
        # Laufende Blöcke roh mitspeichern: nach einem Neustart geht es in
        # denselben Block weiter, statt ihn doppelt anzulegen.
        return {
            "buckets": {mac: list(items) for mac, items in self._buckets.items()},
            "hourly": {mac: list(items) for mac, items in self._hourly.items()},
            "open": {mac: list(o) for mac, o in self._open.items() if o[2]},
            "open_hours": {mac: list(o) for mac, o in self._open_hour.items() if o[3]},
        }

    # -- Abfragen --------------------------------------------------------------

    def history(self, mac: str, span: str = "24h") -> list[list[Any]]:
        """
        Blöcke des Zeitraums inkl. laufendem Block.

        24 Stunden in 5-Minuten-Blöcken, 7 und 30 Tage in Stunden-Blöcken.
        """
        mac = mac.lower()
        current = self._open.get(mac)
        open_block = (
            bucket_from(current[1], current[2], current[3], current[0])
            if current is not None and current[2]
            else None
        )
        if span not in PING_RANGES or span == "24h":
            out = list(self._buckets.get(mac, []))
            if open_block is not None:
                out.append(open_block)
            return out
        limit = time.time() - PING_RANGES[span]
        out = [b for b in self._hourly.get(mac, []) if b[0] >= limit]
        # Laufende Stunde samt laufendem Block, damit die letzte Stunde nicht fehlt.
        hour = self._open_hour.get(mac)
        hour = [hour[0], list(hour[1]), list(hour[2]), hour[3], hour[4]] if hour else None
        if open_block is not None:
            start = open_block[0] - (open_block[0] % PING_HOUR_SECONDS)
            if hour is None or hour[0] != start:
                if hour is not None and hour[3]:
                    out.append(hour_from(hour))
                hour = [start, [], [], 0, 0]
            if open_block[1] is not None:
                hour[1].append(open_block[1])
            if open_block[2] is not None:
                hour[2].append(open_block[2])
            hour[3] += open_block[3]
            hour[4] += open_block[4]
        if hour is not None and hour[3]:
            out.append(hour_from(hour))
        return out

    def summary(self, mac: str, span: str = "24h") -> dict[str, Any] | None:
        return summarize(self.history(mac, span))

    def last(self, mac: str) -> dict[str, Any] | None:
        """Letzte Runde (Panel)."""
        return self._last.get(mac.lower())

    def entity_values(self, mac: str) -> dict[str, Any] | None:
        """Letzter abgeschlossener 5-Minuten-Block (Entitäten)."""
        return self._entity.get(mac.lower())
