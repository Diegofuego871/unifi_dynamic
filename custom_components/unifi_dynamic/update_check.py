"""
Versionsprüfung für die Einstellungen im Panel.

Die installierte Version kommt aus dem Manifest der laufenden Integration,
die neueste aus den GitHub-Releases des Repositories. Das ist der Rückfall,
wenn HACS fehlt, und ergänzt HACS, das nur periodisch prüft. Installiert wird
hier nichts: das bleibt HACS (update.install) vorbehalten.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

from aiohttp import ClientError, ClientTimeout
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_integration

from .const import DOMAIN, GITHUB_REPO

LATEST_RELEASE_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
# GitHub erlaubt ohne Anmeldung 60 Abfragen pro Stunde und IP: ohne
# ausdrücklichen Wunsch höchstens alle 6 Stunden, auf Knopfdruck höchstens
# einmal pro Minute.
CACHE_SECONDS = 6 * 3600
FORCE_MIN_SECONDS = 60
TIMEOUT = ClientTimeout(total=10)

_CACHE_KEY = f"{DOMAIN}_latest_release"


async def async_installed_version(hass: HomeAssistant) -> str | None:
    """Version der laufenden Integration (nicht der Dateien auf der Platte)."""
    integration = await async_get_integration(hass, DOMAIN)
    return str(integration.version) if integration.version else None


async def async_latest_release(hass: HomeAssistant, force: bool = False) -> dict[str, Any]:
    """Neuestes veröffentlichtes Release (ohne Pre-Releases), zwischengespeichert."""
    cached: dict[str, Any] | None = hass.data.get(_CACHE_KEY)
    now = time.time()
    if cached:
        age = now - cached["checked_at"]
        # Nach einem Fehler früher erneut versuchen (5 Minuten).
        limit = FORCE_MIN_SECONDS if force else (300 if cached.get("error") else CACHE_SECONDS)
        if age < limit:
            return cached

    result: dict[str, Any] = {"checked_at": now, "latest": None, "release_url": None, "error": None}
    try:
        session = async_get_clientsession(hass)
        async with session.get(
            LATEST_RELEASE_URL,
            headers={"Accept": "application/vnd.github+json"},
            timeout=TIMEOUT,
        ) as resp:
            if resp.status >= 400:
                result["error"] = f"HTTP {resp.status}"
            else:
                data = await resp.json(content_type=None)
                tag = str(data.get("tag_name") or "").strip()
                result["latest"] = tag[1:] if tag[:1] in ("v", "V") else tag or None
                result["release_url"] = data.get("html_url")
    except (asyncio.TimeoutError, ClientError, ValueError) as err:
        result["error"] = str(err) or type(err).__name__

    # Bei einem Fehler den letzten guten Stand behalten, nur den Fehler zeigen.
    if result["error"] and cached and cached.get("latest"):
        result = {**cached, "error": result["error"], "checked_at": now}
    hass.data[_CACHE_KEY] = result
    return result
