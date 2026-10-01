"""Config- und Options-Flow der Integration "UniFi Dynamic Clients"."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector

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
    CONF_PING_ENABLED,
    CONF_PING_INTERVAL,
    CONF_PURGE_DAYS,
    CONF_PURGE_EXCLUDE,
    CONF_PURGE_TIME,
    CONF_SCAN_INTERVAL,
    CONF_SITE,
    CONF_SITE_NAME,
    CONF_UPDATE_CHECK,
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
    DEFAULT_PING_ENABLED,
    DEFAULT_PING_INTERVAL,
    DEFAULT_PURGE_DAYS,
    DEFAULT_PURGE_TIME,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_SITE,
    DEFAULT_UPDATE_CHECK,
    DEFAULT_VERIFY_SSL,
    DOMAIN,
    MESSAGE_FIELDS,
    NOTIFY_NONE,
)
from . import connection, msg
from .coordinator import preferred_client_name
from .options_api import (
    OFFLINE_AFTER_RANGE,
    PING_INTERVAL_RANGE,
    PURGE_DAYS_RANGE,
    SCAN_INTERVAL_RANGE,
)

# Options-Keys aus früheren Versionen, die beim Speichern verworfen werden.
OBSOLETE_OPTIONS = ("notification_icon", "icon_url")

# Abschnitte im Optionsformular. Sie gruppieren nur die Anzeige; gespeichert
# werden die Options weiterhin flach, damit der restliche Code unverändert
# bleibt und bestehende Einstellungen weiter gelesen werden.
SECTION_POLLING = "polling"
SECTION_CLEANUP = "cleanup"
SECTION_PUSH = "push"
SECTION_PERSISTENT = "persistent"
SECTION_UPDATES = "updates"
SECTION_PING = "ping"

SECTIONS = (
    SECTION_POLLING,
    SECTION_CLEANUP,
    SECTION_PUSH,
    SECTION_PERSISTENT,
    SECTION_UPDATES,
    SECTION_PING,
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



async def _test_connection(
    hass: HomeAssistant, host: str, api_key: str, verify_ssl: bool
) -> None:
    """Wirft eine Exception, wenn Host oder API-Key nicht funktionieren."""
    await connection.async_test_connection(hass, host, api_key, verify_ssl)


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
    unknown = msg.label(msg.hass_language(hass), "client_unknown")
    for mac in selected:
        mac_l = str(mac).strip().lower()
        if mac_l and mac_l not in known:
            options.append(
                selector.SelectOptionDict(value=mac_l, label=f"{mac_l} ({unknown})")
            )

    return options


def _notify_options(hass: HomeAssistant) -> list[selector.SelectOptionDict]:
    """
    Baut die Auswahlliste der Benachrichtigungsziele.

    Enthält klassische notify-Services (dazu gehören notify-Gruppen) und, falls
    vorhanden, notify-Entities der neuen Plattform.
    """
    lang = msg.hass_language(hass)
    options: list[selector.SelectOptionDict] = [
        selector.SelectOptionDict(value=NOTIFY_NONE, label=msg.label(lang, "notify_none"))
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
                selector.SelectOptionDict(
                    value=entity_id, label=f"{entity_id} ({msg.label(lang, 'notify_entity')})"
                )
            )

    return options


def _int_or(value: Any, default: int) -> int:
    try:
        if value is None:
            return int(default)
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def _site_schema(sites: list[dict[str, str]], default: str | None) -> vol.Schema:
    """Auswahl der Site, Anzeigename mit interner Bezeichnung."""
    options = [
        selector.SelectOptionDict(
            value=s["site"],
            label=s["name"] if s["name"] == s["site"] else f"{s['name']} ({s['site']})",
        )
        for s in sites
    ]
    known = {s["site"] for s in sites}
    return vol.Schema(
        {
            vol.Required(
                CONF_SITE, default=default if default in known else sites[0]["site"]
            ): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=options,
                    mode=selector.SelectSelectorMode.LIST,
                    sort=False,
                )
            )
        }
    )


def _site_name(sites: list[dict[str, str]], site: str) -> str:
    return next((s["name"] for s in sites if s["site"] == site), site)


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Erstkonfiguration."""

    VERSION = 1

    def __init__(self) -> None:
        # Zwischenstand zwischen Verbindungs- und Site-Schritt.
        self._pending: dict[str, Any] = {}
        self._sites: list[dict[str, str]] = []

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            host = connection.normalize_host(user_input[CONF_HOST])
            api_key = str(user_input[CONF_API_KEY]).strip()
            verify_ssl = bool(user_input.get(CONF_VERIFY_SSL, DEFAULT_VERIFY_SSL))

            error, sites = await connection.async_check(self.hass, host, api_key, verify_ssl)
            if error:
                errors["base"] = error
            else:
                self._pending = {
                    CONF_HOST: host,
                    CONF_API_KEY: api_key,
                    CONF_VERIFY_SSL: verify_ssl,
                    CONF_SCAN_INTERVAL: _int_or(
                        user_input.get(CONF_SCAN_INTERVAL), DEFAULT_SCAN_INTERVAL
                    ),
                    CONF_PURGE_DAYS: _int_or(
                        user_input.get(CONF_PURGE_DAYS), DEFAULT_PURGE_DAYS
                    ),
                }
                self._sites = sites
                # Mehrere Sites: wählen lassen. Eine oder keine lesbare:
                # diese bzw. "default", ohne weiteren Schritt.
                if len(sites) > 1:
                    return await self.async_step_site()
                site = sites[0]["site"] if sites else DEFAULT_SITE
                return await self._async_create(site, _site_name(sites, site))

        schema = vol.Schema(
            {
                vol.Required(CONF_HOST): str,
                vol.Required(CONF_API_KEY): str,
                vol.Optional(CONF_VERIFY_SSL, default=DEFAULT_VERIFY_SSL): bool,
                vol.Optional(
                    CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL
                ): vol.All(vol.Coerce(int), vol.Range(*SCAN_INTERVAL_RANGE)),
                vol.Optional(CONF_PURGE_DAYS, default=DEFAULT_PURGE_DAYS): vol.All(
                    vol.Coerce(int), vol.Range(*PURGE_DAYS_RANGE)
                ),
            }
        )

        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    async def async_step_site(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Site wählen, wenn der Controller mehrere hat."""
        if user_input is not None:
            site = str(user_input[CONF_SITE])
            return await self._async_create(site, _site_name(self._sites, site))
        return self.async_show_form(
            step_id="site",
            data_schema=_site_schema(self._sites, DEFAULT_SITE),
            description_placeholders={"host": self._pending[CONF_HOST]},
        )

    async def _async_create(
        self, site: str, site_name: str
    ) -> config_entries.ConfigFlowResult:
        host = self._pending[CONF_HOST]
        # Pro Host und Site nur ein Hub.
        await self.async_set_unique_id(connection.unique_id_for(host, site))
        self._abort_if_unique_id_configured()
        data = {
            CONF_HOST: host,
            CONF_API_KEY: self._pending[CONF_API_KEY],
            CONF_VERIFY_SSL: self._pending[CONF_VERIFY_SSL],
        }
        if site != DEFAULT_SITE:
            data[CONF_SITE] = site
            data[CONF_SITE_NAME] = site_name
        return self.async_create_entry(
            title=connection.default_title(host, site, site_name),
            data=data,
            options={
                CONF_SCAN_INTERVAL: self._pending[CONF_SCAN_INTERVAL],
                CONF_PURGE_DAYS: self._pending[CONF_PURGE_DAYS],
            },
        )

    # -- Erneut authentifizieren (API-Key ungültig) ------------------------

    async def async_step_reauth(
        self, entry_data: dict[str, Any]
    ) -> config_entries.ConfigFlowResult:
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        entry = self._get_reauth_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            api_key = str(user_input[CONF_API_KEY]).strip()
            error, _sites = await connection.async_check(
                self.hass,
                entry.data[CONF_HOST],
                api_key,
                bool(entry.data.get(CONF_VERIFY_SSL, DEFAULT_VERIFY_SSL)),
            )
            if error:
                errors["base"] = error
            else:
                return self.async_update_reload_and_abort(
                    entry, data_updates={CONF_API_KEY: api_key}
                )
        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_API_KEY): selector.TextSelector(
                        selector.TextSelectorConfig(
                            type=selector.TextSelectorType.PASSWORD
                        )
                    )
                }
            ),
            description_placeholders={"host": str(entry.data.get(CONF_HOST, ""))},
            errors=errors,
        )

    # -- Neu konfigurieren (Host, API-Key, SSL) ----------------------------

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """
        Verbindungsdaten ändern, ohne den Hub neu anzulegen. Ein leeres
        Key-Feld behält den bisherigen Key. Hat der Controller mehrere Sites,
        folgt die Site-Auswahl. Die ID des Hubs bleibt, damit bleibt alles
        andere erhalten.
        """
        entry = self._get_reconfigure_entry()
        errors: dict[str, str] = {}
        host = str(entry.data.get(CONF_HOST, ""))
        verify_ssl = bool(entry.data.get(CONF_VERIFY_SSL, DEFAULT_VERIFY_SSL))
        if user_input is not None:
            host = connection.normalize_host(user_input.get(CONF_HOST, ""))
            verify_ssl = bool(user_input.get(CONF_VERIFY_SSL, verify_ssl))
            api_key = str(user_input.get(CONF_API_KEY) or "").strip() or str(
                entry.data.get(CONF_API_KEY, "")
            )
            if not host:
                errors[CONF_HOST] = connection.ERR_INVALID_HOST
            else:
                error, sites = await connection.async_check(self.hass, host, api_key, verify_ssl)
                if error:
                    errors["base"] = error
                else:
                    self._pending = {CONF_HOST: host, CONF_API_KEY: api_key, CONF_VERIFY_SSL: verify_ssl}
                    self._sites = sites
                    if len(sites) > 1:
                        return await self.async_step_reconfigure_site()
                    site = sites[0]["site"] if sites else DEFAULT_SITE
                    result = self._async_reconfigure_done(site, _site_name(sites, site))
                    if result is not None:
                        return result
                    errors[CONF_HOST] = connection.ERR_ALREADY_CONFIGURED
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_HOST, default=host): str,
                    vol.Optional(CONF_API_KEY): selector.TextSelector(
                        selector.TextSelectorConfig(
                            type=selector.TextSelectorType.PASSWORD
                        )
                    ),
                    vol.Optional(CONF_VERIFY_SSL, default=verify_ssl): bool,
                }
            ),
            errors=errors,
        )

    async def async_step_reconfigure_site(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Site beim Neu konfigurieren wählen; vorgewählt ist die bisherige."""
        entry = self._get_reconfigure_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            site = str(user_input[CONF_SITE])
            result = self._async_reconfigure_done(site, _site_name(self._sites, site))
            if result is not None:
                return result
            errors["base"] = connection.ERR_ALREADY_CONFIGURED
        return self.async_show_form(
            step_id="reconfigure_site",
            data_schema=_site_schema(self._sites, connection.entry_site(entry)),
            description_placeholders={"host": self._pending[CONF_HOST]},
            errors=errors,
        )

    @callback
    def _async_reconfigure_done(
        self, site: str, site_name: str
    ) -> config_entries.ConfigFlowResult | None:
        """Übernehmen und neu laden; None, wenn Host und Site schon ein anderer Hub nutzt."""
        entry = self._get_reconfigure_entry()
        host = self._pending[CONF_HOST]
        if connection.host_taken(self.hass, host, entry.entry_id, site):
            return None
        data = {
            CONF_HOST: host,
            CONF_API_KEY: self._pending[CONF_API_KEY],
            CONF_VERIFY_SSL: self._pending[CONF_VERIFY_SSL],
        }
        if site == DEFAULT_SITE:
            data_updates = {**data, CONF_SITE: None, CONF_SITE_NAME: None}
        else:
            data_updates = {**data, CONF_SITE: site, CONF_SITE_NAME: site_name}
        new_data = {k: v for k, v in {**entry.data, **data_updates}.items() if v is not None}
        return self.async_update_reload_and_abort(
            entry,
            unique_id=connection.unique_id_for(host, site),
            title=connection.updated_title(entry, host, site, site_name),
            data=new_data,
        )

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
                    value=notify_default,
                    label=f"{notify_default} ({msg.label(msg.hass_language(self.hass), 'notify_missing')})",
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
                            ): vol.All(vol.Coerce(int), vol.Range(*SCAN_INTERVAL_RANGE)),
                            vol.Required(
                                CONF_OFFLINE_AFTER_FAILURES,
                                default=offline_after_default,
                            ): vol.All(vol.Coerce(int), vol.Range(*OFFLINE_AFTER_RANGE)),
                        }
                    ),
                    {"collapsed": True},
                ),
                vol.Required(SECTION_CLEANUP): section(
                    vol.Schema(
                        {
                            vol.Required(
                                CONF_PURGE_DAYS, default=purge_default
                            ): vol.All(vol.Coerce(int), vol.Range(*PURGE_DAYS_RANGE)),
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
                vol.Required(SECTION_UPDATES): section(
                    vol.Schema(
                        {
                            vol.Required(
                                CONF_UPDATE_CHECK,
                                default=bool(
                                    current.get(CONF_UPDATE_CHECK, DEFAULT_UPDATE_CHECK)
                                ),
                            ): bool,
                        }
                    ),
                    {"collapsed": True},
                ),
                vol.Required(SECTION_PING): section(
                    vol.Schema(
                        {
                            vol.Required(
                                CONF_PING_ENABLED,
                                default=bool(
                                    current.get(CONF_PING_ENABLED, DEFAULT_PING_ENABLED)
                                ),
                            ): bool,
                            vol.Required(
                                CONF_PING_INTERVAL,
                                default=_int_or(
                                    current.get(CONF_PING_INTERVAL), DEFAULT_PING_INTERVAL
                                ),
                            ): vol.All(vol.Coerce(int), vol.Range(*PING_INTERVAL_RANGE)),
                        }
                    ),
                    {"collapsed": True},
                ),
            }
        )
