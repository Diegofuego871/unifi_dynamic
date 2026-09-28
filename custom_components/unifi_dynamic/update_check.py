"""
Versionsprüfung für die Einstellungen im Panel.

Die installierte Version kommt aus dem Manifest der laufenden Integration,
die neueste aus den GitHub-Releases des Repositories. Das ist der Rückfall,
wenn HACS fehlt, und ergänzt HACS, das nur alle paar Tage prüft. Auf Wunsch
prüft die Integration täglich selbst und meldet eine neue Version unter
"Reparaturen". Installiert wird hier nichts: das bleibt HACS (update.install)
vorbehalten.
"""

from __future__ import annotations

import asyncio
import random
import time
from datetime import timedelta
from typing import Any

from aiohttp import ClientError, ClientTimeout
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.loader import async_get_integration

from .const import CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK, DOMAIN, GITHUB_REPO

LATEST_RELEASE_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
# GitHub erlaubt ohne Anmeldung 60 Abfragen pro Stunde und IP: ohne
# ausdrücklichen Wunsch höchstens alle 6 Stunden, auf Knopfdruck höchstens
# einmal pro Minute.
CACHE_SECONDS = 6 * 3600
FORCE_MIN_SECONDS = 60
TIMEOUT = ClientTimeout(total=10)

_CACHE_KEY = f"{DOMAIN}_latest_release"
_TIMER_KEY = f"{DOMAIN}_update_timer"
ISSUE_ID = "update_available"
DAILY = timedelta(days=1)
# Erste Prüfung nach dem Start zufällig verteilt, damit nicht alle
# Installationen zur selben Zeit bei GitHub anfragen.
FIRST_CHECK_DELAY = (5 * 60, 65 * 60)


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


def compare_versions(a: str | None, b: str | None) -> int:
    """1, wenn a neuer ist als b; -1, wenn älter; 0 bei Gleichstand."""

    def parts(value: str | None) -> list[int]:
        text = str(value or "").strip().lstrip("vV")
        out: list[int] = []
        for piece in text.replace("-", ".").replace("+", ".").split("."):
            digits = "".join(ch for ch in piece if ch.isdigit())
            out.append(int(digits) if digits else 0)
        return out

    x, y = parts(a), parts(b)
    for i in range(max(len(x), len(y))):
        left = x[i] if i < len(x) else 0
        right = y[i] if i < len(y) else 0
        if left != right:
            return 1 if left > right else -1
    return 0


def _enabled(hass: HomeAssistant) -> bool:
    """An, sobald mindestens ein Hub die tägliche Prüfung eingeschaltet hat."""
    return any(
        bool(coordinator.entry.options.get(CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK))
        for coordinator in hass.data.get(DOMAIN, {}).values()
    )


async def async_refresh_issue(
    hass: HomeAssistant, release: dict[str, Any] | None = None
) -> None:
    """
    Meldung unter "Reparaturen" anlegen oder entfernen.

    Ist die Prüfung aus, verschwindet eine bestehende Meldung. Ohne gültige
    Antwort von GitHub bleibt der bisherige Zustand stehen.
    """
    if not _enabled(hass):
        ir.async_delete_issue(hass, DOMAIN, ISSUE_ID)
        return
    installed = await async_installed_version(hass)
    if release is None:
        release = await async_latest_release(hass)
    latest = release.get("latest")
    if not installed or not latest:
        return
    if compare_versions(latest, installed) > 0:
        ir.async_create_issue(
            hass,
            DOMAIN,
            ISSUE_ID,
            is_fixable=False,
            is_persistent=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key=ISSUE_ID,
            translation_placeholders={"installed": installed, "latest": latest},
            learn_more_url=release.get("release_url") or f"https://github.com/{GITHUB_REPO}/releases",
        )
    else:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_ID)


@callback
def async_start_daily(hass: HomeAssistant) -> None:
    """Tägliche Prüfung starten (einmal für alle Hubs)."""
    if _TIMER_KEY in hass.data:
        return
    unsubs: list[Any] = []

    async def _run(_now: Any = None) -> None:
        await async_refresh_issue(hass)

    async def _first(_now: Any) -> None:
        await _run()
        unsubs.append(async_track_time_interval(hass, _run, DAILY))

    unsubs.append(async_call_later(hass, random.randint(*FIRST_CHECK_DELAY), _first))
    hass.data[_TIMER_KEY] = unsubs


@callback
def async_stop_daily(hass: HomeAssistant) -> None:
    """Beim Entladen des letzten Hubs: Zeitgeber und Meldung entfernen."""
    for unsub in hass.data.pop(_TIMER_KEY, []):
        unsub()
    ir.async_delete_issue(hass, DOMAIN, ISSUE_ID)
