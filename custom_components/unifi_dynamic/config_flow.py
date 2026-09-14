"""Config- und Options-Flow der Integration "UniFi Dynamic Clients"."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from aiohttp import ClientTimeout
from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_API_KEY,
    CONF_HOST,
    CONF_ICON_URL,
    CONF_NOTIFY_NEW_CLIENTS,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_WHEN_EMPTY,
    CONF_PERSISTENT_NOTIFICATION,
    CONF_PERSISTENT_WHEN_EMPTY,
    CONF_PURGE_DAYS,
    CONF_PURGE_TIME,
    CONF_SCAN_INTERVAL,
    CONF_VERIFY_SSL,
    DEFAULT_ICON_URL,
    DEFAULT_NOTIFY_NEW_CLIENTS,
    DEFAULT_NOTIFY_SERVICE,
    DEFAULT_NOTIFY_WHEN_EMPTY,
    DEFAULT_PERSISTENT_NOTIFICATION,
    DEFAULT_PERSISTENT_WHEN_EMPTY,
    DEFAULT_PURGE_DAYS,
    DEFAULT_PURGE_TIME,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_VERIFY_SSL,
    DOMAIN,
    MESSAGE_FIELDS,
    NOTIFY_NONE,
    SITES_PATH,
)

# Options-Keys aus früheren Versionen, die beim Speichern verworfen werden.
OBSOLETE_OPTIONS = ("notification_icon",)

# Abschnitte im Optionsformular. Sie gruppieren nur die Anzeige; gespeichert
# werden die Options weiterhin flach, damit der restliche Code unverändert
# bleibt und bestehende Einstellungen weiter gelesen werden.
SECTION_POLLING = "polling"
SECTION_CLEANUP = "cleanup"
SECTION_PUSH = "push"
SECTION_PERSISTENT = "persistent"

SECTIONS = (
    SECTION_POLLING,
    SECTION_CLEANUP,
    SECTION_PUSH,
    SECTION_PERSISTENT,
)


def _flatten(user_input: dict[str, Any]) -> dict[str, Any]:
    """Hebt die Abschnittsebene auf, die das Formular einzieht."""
    flat: dict[str, Any] = {}
    for key, value in user_input.items():
        if key in SECTIONS and isinstance(value, dict):
            flat.update(value)
        else:
            flat[key] = value
    return flat

# Beispiel, das im UI als Hilfetext erscheint.
ICON_URL_EXAMPLE = "/local/pic/unifi_dynamic_logo.png"

# Dateisystempfade, die Benutzer erfahrungsgemäss statt der URL eintragen.
FILESYSTEM_PREFIXES = ("/config/www/", "/homeassistant/www/", "/usr/share/hassio/homeassistant/www/")


def _validate_icon_url(value: str) -> str | None:
    """Gibt einen Fehlerschlüssel zurück, wenn die Bild-URL nicht ladbar ist."""
    if not value:
        return None

    if value.lower().startswith(FILESYSTEM_PREFIXES):
        return "icon_url_filesystem_path"

    if not value.startswith(("/", "http://", "https://")):
        return "icon_url_invalid"

    return None

TEST_TIMEOUT = ClientTimeout(total=20)


async def _test_connection(
    hass: HomeAssistant, host: str, api_key: str, verify_ssl: bool
) -> None:
    """Wirft eine Exception, wenn Host oder API-Key nicht funktionieren."""
    session = async_get_clientsession(hass, verify_ssl=verify_ssl)
    url = f"https://{host}{SITES_PATH}"

    async with session.get(
        url,
        headers={"X-API-KEY": api_key, "Accept": "application/json"},
        timeout=TEST_TIMEOUT,
    ) as resp:
        if resp.status >= 400:
            text = await resp.text()
            raise ConnectionError(f"HTTP {resp.status}: {text[:200]}")


def _notify_options(hass: HomeAssistant) -> list[selector.SelectOptionDict]:
    """
    Baut die Auswahlliste der Benachrichtigungsziele.

    Enthält klassische notify-Services (dazu gehören notify-Gruppen) und, falls
    vorhanden, notify-Entities der neuen Plattform.
    """
    options: list[selector.SelectOptionDict] = [
        selector.SelectOptionDict(
            value=NOTIFY_NONE, label="Keine Push-Benachrichtigung"
        )
    ]

    try:
        services = hass.services.async_services_for_domain("notify")
    except AttributeError:  # ältere Home-Assistant-Versionen
        services = hass.services.async_services().get("notify", {})

    known: set[str] = set()
    for name in sorted(services):
        if name in ("send_message", "persistent_notification"):
            continue
        value = f"notify.{name}"
        known.add(value)
        options.append(selector.SelectOptionDict(value=value, label=value))

    for entity_id in sorted(hass.states.async_entity_ids("notify")):
        if entity_id not in known:
            options.append(
                selector.SelectOptionDict(value=entity_id, label=f"{entity_id} (Entity)")
            )

    return options


def _int_or(value: Any, default: int) -> int:
    try:
        if value is None:
            return int(default)
        return int(value)
    except (TypeError, ValueError):
        return int(default)


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Erstkonfiguration."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            host = str(user_input[CONF_HOST]).strip()
            api_key = str(user_input[CONF_API_KEY]).strip()
            verify_ssl = bool(user_input.get(CONF_VERIFY_SSL, DEFAULT_VERIFY_SSL))

            # Verhindert, dass derselbe Host zweimal eingerichtet wird.
            await self.async_set_unique_id(host.lower())
            self._abort_if_unique_id_configured()

            try:
                await _test_connection(self.hass, host, api_key, verify_ssl)
            except Exception:  # noqa: BLE001
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(
                    title=f"UniFi {host}",
                    data={
                        CONF_HOST: host,
                        CONF_API_KEY: api_key,
                        CONF_VERIFY_SSL: verify_ssl,
                    },
                    options={
                        CONF_SCAN_INTERVAL: _int_or(
                            user_input.get(CONF_SCAN_INTERVAL), DEFAULT_SCAN_INTERVAL
                        ),
                        CONF_PURGE_DAYS: _int_or(
                            user_input.get(CONF_PURGE_DAYS), DEFAULT_PURGE_DAYS
                        ),
                    },
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_HOST): str,
                vol.Required(CONF_API_KEY): str,
                vol.Optional(CONF_VERIFY_SSL, default=DEFAULT_VERIFY_SSL): bool,
                vol.Optional(
                    CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL
                ): vol.All(vol.Coerce(int), vol.Range(min=10, max=3600)),
                vol.Optional(CONF_PURGE_DAYS, default=DEFAULT_PURGE_DAYS): vol.All(
                    vol.Coerce(int), vol.Range(min=0, max=3650)
                ),
            }
        )

        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> OptionsFlowHandler:
        return OptionsFlowHandler()


class OptionsFlowHandler(config_entries.OptionsFlow):
    """
    Optionen.

    Kein eigenes __init__: self.config_entry wird vom Framework gesetzt und ist
    read-only. Der Reload nach dem Speichern läuft über den Update-Listener in
    __init__.py. Auf Home Assistant ab 2025.7 kann alternativ von
    OptionsFlowWithReload abgeleitet und der Listener entfernt werden.
    """

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        errors: dict[str, str] = {}
        current: dict[str, Any] = {**self.config_entry.options}

        if user_input is not None:
            submitted = _flatten(user_input)
            current.update(submitted)

            icon_url = str(submitted.get(CONF_ICON_URL, "") or "").strip()
            error = _validate_icon_url(icon_url)

            if error:
                # Bewusst als Formularfehler und nicht am Feld: das Feld steckt
                # im eingeklappten Abschnitt und wäre sonst unsichtbar.
                errors["base"] = error
            else:
                # Bestehende Options erhalten, statt sie komplett zu ersetzen.
                data = {**self.config_entry.options, **submitted}
                # Leerbares Feld: fehlt es im Ergebnis, wurde es bewusst gelöscht.
                data[CONF_ICON_URL] = icon_url
                for key in OBSOLETE_OPTIONS:
                    data.pop(key, None)
                return self.async_create_entry(title="", data=data)

        return self.async_show_form(
            step_id="init",
            data_schema=self._build_schema(current, expand_push=bool(errors)),
            errors=errors,
        )

    def _build_schema(
        self, current: dict[str, Any], expand_push: bool = False
    ) -> vol.Schema:
        """Baut das Optionsformular aus den aktuellen bzw. eingegebenen Werten."""
        data = self.config_entry.data

        scan_default = _int_or(
            current.get(CONF_SCAN_INTERVAL),
            _int_or(data.get(CONF_SCAN_INTERVAL), DEFAULT_SCAN_INTERVAL),
        )
        purge_default = _int_or(
            current.get(CONF_PURGE_DAYS),
            _int_or(data.get(CONF_PURGE_DAYS), DEFAULT_PURGE_DAYS),
        )
        purge_time_default = str(
            current.get(CONF_PURGE_TIME, data.get(CONF_PURGE_TIME, DEFAULT_PURGE_TIME))
            or DEFAULT_PURGE_TIME
        )
        notify_default = str(
            current.get(CONF_NOTIFY_SERVICE, DEFAULT_NOTIFY_SERVICE) or NOTIFY_NONE
        )
        icon_url_default = str(current.get(CONF_ICON_URL, DEFAULT_ICON_URL) or "")

        notify_options = _notify_options(self.hass)
        # Ein früher gewähltes Ziel, das aktuell nicht existiert, bleibt
        # wählbar, statt beim Öffnen der Optionen still zurückgesetzt zu werden.
        if notify_default not in {option["value"] for option in notify_options}:
            notify_options.append(
                selector.SelectOptionDict(
                    value=notify_default, label=f"{notify_default} (nicht gefunden)"
                )
            )

        # Ziel, Auslöser und Inhalt der Push stehen zusammen in einem
        # Abschnitt. Verschachtelte Abschnitte erlaubt Home Assistant nicht.
        push_fields: dict[Any, Any] = {
            vol.Required(
                CONF_NOTIFY_SERVICE, default=notify_default
            ): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=notify_options,
                    mode=selector.SelectSelectorMode.DROPDOWN,
                    custom_value=True,
                    sort=False,
                )
            ),
            vol.Required(
                CONF_NOTIFY_WHEN_EMPTY,
                default=bool(
                    current.get(CONF_NOTIFY_WHEN_EMPTY, DEFAULT_NOTIFY_WHEN_EMPTY)
                ),
            ): bool,
            vol.Required(
                CONF_NOTIFY_NEW_CLIENTS,
                default=bool(
                    current.get(CONF_NOTIFY_NEW_CLIENTS, DEFAULT_NOTIFY_NEW_CLIENTS)
                ),
            ): bool,
        }
        push_fields.update(
            {
                vol.Required(key, default=bool(current.get(key, default))): bool
                for key, default in MESSAGE_FIELDS
            }
        )
        push_fields[
            vol.Optional(
                CONF_ICON_URL,
                description={"suggested_value": icon_url_default or None},
            )
        ] = selector.TextSelector(
            selector.TextSelectorConfig(type=selector.TextSelectorType.TEXT)
        )

        return vol.Schema(
            {
                vol.Required(SECTION_POLLING): section(
                    vol.Schema(
                        {
                            vol.Required(
                                CONF_SCAN_INTERVAL, default=scan_default
                            ): vol.All(vol.Coerce(int), vol.Range(min=10, max=3600)),
                        }
                    ),
                    {"collapsed": True},
                ),
                vol.Required(SECTION_CLEANUP): section(
                    vol.Schema(
                        {
                            vol.Required(
                                CONF_PURGE_DAYS, default=purge_default
                            ): vol.All(vol.Coerce(int), vol.Range(min=0, max=3650)),
                            vol.Required(
                                CONF_PURGE_TIME, default=purge_time_default
                            ): selector.TimeSelector(),
                        }
                    ),
                    {"collapsed": True},
                ),
                vol.Required(SECTION_PUSH): section(
                    vol.Schema(push_fields),
                    # Bei einem Fehler in der Bild-URL aufklappen, damit das
                    # Feld sichtbar ist.
                    {"collapsed": not expand_push},
                ),
                vol.Required(SECTION_PERSISTENT): section(
                    vol.Schema(
                        {
                            vol.Required(
                                CONF_PERSISTENT_NOTIFICATION,
                                default=bool(
                                    current.get(
                                        CONF_PERSISTENT_NOTIFICATION,
                                        DEFAULT_PERSISTENT_NOTIFICATION,
                                    )
                                ),
                            ): bool,
                            vol.Required(
                                CONF_PERSISTENT_WHEN_EMPTY,
                                default=bool(
                                    current.get(
                                        CONF_PERSISTENT_WHEN_EMPTY,
                                        DEFAULT_PERSISTENT_WHEN_EMPTY,
                                    )
                                ),
                            ): bool,
                        }
                    ),
                    {"collapsed": True},
                ),
            }
        )
