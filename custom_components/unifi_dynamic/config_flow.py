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
    CLICK_TARGETS,
    CONF_API_KEY,
    CONF_HOST,
    CONF_NOTIFY_CLICK_TARGET,
    CONF_NOTIFY_CONTROLLER_OFFLINE,
    CONF_NOTIFY_NEW_CLIENTS,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_WHEN_EMPTY,
    CONF_OFFLINE_AFTER_FAILURES,
    CONF_PERSISTENT_CONTROLLER_OFFLINE,
    CONF_PERSISTENT_NOTIFICATION,
    CONF_PERSISTENT_WHEN_EMPTY,
    CONF_PURGE_DAYS,
    CONF_PURGE_EXCLUDE,
    CONF_PURGE_TIME,
    CONF_SCAN_INTERVAL,
    CONF_VERIFY_SSL,
    DEFAULT_NOTIFY_CLICK_TARGET,
    DEFAULT_NOTIFY_CONTROLLER_OFFLINE,
    DEFAULT_NOTIFY_NEW_CLIENTS,
    DEFAULT_NOTIFY_SERVICE,
    DEFAULT_NOTIFY_WHEN_EMPTY,
    DEFAULT_OFFLINE_AFTER_FAILURES,
    DEFAULT_PERSISTENT_CONTROLLER_OFFLINE,
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
from .coordinator import preferred_client_name

# Options-Keys aus früheren Versionen, die beim Speichern verworfen werden.
OBSOLETE_OPTIONS = ("notification_icon", "icon_url")

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


def _client_options(
    hass: HomeAssistant, entry_id: str, selected: list[str]
) -> list[selector.SelectOptionDict]:
    """
    Auswahlliste aller von der Integration verwalteten Clients.

    Gefüllt aus dem Client-Cache des Coordinators. Bereits ausgewählte MACs,
    die dort nicht mehr stehen, bleiben wählbar, damit sie beim Speichern
    nicht still verloren gehen.
    """
    coordinator = hass.data.get(DOMAIN, {}).get(entry_id)
    clients: dict[str, str] = {}

    if coordinator is not None:
        for mac, data in (coordinator.data or {}).items():
            clients[str(mac).lower()] = preferred_client_name(data or {}, mac)

    options = [
        selector.SelectOptionDict(value=mac, label=f"{name} ({mac})")
        for mac, name in sorted(clients.items(), key=lambda item: item[1].lower())
    ]

    known = set(clients)
    for mac in selected:
        mac_l = str(mac).strip().lower()
        if mac_l and mac_l not in known:
            options.append(
                selector.SelectOptionDict(
                    value=mac_l, label=f"{mac_l} (nicht mehr bekannt)"
                )
            )

    return options


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
        if user_input is not None:
            submitted = _flatten(user_input)

            # Bestehende Options erhalten, statt sie komplett zu ersetzen.
            data = {**self.config_entry.options, **submitted}
            # Mehrfachauswahl: leere Auswahl muss die alte überschreiben.
            data[CONF_PURGE_EXCLUDE] = [
                str(mac).strip().lower()
                for mac in submitted.get(CONF_PURGE_EXCLUDE, []) or []
                if str(mac).strip()
            ]
            for key in OBSOLETE_OPTIONS:
                data.pop(key, None)
            return self.async_create_entry(title="", data=data)

        return self.async_show_form(
            step_id="init",
            data_schema=self._build_schema({**self.config_entry.options}),
        )

    def _build_schema(self, current: dict[str, Any]) -> vol.Schema:
        """Baut das Optionsformular aus den aktuellen bzw. eingegebenen Werten."""
        data = self.config_entry.data

        scan_default = _int_or(
            current.get(CONF_SCAN_INTERVAL),
            _int_or(data.get(CONF_SCAN_INTERVAL), DEFAULT_SCAN_INTERVAL),
        )
        offline_after_default = _int_or(
            current.get(CONF_OFFLINE_AFTER_FAILURES),
            _int_or(
                data.get(CONF_OFFLINE_AFTER_FAILURES),
                DEFAULT_OFFLINE_AFTER_FAILURES,
            ),
        )
        purge_default = _int_or(
            current.get(CONF_PURGE_DAYS),
            _int_or(data.get(CONF_PURGE_DAYS), DEFAULT_PURGE_DAYS),
        )
        purge_time_default = str(
            current.get(CONF_PURGE_TIME, data.get(CONF_PURGE_TIME, DEFAULT_PURGE_TIME))
            or DEFAULT_PURGE_TIME
        )
        excluded_default = [
            str(mac).strip().lower()
            for mac in (current.get(CONF_PURGE_EXCLUDE) or [])
            if str(mac).strip()
        ]
        client_options = _client_options(
            self.hass, self.config_entry.entry_id, excluded_default
        )

        notify_default = str(
            current.get(CONF_NOTIFY_SERVICE, DEFAULT_NOTIFY_SERVICE) or NOTIFY_NONE
        )

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
            # Klickziel direkt unter dem Ziel-Dienst: beides betrifft, wo die
            # Meldung ankommt und wohin sie führt.
            vol.Required(
                CONF_NOTIFY_CLICK_TARGET,
                default=(
                    current.get(CONF_NOTIFY_CLICK_TARGET)
                    if current.get(CONF_NOTIFY_CLICK_TARGET) in CLICK_TARGETS
                    else DEFAULT_NOTIFY_CLICK_TARGET
                ),
            ): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=list(CLICK_TARGETS),
                    mode=selector.SelectSelectorMode.DROPDOWN,
                    translation_key=CONF_NOTIFY_CLICK_TARGET,
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
            vol.Required(
                CONF_NOTIFY_CONTROLLER_OFFLINE,
                default=bool(
                    current.get(
                        CONF_NOTIFY_CONTROLLER_OFFLINE,
                        DEFAULT_NOTIFY_CONTROLLER_OFFLINE,
                    )
                ),
            ): bool,
        }
        push_fields.update(
            {
                vol.Required(key, default=bool(current.get(key, default))): bool
                for key, default in MESSAGE_FIELDS
            }
        )
        return vol.Schema(
            {
                vol.Required(SECTION_POLLING): section(
                    vol.Schema(
                        {
                            vol.Required(
                                CONF_SCAN_INTERVAL, default=scan_default
                            ): vol.All(vol.Coerce(int), vol.Range(min=10, max=3600)),
                            vol.Required(
                                CONF_OFFLINE_AFTER_FAILURES,
                                default=offline_after_default,
                            ): vol.All(vol.Coerce(int), vol.Range(min=1, max=2880)),
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
                            vol.Optional(
                                CONF_PURGE_EXCLUDE, default=excluded_default
                            ): selector.SelectSelector(
                                selector.SelectSelectorConfig(
                                    options=client_options,
                                    multiple=True,
                                    mode=selector.SelectSelectorMode.DROPDOWN,
                                    sort=False,
                                )
                            ),
                        }
                    ),
                    {"collapsed": True},
                ),
                vol.Required(SECTION_PUSH): section(
                    vol.Schema(push_fields), {"collapsed": True}
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
                            vol.Required(
                                CONF_PERSISTENT_CONTROLLER_OFFLINE,
                                default=bool(
                                    current.get(
                                        CONF_PERSISTENT_CONTROLLER_OFFLINE,
                                        DEFAULT_PERSISTENT_CONTROLLER_OFFLINE,
                                    )
                                ),
                            ): bool,
                        }
                    ),
                    {"collapsed": True},
                ),
            }
        )
