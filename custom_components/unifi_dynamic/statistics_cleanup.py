"""
Langzeitstatistiken entfernter Entitäten aus dem Recorder löschen.

Sensoren mit "state_class" (hier: die Ping-Sensoren) schreiben Langzeit-
statistiken. Entfernt die Integration die Entität, bleibt die Statistik in
der Datenbank zurück; Home Assistant meldet sie dann als "verwaiste
Langzeitstatistik" (z. B. durch Spook). Deshalb löschen wir sie überall dort
selbst, wo wir Entitäten entfernen, und räumen einmal nach dem Start alte
Reste auf.

Alles bestmöglich: ohne Recorder passiert nichts, Fehler werden nur geloggt.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from datetime import datetime

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Statistiken unserer Sensoren heissen wie die Entität. Verwaist heisst: weder
# in der Entity-Registry noch im Zustandsspeicher. Nur dieses Präfix wird
# angefasst, fremde Statistiken bleiben unberührt.
_STATISTIC_PREFIX = f"sensor.{DOMAIN}_"
_ORPHAN_DELAY = 300  # Sekunden nach dem Start, damit der Start nicht bremst
_ORPHAN_KEY = f"{DOMAIN}_orphan_statistics_scheduled"


def _recorder(hass: HomeAssistant):
    """Recorder-Instanz oder None, wenn er nicht geladen ist."""
    if "recorder" not in hass.config.components:
        return None
    try:
        from homeassistant.components.recorder import get_instance

        return get_instance(hass)
    except Exception:  # noqa: BLE001 (Recorder nicht bereit)
        return None


@callback
def async_clear_statistics(hass: HomeAssistant, entity_ids: Iterable[str]) -> int:
    """Statistiken dieser Entitäten löschen. Gibt die Zahl der Anfragen zurück."""
    ids = sorted({str(e) for e in entity_ids if e})
    if not ids:
        return 0
    recorder = _recorder(hass)
    if recorder is None:
        return 0
    try:
        recorder.async_clear_statistics(ids)
    except Exception:  # noqa: BLE001 (nicht kritisch)
        _LOGGER.debug("Statistiken konnten nicht gelöscht werden", exc_info=True)
        return 0
    _LOGGER.debug("Langzeitstatistiken gelöscht: %s", ", ".join(ids))
    return len(ids)


@callback
def async_clear_entry_statistics(hass: HomeAssistant, entry_id: str) -> int:
    """Statistiken aller Sensoren eines Hubs (beim Entfernen der Integration)."""
    ent_reg = er.async_get(hass)
    return async_clear_statistics(
        hass,
        (
            e.entity_id
            for e in er.async_entries_for_config_entry(ent_reg, entry_id)
            if e.domain == "sensor"
        ),
    )


async def async_clear_orphaned(hass: HomeAssistant) -> int:
    """
    Verwaiste Statistiken unserer Sensoren löschen (Reste früherer Versionen).

    Verwaist: Statistik mit unserem Präfix, aber weder Registry-Eintrag noch
    Zustand. Gibt die Zahl der gelöschten Statistiken zurück.
    """
    recorder = _recorder(hass)
    if recorder is None:
        return 0
    try:
        from homeassistant.components.recorder.statistics import list_statistic_ids

        stats = await recorder.async_add_executor_job(list_statistic_ids, hass)
    except Exception:  # noqa: BLE001 (nicht kritisch)
        _LOGGER.debug("Statistik-Liste nicht lesbar", exc_info=True)
        return 0
    ent_reg = er.async_get(hass)
    orphans = [
        s["statistic_id"]
        for s in stats
        if s.get("source") == "recorder"
        and str(s.get("statistic_id", "")).startswith(_STATISTIC_PREFIX)
        and ent_reg.async_get(s["statistic_id"]) is None
        and hass.states.get(s["statistic_id"]) is None
    ]
    if not orphans:
        return 0
    _LOGGER.info("Verwaiste Langzeitstatistiken gelöscht: %s", len(orphans))
    return async_clear_statistics(hass, orphans)


@callback
def async_schedule_orphan_cleanup(hass: HomeAssistant) -> None:
    """Einmal pro Start (nicht je Hub) kurz nach dem Start aufräumen."""
    if hass.data.get(_ORPHAN_KEY):
        return
    hass.data[_ORPHAN_KEY] = True

    async def _run(_now: datetime) -> None:
        await async_clear_orphaned(hass)

    async_call_later(hass, _ORPHAN_DELAY, _run)
