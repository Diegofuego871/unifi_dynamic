"""
Verbindungsdaten eines Hubs (Host, API-Key, SSL-Prüfung) prüfen und ändern.

Gemeinsame Grundlage für die Einrichtung, "Neu konfigurieren", "Erneut
authentifizieren" und den Verbindungsdialog im Panel. Geändert wird immer der
bestehende Config-Entry: seine ID bleibt, damit bleiben Entitäten, Geräte,
Verknüpfungen, Schutzliste, Verlauf und Einstellungen erhalten.
"""

from __future__ import annotations

import asyncio

from aiohttp import ClientError, ClientTimeout
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_API_KEY, CONF_HOST, CONF_VERIFY_SSL, DOMAIN, SITES_PATH

TEST_TIMEOUT = ClientTimeout(total=20)

# Fehlercodes, gleich benannt wie in strings.json ("config.error").
ERR_INVALID_AUTH = "invalid_auth"
ERR_CANNOT_CONNECT = "cannot_connect"
ERR_ALREADY_CONFIGURED = "already_configured"
ERR_INVALID_HOST = "invalid_host"


class InvalidAuth(Exception):
    """Der Controller lehnt den API-Key ab (HTTP 401/403)."""


class CannotConnect(Exception):
    """Controller nicht erreichbar oder unerwartete Antwort."""


def normalize_host(value: str) -> str:
    """Host ohne Schema, Pfad und Leerzeichen ("https://10.0.0.1/" -> "10.0.0.1")."""
    host = str(value or "").strip()
    for prefix in ("https://", "http://"):
        if host.lower().startswith(prefix):
            host = host[len(prefix):]
    return host.split("/", 1)[0].strip()


async def async_test_connection(
    hass: HomeAssistant, host: str, api_key: str, verify_ssl: bool
) -> None:
    """Wirft InvalidAuth oder CannotConnect, wenn es nicht klappt."""
    session = async_get_clientsession(hass, verify_ssl=verify_ssl)
    url = f"https://{host}{SITES_PATH}"
    try:
        async with session.get(
            url,
            headers={"X-API-KEY": api_key, "Accept": "application/json"},
            timeout=TEST_TIMEOUT,
        ) as resp:
            if resp.status in (401, 403):
                raise InvalidAuth(f"HTTP {resp.status}")
            if resp.status >= 400:
                raise CannotConnect(f"HTTP {resp.status}")
    except (asyncio.TimeoutError, ClientError, ValueError) as err:
        raise CannotConnect(str(err) or type(err).__name__) from err


async def async_check(
    hass: HomeAssistant, host: str, api_key: str, verify_ssl: bool
) -> str | None:
    """Wie async_test_connection, aber mit Fehlercode statt Exception."""
    try:
        await async_test_connection(hass, host, api_key, verify_ssl)
    except InvalidAuth:
        return ERR_INVALID_AUTH
    except CannotConnect:
        return ERR_CANNOT_CONNECT
    return None


def host_taken(hass: HomeAssistant, host: str, own_entry_id: str | None) -> bool:
    """True, wenn ein anderer Hub bereits diesen Host verwendet."""
    wanted = host.lower()
    return any(
        entry.entry_id != own_entry_id
        and (entry.unique_id or str(entry.data.get(CONF_HOST, "")).lower()) == wanted
        for entry in hass.config_entries.async_entries(DOMAIN)
    )


def updated_title(entry: ConfigEntry, new_host: str) -> str:
    """Titel mitziehen, solange er noch der automatisch vergebene ist."""
    old_host = str(entry.data.get(CONF_HOST, ""))
    if entry.title == f"UniFi {old_host}":
        return f"UniFi {new_host}"
    return entry.title


async def async_apply(
    hass: HomeAssistant,
    entry: ConfigEntry,
    host: str,
    api_key: str | None,
    verify_ssl: bool,
) -> str | None:
    """
    Prüft und übernimmt neue Verbindungsdaten, danach Reload.

    api_key None oder leer heisst: bisherigen Key behalten. Gibt einen
    Fehlercode zurück oder None bei Erfolg; bei einem Fehler bleibt alles
    unverändert.
    """
    host = normalize_host(host)
    if not host:
        return ERR_INVALID_HOST
    if host_taken(hass, host, entry.entry_id):
        return ERR_ALREADY_CONFIGURED
    key = (api_key or "").strip() or str(entry.data.get(CONF_API_KEY, ""))
    error = await async_check(hass, host, key, verify_ssl)
    if error:
        return error
    hass.config_entries.async_update_entry(
        entry,
        unique_id=host.lower(),
        title=updated_title(entry, host),
        data={**entry.data, CONF_HOST: host, CONF_API_KEY: key, CONF_VERIFY_SSL: verify_ssl},
    )
    hass.async_create_task(hass.config_entries.async_reload(entry.entry_id))
    return None
