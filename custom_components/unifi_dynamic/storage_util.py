"""
Verzögertes Speichern, das auch bei laufenden Änderungen zuverlässig schreibt.

Store.async_delay_save von Home Assistant entprellt: jeder weitere Aufruf
verschiebt den Termin. Kommen Änderungen häufiger als die Verzögerung (Poll
alle 30 s, Verzögerung 300 s), wird während des Betriebs nie geschrieben,
nur beim Beenden von Home Assistant. Ein Absturz oder Stromausfall verlöre
dann alles seit dem Start.

PeriodicSaver plant deshalb nur einmal und lässt weitere Aufrufe bis zum
Schreiben aus: geschrieben wird spätestens delay Sekunden nach der ersten
Änderung, mit dem Stand zum Zeitpunkt des Schreibens.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from homeassistant.core import callback
from homeassistant.helpers.storage import Store


class PeriodicSaver:
    """Schreibt spätestens delay Sekunden nach der ersten ungespeicherten Änderung."""

    def __init__(
        self, store: Store[Any], data_func: Callable[[], Any], delay: float
    ) -> None:
        self._store = store
        self._data_func = data_func
        self._delay = delay
        self._pending = False

    @property
    def store(self) -> Store[Any]:
        return self._store

    @callback
    def schedule(self) -> None:
        """Änderung melden; plant höchstens einen Schreibvorgang."""
        if self._pending:
            return
        self._pending = True
        self._store.async_delay_save(self._collect, self._delay)

    @callback
    def _collect(self) -> Any:
        # Wird von Store beim Schreiben aufgerufen (auch beim Beenden von HA):
        # ab hier plant die nächste Änderung wieder neu.
        self._pending = False
        return self._data_func()

    async def async_save(self) -> None:
        """Sofort schreiben, etwa beim Entladen."""
        # async_save verwirft einen geplanten Termin: Flag mit zurücksetzen,
        # sonst würde nie wieder geplant.
        self._pending = False
        await self._store.async_save(self._data_func())
