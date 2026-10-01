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

from .const import (
    CONF_API_KEY,
    CONF_HOST,
    CONF_SITE,
    CONF_SITE_NAME,
    CONF_VERIFY_SSL,
    DEFAULT_SITE,
    DOMAIN,
    SITES_PATH,
)

TEST_TIMEOUT = ClientTimeout(total=20)

# Fehlercodes, gleich benannt wie in strings.json ("config.error").
ERR_INVALID_AUTH = "invalid_auth"
ERR_CANNOT_CONNECT = "cannot_connect"
ERR_ALREADY_CONFIGURED = "already_configured"
ERR_INVALID_HOST = "invalid_host"
ERR_SITE_NOT_FOUND = "site_not_found"


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


def parse_sites(payload: object) -> list[dict[str, str]]:
    """
    Sites aus der Antwort der Integration-API: [{"site", "name"}, ...].

    "site" ist die interne Bezeichnung (internalReference), die auch im Pfad
    der klassischen API steht. Unbekanntes Format: leere Liste, dann gilt
    "default".
    """
    items = payload.get("data") if isinstance(payload, dict) else None
    sites: list[dict[str, str]] = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        ref = str(item.get("internalReference") or "").strip()
        if not ref or any(s["site"] == ref for s in sites):
            continue
        sites.append({"site": ref, "name": str(item.get("name") or ref)})
    return sites


async def async_test_connection(
    hass: HomeAssistant, host: str, api_key: str, verify_ssl: bool
) -> list[dict[str, str]]:
    """
    Prüft Host und API-Key und liefert die Sites des Controllers.

    Wirft InvalidAuth oder CannotConnect, wenn es nicht klappt. Eine Antwort
    ohne lesbare Site-Liste gilt als Erfolg mit leerer Liste.
    """
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
            try:
                payload = await resp.json(content_type=None)
            except ValueError:
                payload = None
    except (asyncio.TimeoutError, ClientError, ValueError) as err:
        raise CannotConnect(str(err) or type(err).__name__) from err
    return parse_sites(payload)


async def async_check(
    hass: HomeAssistant, host: str, api_key: str, verify_ssl: bool
) -> tuple[str | None, list[dict[str, str]]]:
    """Wie async_test_connection, aber mit Fehlercode statt Exception."""
    try:
        sites = await async_test_connection(hass, host, api_key, verify_ssl)
    except InvalidAuth:
        return ERR_INVALID_AUTH, []
    except CannotConnect:
        return ERR_CANNOT_CONNECT, []
    return None, sites


def entry_site(entry: ConfigEntry) -> str:
    """Site eines Hubs; Hubs von vor 2.16.0 nutzen "default"."""
    return str(entry.data.get(CONF_SITE) or DEFAULT_SITE)


def unique_id_for(host: str, site: str) -> str:
    """
    Unique-ID eines Hubs: der Host, bei einer anderen Site als "default"
    zusätzlich "/<site>". So bleiben bestehende Hubs unverändert, und
    mehrere Sites desselben Controllers sind getrennte Hubs.
    """
    host_l = host.lower()
    return host_l if site == DEFAULT_SITE else f"{host_l}/{site}"


def host_taken(
    hass: HomeAssistant, host: str, own_entry_id: str | None, site: str = DEFAULT_SITE
) -> bool:
    """True, wenn ein anderer Hub bereits diesen Host mit dieser Site verwendet."""
    wanted = unique_id_for(host, site)
    return any(
        entry.entry_id != own_entry_id
        and unique_id_for(str(entry.data.get(CONF_HOST, "")), entry_site(entry)) == wanted
        for entry in hass.config_entries.async_entries(DOMAIN)
    )


def default_title(host: str, site: str = DEFAULT_SITE, site_name: str | None = None) -> str:
    """Automatischer Titel: "UniFi <host>", bei einer anderen Site mit deren Namen."""
    if site == DEFAULT_SITE:
        return f"UniFi {host}"
    return f"UniFi {host} · {site_name or site}"


def updated_title(
    entry: ConfigEntry, new_host: str, site: str | None = None, site_name: str | None = None
) -> str:
    """Titel mitziehen, solange er noch der automatisch vergebene ist."""
    old_host = str(entry.data.get(CONF_HOST, ""))
    old_site = entry_site(entry)
    old_name = entry.data.get(CONF_SITE_NAME)
    if entry.title in (f"UniFi {old_host}", default_title(old_host, old_site, old_name)):
        new_site = site or old_site
        return default_title(new_host, new_site, site_name if site else old_name)
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
    site = entry_site(entry)
    if host_taken(hass, host, entry.entry_id, site):
        return ERR_ALREADY_CONFIGURED
    key = (api_key or "").strip() or str(entry.data.get(CONF_API_KEY, ""))
    error, sites = await async_check(hass, host, key, verify_ssl)
    if error:
        return error
    # Die Site wird hier nicht gewählt (dafür "Neu konfigurieren"); sie muss
    # es auf dem neuen Host aber geben.
    if sites and not any(s["site"] == site for s in sites):
        return ERR_SITE_NOT_FOUND
    hass.config_entries.async_update_entry(
        entry,
        unique_id=unique_id_for(host, site),
        title=updated_title(entry, host),
        data={**entry.data, CONF_HOST: host, CONF_API_KEY: key, CONF_VERIFY_SSL: verify_ssl},
    )
    hass.async_create_task(hass.config_entries.async_reload(entry.entry_id))
    return None
