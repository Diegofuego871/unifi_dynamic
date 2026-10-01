"""Coordinator mit echtem Home Assistant: Site, Offline-Schwelle, Last seen, Speichern."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.unifi_dynamic.const import DOMAIN

from .conftest import HOST

MAC = "aa:bb:cc:00:12:34"
CLIENT = {"mac": MAC, "name": "Kamera Garten", "ip": "192.0.2.10", "is_wired": False, "rssi": 40, "signal": -55, "essid": "Netz", "ap_mac": "ap:00"}
LAST_SEEN = "sensor.unifi_dynamic_kamera_garten_1234_last_seen"
ONLINE = "binary_sensor.unifi_dynamic_kamera_garten_1234_online"


def _clients_url(site: str = "default") -> str:
    return f"https://{HOST}/proxy/network/api/s/{site}/stat/sta"


def _devices_url(site: str = "default") -> str:
    return f"https://{HOST}/proxy/network/api/s/{site}/stat/device"


def _mock(aioclient_mock, clients: list[dict], site: str = "default") -> None:
    aioclient_mock.clear_requests()
    aioclient_mock.get(_clients_url(site), json={"data": clients})
    aioclient_mock.get(_devices_url(site), json={"data": [{"mac": "ap:00", "name": "AP Garten"}]})


async def _setup(hass: HomeAssistant, scan_interval: int = 30, data: dict | None = None) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id=HOST,
        title=f"UniFi {HOST}",
        data={"host": HOST, "api_key": "KEY", "verify_ssl": False, **(data or {})},
        options={"scan_interval": scan_interval, "purge_days": 30},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _poll(hass: HomeAssistant, freezer, seconds: int) -> None:
    freezer.tick(timedelta(seconds=seconds))
    async_fire_time_changed(hass, dt_util.utcnow())
    await hass.async_block_till_done()


async def test_site_path_used(hass: HomeAssistant, aioclient_mock) -> None:
    _mock(aioclient_mock, [CLIENT], site="x7k2")
    entry = await _setup(hass, data={"site": "x7k2", "site_name": "Ferienhaus"})
    assert any(str(call[1]).endswith("/api/s/x7k2/stat/sta") for call in aioclient_mock.mock_calls)
    assert hass.states.get(ONLINE).state == "on"
    await hass.config_entries.async_unload(entry.entry_id)


async def test_last_seen_moves_in_5_minute_steps(hass: HomeAssistant, aioclient_mock, freezer) -> None:
    _mock(aioclient_mock, [CLIENT])
    entry = await _setup(hass)
    first = hass.states.get(LAST_SEEN).state
    first_attr = hass.states.get(ONLINE).attributes["last_seen"]

    # Online, 9 Polls à 30 s: weder Sensor noch Attribut ändern sich.
    for k in range(1, 10):
        _mock(aioclient_mock, [{**CLIENT, "rssi": 40 + k}])
        await _poll(hass, freezer, 30)
        assert hass.states.get(LAST_SEEN).state == first
        assert hass.states.get(ONLINE).attributes["last_seen"] == first_attr
        assert hass.states.get(ONLINE).attributes["rssi"] == 40

    # Nach 5 Minuten rückt beides vor, RSSI mit.
    _mock(aioclient_mock, [{**CLIENT, "rssi": 50}])
    await _poll(hass, freezer, 30)
    assert hass.states.get(LAST_SEEN).state != first
    assert hass.states.get(ONLINE).attributes["rssi"] == 50
    stepped = dt_util.parse_datetime(hass.states.get(LAST_SEEN).state)
    assert stepped == dt_util.parse_datetime(first) + timedelta(seconds=300)

    # Client weg: offline erst nach max(60 s, 3 Intervalle) = 90 s, dann exakter letzter Kontakt.
    _mock(aioclient_mock, [{**CLIENT, "rssi": 33}])
    await _poll(hass, freezer, 30)
    last_contact = dt_util.utcnow()
    _mock(aioclient_mock, [])
    for _ in range(3):
        await _poll(hass, freezer, 30)
        assert hass.states.get(ONLINE).state == "on"
    await _poll(hass, freezer, 30)
    assert hass.states.get(ONLINE).state == "off"
    assert dt_util.parse_datetime(hass.states.get(LAST_SEEN).state) == last_contact.replace(microsecond=0) or abs(
        (dt_util.parse_datetime(hass.states.get(LAST_SEEN).state) - last_contact).total_seconds()
    ) < 1
    assert hass.states.get(ONLINE).attributes["rssi"] == 33
    await hass.config_entries.async_unload(entry.entry_id)


async def test_offline_threshold_scales_with_interval(hass: HomeAssistant, aioclient_mock, freezer) -> None:
    _mock(aioclient_mock, [CLIENT])
    entry = await _setup(hass, scan_interval=120)
    _mock(aioclient_mock, [])
    # Ein einzelner verpasster Poll (120 s) genügt nicht mehr: Schwelle 360 s.
    await _poll(hass, freezer, 120)
    assert hass.states.get(ONLINE).state == "on"
    await _poll(hass, freezer, 120)
    await _poll(hass, freezer, 120)
    assert hass.states.get(ONLINE).state == "on"
    await _poll(hass, freezer, 120)
    assert hass.states.get(ONLINE).state == "off"
    await hass.config_entries.async_unload(entry.entry_id)


async def test_history_saved_while_running(hass: HomeAssistant, aioclient_mock, freezer, hass_storage) -> None:
    """Trotz Poll alle 30 s wird der WLAN-Verlauf (Verzögerung 300 s) im Betrieb geschrieben."""
    _mock(aioclient_mock, [CLIENT])
    entry = await _setup(hass)
    key = f"{DOMAIN}_{entry.entry_id}_signal"
    hass_storage.pop(key, None)
    for _ in range(12):  # 6 Minuten, jeder Poll meldet eine Änderung
        await _poll(hass, freezer, 30)
    assert key in hass_storage, "WLAN-Verlauf wurde im laufenden Betrieb nicht gespeichert"
    assert MAC in hass_storage[key]["data"]["blocks"] or MAC in hass_storage[key]["data"]["open"]
    cache_key = f"{DOMAIN}_{entry.entry_id}_cache"
    assert MAC in hass_storage[cache_key]["data"]["client_cache"]
    await hass.config_entries.async_unload(entry.entry_id)
