"""
Verlauf der WLAN-Signalstärke pro Client.

Bei jeder erfolgreichen Abfrage des Controllers kommt für jeden WLAN-Client,
der gerade gesehen wurde, die Signalstärke (dBm) und der Access Point dazu.
Gespeichert wird in einer eigenen Datei, nicht im Recorder:

- 5-Minuten-Blöcke über 24 Stunden,
- Stunden-Blöcke über 31 Tage (für 7 und 30 Tage).

Ein Block ist [Start, Median, Schlechtester, Bester, Messungen, AP-MAC]. Der
AP ist der, an dem der Client im Block am häufigsten hing. Ist ein Client
nicht im WLAN (Kabel, ausser Haus), entsteht kein Block: im Diagramm eine
Lücke.
"""

from __future__ import annotations

import statistics
import time
from collections import Counter
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_VERSION

BLOCK_SECONDS = 300
HOUR_SECONDS = 3600
KEEP_BLOCKS = 86400
KEEP_HOURS = 31 * 86400
RANGES = {"24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400}
STORE_SUFFIX = "signal"
SAVE_DELAY = 300


def _main_ap(aps: list[str | None]) -> str | None:
    """Häufigster AP; bei Gleichstand der zuletzt genutzte."""
    counts = Counter(a for a in aps if a)
    if not counts:
        return None
    last = {a: i for i, a in enumerate(aps) if a}
    return max(counts, key=lambda a: (counts[a], last[a]))


def block_from(values: list[float], aps: list[str], start: float) -> list[Any]:
    """[Start, Median, Schlechtester, Bester, Messungen, häufigster AP]."""
    return [
        round(start),
        round(statistics.median(values), 1),
        round(min(values), 1),
        round(max(values), 1),
        len(values),
        _main_ap(aps),
    ]


def hour_from(blocks: list[list[Any]], start: float) -> list[Any]:
    """Stunde aus ihren 5-Minuten-Blöcken; AP nach Anzahl Blöcke."""
    return [
        round(start),
        round(statistics.median(b[1] for b in blocks), 1),
        min(b[2] for b in blocks),
        max(b[3] for b in blocks),
        sum(b[4] for b in blocks),
        _main_ap([b[5] for b in blocks]),
    ]


def summarize(blocks: list[list[Any]]) -> dict[str, Any] | None:
    """Median der Block-Mediane, bester und schlechtester Wert, AP-Anteile."""
    if not blocks:
        return None
    aps = Counter(b[5] for b in blocks if b[5])
    total = sum(aps.values())
    return {
        "median": round(statistics.median(b[1] for b in blocks), 1),
        "worst": min(b[2] for b in blocks),
        "best": max(b[3] for b in blocks),
        "samples": sum(b[4] for b in blocks),
        "blocks": len(blocks),
        "aps": [
            {"ap_mac": mac, "share": round(count / total * 100)}
            for mac, count in aps.most_common()
        ]
        if total
        else [],
    }


class SignalLog:
    """WLAN-Signalstärke eines Hubs."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}_{entry_id}_{STORE_SUFFIX}"
        )
        self._blocks: dict[str, list[list[Any]]] = {}
        self._hours: dict[str, list[list[Any]]] = {}
        # Laufender Block pro MAC: [Start, Werte, APs].
        self._open: dict[str, list[Any]] = {}
        # Laufende Stunde pro MAC: [Start, abgeschlossene Blöcke].
        self._open_hour: dict[str, list[Any]] = {}

    # -- Speicher --------------------------------------------------------------

    async def async_load(self) -> None:
        stored = await self._store.async_load() or {}
        self.load(stored, time.time())

    def load(self, stored: dict[str, Any], now: float) -> None:
        def blocks(raw: Any) -> dict[str, list[list[Any]]]:
            return {
                str(mac): [list(b) for b in items if isinstance(b, list) and len(b) == 6]
                for mac, items in (raw or {}).items()
                if isinstance(items, list)
            }

        self._blocks = blocks(stored.get("blocks"))
        self._hours = blocks(stored.get("hours"))
        self._open = {
            str(mac): [o[0], list(o[1]), list(o[2])]
            for mac, o in (stored.get("open") or {}).items()
            if isinstance(o, list) and len(o) == 3
        }
        self._open_hour = {
            str(mac): [o[0], [list(b) for b in o[1]]]
            for mac, o in (stored.get("open_hours") or {}).items()
            if isinstance(o, list) and len(o) == 2
        }
        self.prune(now)

    def data(self) -> dict[str, Any]:
        return {
            "blocks": self._blocks,
            "hours": self._hours,
            "open": self._open,
            "open_hours": self._open_hour,
        }

    def schedule_save(self) -> None:
        self._store.async_delay_save(self.data, SAVE_DELAY)

    async def async_save(self) -> None:
        await self._store.async_save(self.data())

    # -- Aufzeichnen -------------------------------------------------------

    def record(self, mac: str, dbm: float, ap_mac: str | None, now: float) -> None:
        mac = mac.lower()
        start = now - (now % BLOCK_SECONDS)
        current = self._open.get(mac)
        if current is not None and current[0] != start:
            self._close(mac)
            current = None
        if current is None:
            current = [start, [], []]
            self._open[mac] = current
        current[1].append(float(dbm))
        current[2].append(str(ap_mac).lower() if ap_mac else "")

    def _close(self, mac: str) -> None:
        current = self._open.pop(mac, None)
        if current is None or not current[1]:
            return
        block = block_from(current[1], current[2], current[0])
        self._blocks.setdefault(mac, []).append(block)
        hour_start = block[0] - (block[0] % HOUR_SECONDS)
        hour = self._open_hour.get(mac)
        if hour is not None and hour[0] != hour_start:
            self._close_hour(mac)
            hour = None
        if hour is None:
            hour = [hour_start, []]
            self._open_hour[mac] = hour
        hour[1].append(block)

    def _close_hour(self, mac: str) -> None:
        hour = self._open_hour.pop(mac, None)
        if hour is not None and hour[1]:
            self._hours.setdefault(mac, []).append(hour_from(hour[1], hour[0]))

    def prune(self, now: float) -> None:
        for store, keep in ((self._blocks, KEEP_BLOCKS), (self._hours, KEEP_HOURS)):
            limit = now - keep
            for mac in list(store):
                kept = [b for b in store[mac] if b[0] >= limit]
                if kept:
                    store[mac] = kept
                else:
                    store.pop(mac)

    def forget(self, mac: str) -> None:
        """Gepurgter Client: Verlauf verwerfen."""
        mac = mac.lower()
        for store in (self._blocks, self._hours, self._open, self._open_hour):
            store.pop(mac, None)

    # -- Abfragen --------------------------------------------------------------

    def history(self, mac: str, span: str = "24h") -> list[list[Any]]:
        mac = mac.lower()
        current = self._open.get(mac)
        open_block = (
            block_from(current[1], current[2], current[0]) if current and current[1] else None
        )
        if span not in RANGES or span == "24h":
            out = list(self._blocks.get(mac, []))
            if open_block is not None:
                out.append(open_block)
            return out
        limit = time.time() - RANGES[span]
        out = [b for b in self._hours.get(mac, []) if b[0] >= limit]
        hour = self._open_hour.get(mac)
        blocks = list(hour[1]) if hour else []
        hour_start = hour[0] if hour else None
        if open_block is not None:
            start = open_block[0] - (open_block[0] % HOUR_SECONDS)
            if hour_start is not None and hour_start != start and blocks:
                out.append(hour_from(blocks, hour_start))
                blocks = []
            hour_start = start
            blocks.append(open_block)
        if blocks and hour_start is not None:
            out.append(hour_from(blocks, hour_start))
        return out

    def summary(self, mac: str, span: str = "24h") -> dict[str, Any] | None:
        return summarize(self.history(mac, span))
