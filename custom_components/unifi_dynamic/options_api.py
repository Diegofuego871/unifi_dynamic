"""
Einstellungen eines Hubs für das Panel lesen und speichern.

Das Panel bearbeitet dieselben Options wie der Optionsdialog von Home
Assistant, nicht eine Kopie: gespeichert wird über async_update_entry, der
Update-Listener in __init__.py lädt wie gewohnt nur bei geändertem
Abfrageintervall oder geänderter Purge-Zeit neu. Die Wertebereiche stehen
hier einmal und gelten für beide Oberflächen.
"""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CLICK_TARGETS,
    CONF_NOTIFY_CLICK_TARGET,
    CONF_NOTIFY_CONTROLLER_OFFLINE,
    CONF_NOTIFY_NEW_CLIENTS,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_WHEN_EMPTY,
    CONF_OFFLINE_AFTER_FAILURES,
    CONF_PERSISTENT_CONTROLLER_OFFLINE,
    CONF_PERSISTENT_NOTIFICATION,
    CONF_PERSISTENT_WHEN_EMPTY,
    CONF_PING_ENABLED,
    CONF_PING_INTERVAL,
    CONF_PURGE_DAYS,
    CONF_PURGE_EXCLUDE,
    CONF_PURGE_TIME,
    CONF_SCAN_INTERVAL,
    CONF_UPDATE_CHECK,
    DEFAULT_NOTIFY_CLICK_TARGET,
    DEFAULT_NOTIFY_CONTROLLER_OFFLINE,
    DEFAULT_NOTIFY_NEW_CLIENTS,
    DEFAULT_NOTIFY_SERVICE,
    DEFAULT_NOTIFY_WHEN_EMPTY,
    DEFAULT_OFFLINE_AFTER_FAILURES,
    DEFAULT_PERSISTENT_CONTROLLER_OFFLINE,
    DEFAULT_PERSISTENT_NOTIFICATION,
    DEFAULT_PERSISTENT_WHEN_EMPTY,
    DEFAULT_PING_ENABLED,
    DEFAULT_PING_INTERVAL,
    DEFAULT_PURGE_DAYS,
    DEFAULT_PURGE_TIME,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_UPDATE_CHECK,
    DOMAIN,
    MESSAGE_FIELDS,
    NOTIFY_NONE,
)

# Wertebereiche, gemeinsam für Optionsdialog und Panel.
SCAN_INTERVAL_RANGE = (10, 3600)
OFFLINE_AFTER_RANGE = (1, 2880)
PURGE_DAYS_RANGE = (0, 3650)
# Gleicher Wert wie ping.PING_INTERVAL_RANGE (dort ohne Import-Kreis).
PING_INTERVAL_RANGE = (30, 3600)

BOOL_OPTIONS: tuple[tuple[str, bool], ...] = (
    (CONF_NOTIFY_WHEN_EMPTY, DEFAULT_NOTIFY_WHEN_EMPTY),
    (CONF_NOTIFY_NEW_CLIENTS, DEFAULT_NOTIFY_NEW_CLIENTS),
    (CONF_NOTIFY_CONTROLLER_OFFLINE, DEFAULT_NOTIFY_CONTROLLER_OFFLINE),
    *MESSAGE_FIELDS,
    (CONF_PERSISTENT_NOTIFICATION, DEFAULT_PERSISTENT_NOTIFICATION),
    (CONF_PERSISTENT_WHEN_EMPTY, DEFAULT_PERSISTENT_WHEN_EMPTY),
    (CONF_PERSISTENT_CONTROLLER_OFFLINE, DEFAULT_PERSISTENT_CONTROLLER_OFFLINE),
    (CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK),
    (CONF_PING_ENABLED, DEFAULT_PING_ENABLED),
)

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$")
_MAC_RE = re.compile(r"^[0-9a-f]{2}(:[0-9a-f]{2}){5}$")


def _int_or(value: Any, default: int) -> int:
    try:
        return int(default if value is None else value)
    except (TypeError, ValueError):
        return int(default)


def _time(value: Any) -> str:
    match = _TIME_RE.match(str(value or "").strip())
    if not match:
        raise vol.Invalid("Uhrzeit im Format HH:MM erwartet")
    return f"{match.group(1)}:{match.group(2)}:{match.group(3) or '00'}"


def _mac_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        raise vol.Invalid("Liste von MAC-Adressen erwartet")
    out: list[str] = []
    for item in value:
        mac = str(item).strip().lower()
        if not _MAC_RE.match(mac):
            raise vol.Invalid(f"Ungültige MAC-Adresse: {item}")
        if mac not in out:
            out.append(mac)
    return out


def _notify_target(value: Any) -> str:
    text = str(value or "").strip()
    if not text or text == NOTIFY_NONE:
        return NOTIFY_NONE
    if not re.match(r"^notify\.[a-z0-9_]+$", text):
        raise vol.Invalid("notify-Dienst oder notify-Entity erwartet")
    return text


# Flaches Schema für das Speichern aus dem Panel. Alle Felder optional:
# gespeichert wird nur, was mitkommt, der Rest bleibt wie er ist.
PANEL_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_SCAN_INTERVAL): vol.All(
            vol.Coerce(int), vol.Range(*SCAN_INTERVAL_RANGE)
        ),
        vol.Optional(CONF_OFFLINE_AFTER_FAILURES): vol.All(
            vol.Coerce(int), vol.Range(*OFFLINE_AFTER_RANGE)
        ),
        vol.Optional(CONF_PURGE_DAYS): vol.All(
            vol.Coerce(int), vol.Range(*PURGE_DAYS_RANGE)
        ),
        vol.Optional(CONF_PING_INTERVAL): vol.All(
            vol.Coerce(int), vol.Range(*PING_INTERVAL_RANGE)
        ),
        vol.Optional(CONF_PURGE_TIME): _time,
        vol.Optional(CONF_PURGE_EXCLUDE): _mac_list,
        vol.Optional(CONF_NOTIFY_SERVICE): _notify_target,
        vol.Optional(CONF_NOTIFY_CLICK_TARGET): vol.In(CLICK_TARGETS),
        **{vol.Optional(key): bool for key, _default in BOOL_OPTIONS},
    }
)


def current_values(entry: ConfigEntry) -> dict[str, Any]:
    """Alle Einstellungen mit wirksamem Wert (Options, sonst Setup-Daten, sonst Standard)."""
    options = entry.options
    data = entry.data

    def pick(key: str, default: Any) -> Any:
        return options.get(key, data.get(key, default))

    click = options.get(CONF_NOTIFY_CLICK_TARGET)
    values: dict[str, Any] = {
        CONF_SCAN_INTERVAL: _int_or(pick(CONF_SCAN_INTERVAL, None), DEFAULT_SCAN_INTERVAL),
        CONF_OFFLINE_AFTER_FAILURES: _int_or(
            pick(CONF_OFFLINE_AFTER_FAILURES, None), DEFAULT_OFFLINE_AFTER_FAILURES
        ),
        CONF_PURGE_DAYS: _int_or(pick(CONF_PURGE_DAYS, None), DEFAULT_PURGE_DAYS),
        CONF_PURGE_TIME: str(pick(CONF_PURGE_TIME, DEFAULT_PURGE_TIME) or DEFAULT_PURGE_TIME),
        CONF_PURGE_EXCLUDE: [
            str(mac).strip().lower()
            for mac in (options.get(CONF_PURGE_EXCLUDE) or [])
            if str(mac).strip()
        ],
        CONF_NOTIFY_SERVICE: str(
            options.get(CONF_NOTIFY_SERVICE, DEFAULT_NOTIFY_SERVICE) or NOTIFY_NONE
        ),
        CONF_NOTIFY_CLICK_TARGET: click if click in CLICK_TARGETS else DEFAULT_NOTIFY_CLICK_TARGET,
        CONF_PING_INTERVAL: _int_or(options.get(CONF_PING_INTERVAL), DEFAULT_PING_INTERVAL),
    }
    for key, default in BOOL_OPTIONS:
        values[key] = bool(options.get(key, default))
    return values


def notify_targets(hass: HomeAssistant, current: str) -> list[dict[str, str]]:
    """Auswahl der Benachrichtigungsziele, dieselbe wie im Optionsdialog."""
    # Spät importiert: config_flow importiert dieses Modul.
    from .config_flow import _notify_options  # noqa: PLC0415

    targets = [
        {"value": str(opt["value"]), "label": str(opt["label"])}
        for opt in _notify_options(hass)
    ]
    # Ein früher gewähltes Ziel, das es nicht mehr gibt, bleibt wählbar.
    if current not in {t["value"] for t in targets}:
        targets.append({"value": current, "label": current, "missing": "1"})
    return targets


def protected_clients(hass: HomeAssistant, entry: ConfigEntry, macs: list[str]) -> list[dict[str, Any]]:
    """Geschützte Clients mit Anzeigename (sofern noch bekannt)."""
    from .coordinator import preferred_client_name  # noqa: PLC0415

    coordinator = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    cache = (coordinator.data or {}) if coordinator is not None else {}
    return [
        {
            "mac": mac,
            "name": preferred_client_name(cache[mac], mac) if mac in cache else None,
        }
        for mac in macs
    ]


def apply_values(hass: HomeAssistant, entry: ConfigEntry, raw: dict[str, Any]) -> bool:
    """Prüft und speichert. Wirft vol.Invalid bei ungültigen Werten."""
    submitted = PANEL_SCHEMA(raw)
    new_options = {**entry.options, **submitted}
    if new_options == dict(entry.options):
        return False
    hass.config_entries.async_update_entry(entry, options=new_options)
    return True
