"""Langzeitstatistiken entfernter Entitäten werden mitgelöscht (keine verwaisten Reste)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from custom_components.unifi_dynamic import statistics_cleanup
from custom_components.unifi_dynamic.const import DOMAIN

from .test_coordinator import CLIENT, MAC, ONLINE, _mock, _setup


class FakeRecorder:
    """Merkt sich, welche Statistiken gelöscht werden sollen."""

    def __init__(self, statistic_ids: list[dict] | None = None) -> None:
        self.cleared: list[list[str]] = []
        self._ids = statistic_ids or []

    def async_clear_statistics(self, ids: list[str]) -> None:
        self.cleared.append(list(ids))

    async def async_add_executor_job(self, func, *args):  # noqa: ARG002
        return self._ids

    @property
    def flat(self) -> set[str]:
        return {i for batch in self.cleared for i in batch}


def _with_recorder(rec: FakeRecorder):
    return patch.object(statistics_cleanup, "_recorder", return_value=rec)


async def test_clear_without_recorder_does_nothing(hass: HomeAssistant) -> None:
    with patch.object(statistics_cleanup, "_recorder", return_value=None):
        assert statistics_cleanup.async_clear_statistics(hass, ["sensor.x"]) == 0
        assert await statistics_cleanup.async_clear_orphaned(hass) == 0


async def test_clear_passes_sorted_unique_ids(hass: HomeAssistant) -> None:
    rec = FakeRecorder()
    with _with_recorder(rec):
        assert statistics_cleanup.async_clear_statistics(hass, ["sensor.b", "sensor.a", "sensor.b", ""]) == 2
    assert rec.cleared == [["sensor.a", "sensor.b"]]


async def test_recorder_error_is_not_fatal(hass: HomeAssistant) -> None:
    rec = MagicMock()
    rec.async_clear_statistics.side_effect = RuntimeError("boom")
    with _with_recorder(rec):
        assert statistics_cleanup.async_clear_statistics(hass, ["sensor.a"]) == 0


async def test_removing_a_client_clears_its_sensor_statistics(hass: HomeAssistant, aioclient_mock) -> None:
    _mock(aioclient_mock, [CLIENT])
    entry = await _setup(hass)
    ent_reg = er.async_get(hass)
    sensors = {e.entity_id for e in er.async_entries_for_config_entry(ent_reg, entry.entry_id) if e.domain == "sensor"}
    assert sensors, "Test braucht Sensoren"
    rec = FakeRecorder()
    with _with_recorder(rec):
        await hass.services.async_call(DOMAIN, "remove_client", {"mac": MAC, "entry_id": entry.entry_id}, blocking=True)
        await hass.async_block_till_done()
    assert hass.states.get(ONLINE) is None
    assert sensors <= rec.flat, f"nicht gelöscht: {sorted(sensors - rec.flat)}"
    await hass.config_entries.async_unload(entry.entry_id)


async def test_removing_the_hub_clears_all_sensor_statistics(hass: HomeAssistant, aioclient_mock) -> None:
    _mock(aioclient_mock, [CLIENT])
    entry = await _setup(hass)
    ent_reg = er.async_get(hass)
    sensors = {e.entity_id for e in er.async_entries_for_config_entry(ent_reg, entry.entry_id) if e.domain == "sensor"}
    rec = FakeRecorder()
    with _with_recorder(rec):
        await hass.config_entries.async_remove(entry.entry_id)
        await hass.async_block_till_done()
    assert sensors and sensors <= rec.flat, f"nicht gelöscht: {sorted(sensors - rec.flat)}"


async def test_orphans_are_found_and_only_ours(hass: HomeAssistant) -> None:
    stats = [
        {"statistic_id": "sensor.unifi_dynamic_alt_ping", "source": "recorder"},  # verwaist, unser Präfix
        {"statistic_id": "sensor.unifi_dynamic_lebt_ping", "source": "recorder"},  # hat einen Zustand
        {"statistic_id": "sensor.anderer_sensor", "source": "recorder"},  # fremd
        {"statistic_id": "sensor.unifi_dynamic_extern", "source": "sonstige"},  # fremde Quelle
    ]
    hass.states.async_set("sensor.unifi_dynamic_lebt_ping", "5")
    rec = FakeRecorder(stats)
    with _with_recorder(rec):
        assert await statistics_cleanup.async_clear_orphaned(hass) == 1
    assert rec.cleared == [["sensor.unifi_dynamic_alt_ping"]]
