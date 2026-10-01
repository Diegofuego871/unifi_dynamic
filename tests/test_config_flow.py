"""Einrichtung, Site-Auswahl und "Neu konfigurieren"."""

from __future__ import annotations

from unittest.mock import patch

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.unifi_dynamic.const import DOMAIN

from .conftest import HOST, SITES_URL, sites_payload

USER_INPUT = {"host": f"https://{HOST}/", "api_key": "KEY", "verify_ssl": False, "scan_interval": 30, "purge_days": 30}


def _no_setup():
    return patch("custom_components.unifi_dynamic.async_setup_entry", return_value=True)


async def _start(hass: HomeAssistant):
    return await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})


async def test_single_site_creates_entry_without_site_step(hass: HomeAssistant, aioclient_mock) -> None:
    aioclient_mock.get(SITES_URL, json=sites_payload(("default", "Default")))
    result = await _start(hass)
    with _no_setup():
        result = await hass.config_entries.flow.async_configure(result["flow_id"], USER_INPUT)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == f"UniFi {HOST}"
    assert result["data"] == {"host": HOST, "api_key": "KEY", "verify_ssl": False}
    assert result["result"].unique_id == HOST


async def test_unreadable_sites_fall_back_to_default(hass: HomeAssistant, aioclient_mock) -> None:
    aioclient_mock.get(SITES_URL, text="kein json")
    result = await _start(hass)
    with _no_setup():
        result = await hass.config_entries.flow.async_configure(result["flow_id"], USER_INPUT)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert "site" not in result["data"]


async def test_several_sites_ask_for_site(hass: HomeAssistant, aioclient_mock) -> None:
    aioclient_mock.get(SITES_URL, json=sites_payload(("default", "Default"), ("x7k2", "Ferienhaus")))
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], USER_INPUT)
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "site"
    with _no_setup():
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {"site": "x7k2"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == f"UniFi {HOST} · Ferienhaus"
    assert result["data"]["site"] == "x7k2"
    assert result["data"]["site_name"] == "Ferienhaus"
    assert result["result"].unique_id == f"{HOST}/x7k2"


async def test_same_host_other_site_allowed_same_site_aborts(hass: HomeAssistant, aioclient_mock) -> None:
    MockConfigEntry(domain=DOMAIN, unique_id=HOST, data={"host": HOST, "api_key": "K"}).add_to_hass(hass)
    aioclient_mock.get(SITES_URL, json=sites_payload(("default", "Default"), ("x7k2", "Ferienhaus")))

    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], USER_INPUT)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"site": "default"})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "already_configured"

    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], USER_INPUT)
    with _no_setup():
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {"site": "x7k2"})
    assert result["type"] is FlowResultType.CREATE_ENTRY


async def test_invalid_auth_shows_error(hass: HomeAssistant, aioclient_mock) -> None:
    aioclient_mock.get(SITES_URL, status=401)
    result = await _start(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], USER_INPUT)
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "invalid_auth"}


async def test_reconfigure_to_other_site(hass: HomeAssistant, aioclient_mock) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN, unique_id=HOST, title=f"UniFi {HOST}", data={"host": HOST, "api_key": "OLD", "verify_ssl": False}
    )
    entry.add_to_hass(hass)
    aioclient_mock.get(SITES_URL, json=sites_payload(("default", "Default"), ("x7k2", "Ferienhaus")))
    result = await entry.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"host": HOST, "verify_ssl": False})
    assert result["step_id"] == "reconfigure_site"
    with _no_setup():
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {"site": "x7k2"})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    assert entry.data == {"host": HOST, "api_key": "OLD", "verify_ssl": False, "site": "x7k2", "site_name": "Ferienhaus"}
    assert entry.unique_id == f"{HOST}/x7k2"
    assert entry.title == f"UniFi {HOST} · Ferienhaus"


async def test_reconfigure_back_to_default_drops_site(hass: HomeAssistant, aioclient_mock) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id=f"{HOST}/x7k2",
        title=f"UniFi {HOST} · Ferienhaus",
        data={"host": HOST, "api_key": "OLD", "verify_ssl": False, "site": "x7k2", "site_name": "Ferienhaus"},
    )
    entry.add_to_hass(hass)
    aioclient_mock.get(SITES_URL, json=sites_payload(("default", "Default"), ("x7k2", "Ferienhaus")))
    result = await entry.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"host": HOST, "verify_ssl": False})
    with _no_setup():
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {"site": "default"})
    assert result["reason"] == "reconfigure_successful"
    assert "site" not in entry.data and "site_name" not in entry.data
    assert entry.unique_id == HOST
    assert entry.title == f"UniFi {HOST}"
