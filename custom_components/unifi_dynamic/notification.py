"""Benachrichtigungen zum Purge-Lauf."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr

from . import msg
from .const import (
    ACTION_CONFIRM_TAG_PREFIX,
    ACTION_EXCLUDE,
    ACTION_PURGE,
    ACTION_SEPARATOR,
    CONF_MSG_ACCESS_POINT,
    CONF_MSG_CONNECTION,
    CONF_MSG_IP,
    CONF_MSG_NAME,
    CONF_MSG_SSID,
    CONF_NOTIFY_CONTROLLER_OFFLINE,
    CONF_NOTIFY_NEW_CLIENTS,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_WHEN_EMPTY,
    CONF_PERSISTENT_CONTROLLER_OFFLINE,
    CONF_PERSISTENT_NOTIFICATION,
    CONF_PERSISTENT_WHEN_EMPTY,
    CONTROLLER_TAG_PREFIX,
    DATA_PUSH_IMAGE,
    DEFAULT_NOTIFY_CONTROLLER_OFFLINE,
    DEFAULT_NOTIFY_NEW_CLIENTS,
    DEFAULT_NOTIFY_SERVICE,
    DEFAULT_NOTIFY_WHEN_EMPTY,
    DEFAULT_PERSISTENT_CONTROLLER_OFFLINE,
    DEFAULT_PERSISTENT_NOTIFICATION,
    DEFAULT_PERSISTENT_WHEN_EMPTY,
    DEVICE_URL_TEMPLATE,
    DOMAIN,
    FIELD_AP_NAME,
    MAX_NEW_CLIENT_MESSAGES,
    MESSAGE_FIELDS,
    NEW_CLIENT_TAG_PREFIX,
    NOTIFICATION_TAG_PREFIX,
    NOTIFICATION_URL,
    NOTIFY_NONE,
    PURGE_SKIP_DISABLED,
)
from .coordinator import (
    PurgeResult,
    get_client_device,
    get_excluded_macs,
    preferred_client_name,
)

_LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Optionen
# ---------------------------------------------------------------------------


def _bool_option(entry: ConfigEntry, key: str, default: bool) -> bool:
    return bool(entry.options.get(key, entry.data.get(key, default)))


def notify_target(entry: ConfigEntry) -> str | None:
    """Konfiguriertes Push-Ziel, oder None wenn deaktiviert."""
    raw = entry.options.get(
        CONF_NOTIFY_SERVICE, entry.data.get(CONF_NOTIFY_SERVICE, DEFAULT_NOTIFY_SERVICE)
    )
    target = str(raw or "").strip()
    if not target or target == NOTIFY_NONE:
        return None
    return target


def device_url(hass: HomeAssistant, entry: ConfigEntry, mac: str) -> str | None:
    """Pfad zur Geräteseite dieses Clients, sofern das Gerät schon existiert."""
    device = get_client_device(dr.async_get(hass), entry.entry_id, mac.lower())
    if device is None:
        return None
    return DEVICE_URL_TEMPLATE.format(device_id=device.id)


def client_actions(
    lang: str, entry_id: str, mac: str, *, excluded: bool = False
) -> list[dict[str, str]]:
    """
    Aktionsbuttons für die Meldung eines neuen Clients.

    Die Ausnahmeliste-Aktion setzt den Client auf purge_exclude, die
    Entfernen-Aktion löscht ihn sofort; Titel je nach lang (siehe msg.py).
    Steht er bereits auf der Ausnahmeliste, wäre der erste Button wirkungslos
    und entfällt.

    Entry-ID und MAC stecken im Aktions-Key, nicht in action_data: Den Key
    melden beide Companion-Apps unverändert zurück, action_data liest iOS
    dagegen aus dem Payload-Schlüssel "homeassistant" und Android aus
    "action_data". Der Key ist damit der einzige plattformunabhängige Weg.
    """
    token = mac.replace(":", "").lower()
    kinds = [ACTION_PURGE] if excluded else [ACTION_EXCLUDE, ACTION_PURGE]
    title_keys = {ACTION_EXCLUDE: "action_exclude", ACTION_PURGE: "action_purge"}

    return [
        {
            "action": ACTION_SEPARATOR.join((kind, entry_id, token)),
            "title": msg.title(lang, title_keys[kind]),
            # Explizit statt auf den dokumentierten Default zu vertrauen: kein
            # eigenes "uri" auf dem Button, also soll der Tastendruck nur das
            # Event feuern und die App nicht zur (nach "Jetzt entfernen"
            # nicht mehr existierenden) Geräteseite navigieren.
            "behavior": "background",
        }
        for kind in kinds
    ]


def parse_client_action(action: str) -> tuple[str, str, str] | None:
    """
    Zerlegt einen Aktions-Key in Art, Entry-ID und MAC.

    Gibt None zurück, wenn der Key nicht von dieser Integration stammt oder
    nicht wohlgeformt ist. Der Event-Bus ist global, es kommen also auch
    fremde Aktionen an.
    """
    parts = str(action or "").split(ACTION_SEPARATOR)
    if len(parts) != 3:
        return None

    kind = parts[0].strip().upper()
    if kind not in (ACTION_EXCLUDE, ACTION_PURGE):
        return None

    entry_id = parts[1].strip()
    token = parts[2].strip().lower()

    if not entry_id or len(token) != 12:
        return None

    try:
        int(token, 16)
    except ValueError:
        return None

    mac = ":".join(token[i : i + 2] for i in range(0, 12, 2))
    return kind, entry_id, mac


def notification_data(
    hass: HomeAssistant,
    tag: str,
    url: str | None = None,
    actions: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """
    Zusatzdaten für die Companion-App: Klickziel, Tag, Bild und Aktionen.

    Das Klickziel steht doppelt drin: iOS liest "url", Android ausschliesslich
    "clickAction". Das ist der dokumentierte Weg, die jeweilige Gegenseite
    ignoriert den fremden Schlüssel. Ohne url führt der Klick auf die
    Integrationsseite.

    Der Tag steuert, welche Meldungen sich gegenseitig ersetzen: Purge-
    Meldungen überschreiben die vorige, Neugeräte-Meldungen sind pro MAC
    eigenständig.

    Das Bild liefert die Integration selbst aus, es gibt nichts zu
    konfigurieren. Fehlt es, entfällt nur "icon_url" - Klickziel und Tag hängen
    bewusst nicht daran, sonst würde mit dem Bild auch beides verschwinden.

    Aktionen sind optional und werden nur von den Companion-Apps ausgewertet.
    Andere Ziele ignorieren den Block ohnehin oder lehnen ihn ab.
    """
    target_url = url or NOTIFICATION_URL

    data: dict[str, Any] = {
        "tag": tag,
        "url": target_url,
        "clickAction": target_url,
    }

    image_url = hass.data.get(DATA_PUSH_IMAGE)
    if image_url:
        data["icon_url"] = image_url

    if actions:
        data["actions"] = actions

    return data


def _purge_tag(entry: ConfigEntry) -> str:
    return f"{NOTIFICATION_TAG_PREFIX}_{entry.entry_id}"


# ---------------------------------------------------------------------------
# Versand
# ---------------------------------------------------------------------------


async def _async_call_notify(
    hass: HomeAssistant, service: str, payload: dict[str, Any]
) -> None:
    await hass.services.async_call("notify", service, payload, blocking=True)


async def _async_push(
    hass: HomeAssistant,
    target: str,
    title: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> None:
    """
    Sendet an einen notify-Service oder eine notify-Entity.

    Lehnt ein Ziel die Zusatzdaten ab, etwa Telegram oder E-Mail mit
    "extra keys not allowed", wird derselbe Aufruf einmal ohne data
    wiederholt. Die Meldung kommt damit in jedem Fall an, dann aber ohne Bild,
    Klickziel und Tag.
    """
    domain, _, object_id = target.partition(".")
    if domain != "notify" or not object_id:
        _LOGGER.warning(
            "Ungültiges Benachrichtigungsziel '%s', erwartet wird notify.<name>",
            target,
        )
        return

    plain: dict[str, Any] = {"title": title, "message": message}

    if hass.services.has_service("notify", object_id):
        if data:
            try:
                await _async_call_notify(hass, object_id, {**plain, "data": data})
                return
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug(
                    "Ziel '%s' hat die Zusatzdaten abgelehnt (%s), erneuter "
                    "Versuch ohne Zusatzdaten",
                    target,
                    err,
                )

        try:
            await _async_call_notify(hass, object_id, plain)
        except Exception:  # noqa: BLE001 - Meldung darf den Purge nie kippen
            _LOGGER.exception("Benachrichtigung an '%s' fehlgeschlagen", target)
        return

    if hass.states.get(target) is not None and hass.services.has_service(
        "notify", "send_message"
    ):
        # Neue notify-Entity: send_message kennt nur message und title.
        if data:
            _LOGGER.debug(
                "Ziel '%s' ist eine notify-Entity; Bild und Klickziel werden "
                "dort nicht unterstützt und entfallen",
                target,
            )
        try:
            await hass.services.async_call(
                "notify",
                "send_message",
                {**plain, "entity_id": target},
                blocking=True,
            )
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Benachrichtigung an '%s' fehlgeschlagen", target)
        return

    _LOGGER.warning(
        "Benachrichtigungsziel '%s' existiert nicht, Meldung verworfen", target
    )


async def async_send_purge_report(
    hass: HomeAssistant,
    entry: ConfigEntry,
    result: PurgeResult,
    *,
    report_empty: bool = True,
) -> None:
    """
    Meldet das Ergebnis eines Purge-Laufs.

    report_empty=False unterdrückt die Meldung, wenn nichts entfernt wurde.
    Wird für den Lauf direkt nach dem Start genutzt, damit nicht jeder
    Neustart eine Meldung erzeugt.
    """
    # Ein deaktivierter Purge ist der gewollte Normalfall und wird nie
    # gemeldet. Ein wegen fehlendem Controller-Kontakt ausgesetzter Lauf schon:
    # er bedeutet, dass die Integration gerade blind ist. Ohne Clients im Cache
    # gibt es allerdings nichts zu schützen, dann bleibt es still.
    if result.skip_reason == PURGE_SKIP_DISABLED:
        return
    if result.skipped and not result.cache_size:
        return
    if not result.skipped and not result.changed and not report_empty:
        return

    lang = msg.hass_language(hass)
    title = msg.purge_report_title(
        lang, dry_run=result.dry_run, skipped=result.skipped
    )

    # Anhaltende Benachrichtigung: eigener Schalter, eigene Leerlauf-Regel.
    # Wird sie bei einem leeren Lauf übersprungen, bleibt die vorige stehen -
    # sie zeigt damit weiterhin den letzten tatsächlichen Purge samt Zeitpunkt.
    persistent_wanted = _bool_option(
        entry, CONF_PERSISTENT_NOTIFICATION, DEFAULT_PERSISTENT_NOTIFICATION
    ) and (
        result.changed
        or _bool_option(
            entry, CONF_PERSISTENT_WHEN_EMPTY, DEFAULT_PERSISTENT_WHEN_EMPTY
        )
    )

    if persistent_wanted:
        persistent_notification.async_create(
            hass,
            msg.build_persistent_message(lang, result),
            title=title,
            notification_id=f"{DOMAIN}_purge_{entry.entry_id}",
        )

    target = notify_target(entry)
    if target is None:
        return

    # Ein ausgesetzter Lauf ist kein leerer Lauf, sondern eine Störung: er
    # geht deshalb auch dann raus, wenn leere Läufe nicht gemeldet werden.
    # Dauert der Ausfall an, kommt die Meldung einmal pro Tag; sie ersetzt
    # dank gleichem Tag jeweils die vorige.
    if (
        not result.skipped
        and not result.changed
        and not _bool_option(entry, CONF_NOTIFY_WHEN_EMPTY, DEFAULT_NOTIFY_WHEN_EMPTY)
    ):
        return

    await _async_push(
        hass,
        target,
        title,
        msg.build_push_message(lang, result),
        notification_data(hass, _purge_tag(entry)),
    )


# ---------------------------------------------------------------------------
# Neu erkannte Clients
# ---------------------------------------------------------------------------


def message_fields(entry: ConfigEntry) -> dict[str, bool]:
    """Welche Angaben die Neugeräte-Meldung enthalten soll."""
    return {
        key: _bool_option(entry, key, default) for key, default in MESSAGE_FIELDS
    }


def missing_message_fields(
    mac: str, data: dict[str, Any], fields: dict[str, bool]
) -> list[str]:
    """
    Welche der gewünschten Angaben für diesen Client noch fehlen.

    Geprüft wird nur, was für diesen Client überhaupt vorkommen kann: SSID und
    Access Point gibt es ausschliesslich bei WLAN-Clients, die MAC ist immer
    vorhanden und blockiert nie. Ist die Liste leer, ist die Meldung
    vollständig.
    """
    missing: list[str] = []
    wireless = data.get("is_wired") is False

    if fields.get(CONF_MSG_NAME) and preferred_client_name(data, mac).lower() == mac.lower():
        missing.append("name")

    if fields.get(CONF_MSG_CONNECTION) and data.get("is_wired") is None:
        missing.append("connection")

    if fields.get(CONF_MSG_IP) and not data.get("ip"):
        missing.append("ip")

    if wireless and fields.get(CONF_MSG_SSID) and not data.get("essid"):
        missing.append("ssid")

    if wireless and fields.get(CONF_MSG_ACCESS_POINT):
        ap_mac = str(data.get("ap_mac") or "").strip().lower()
        ap_name = str(data.get(FIELD_AP_NAME) or "").strip()
        # access_point_name fällt auf die MAC zurück; das gilt als unaufgelöst.
        if not ap_mac or not ap_name or ap_name.lower() == ap_mac:
            missing.append("access_point")

    return missing


async def async_send_new_clients_report(
    hass: HomeAssistant,
    entry: ConfigEntry,
    clients: list[tuple[str, dict[str, Any]]],
) -> None:
    """
    Meldet erstmals gesehene Clients per Push.

    Bewusst ohne anhaltende Benachrichtigung: die würde sich in der Seitenleiste
    stapeln. Ab MAX_NEW_CLIENT_MESSAGES gleichzeitig neuen Clients kommt eine
    Sammelmeldung statt einer Flut von Einzelmeldungen.
    """
    if not clients:
        return

    if not _bool_option(entry, CONF_NOTIFY_NEW_CLIENTS, DEFAULT_NOTIFY_NEW_CLIENTS):
        return

    target = notify_target(entry)
    if target is None:
        return

    lang = msg.hass_language(hass)

    if len(clients) > MAX_NEW_CLIENT_MESSAGES:
        await _async_push(
            hass,
            target,
            msg.title(lang, "new_clients"),
            msg.build_new_clients_summary(lang, clients, preferred_client_name),
            notification_data(
                hass, f"{NEW_CLIENT_TAG_PREFIX}_summary_{entry.entry_id}"
            ),
        )
        return

    fields = message_fields(entry)
    excluded = get_excluded_macs(entry)

    for mac, data in clients:
        actions = client_actions(
            lang, entry.entry_id, mac, excluded=mac.lower() in excluded
        )

        await _async_push(
            hass,
            target,
            msg.title(lang, "new_client"),
            msg.build_new_client_message(lang, mac, data, fields, preferred_client_name),
            notification_data(
                hass,
                f"{NEW_CLIENT_TAG_PREFIX}_{mac.replace(':', '')}",
                # Klick öffnet die Geräteseite dieses Clients. Existiert das
                # Gerät noch nicht, bleibt es bei der Integrationsseite.
                device_url(hass, entry, mac),
                actions,
            ),
        )


async def async_send_exclusion_notice(
    hass: HomeAssistant, entry: ConfigEntry, mac: str, name: str
) -> None:
    """
    Bestätigt, dass ein Client von der Ausnahmeliste geschützt ist.

    Eigener Tag statt des Tags der ursprünglichen Neugeräte-Meldung: iOS
    entfernt eine Meldung meist automatisch, sobald eine Aktion darauf
    getippt wird. Teilt sich die Bestätigung den Tag mit der so schon
    verschwundenen Meldung, kommt sie je nach Timing nicht mehr zuverlässig
    als eigener Banner an. Ohne diese Rückmeldung bliebe der Tastendruck auf
    dem Telefon ohne sichtbare Wirkung, denn er passiert ausserhalb von Home
    Assistant.
    """
    target = notify_target(entry)
    if target is None:
        return

    lang = msg.hass_language(hass)

    await _async_push(
        hass,
        target,
        msg.title(lang, "excluded"),
        msg.exclusion_message(lang, name),
        notification_data(
            hass,
            f"{ACTION_CONFIRM_TAG_PREFIX}_{mac.replace(':', '')}",
            device_url(hass, entry, mac),
        ),
    )


async def async_send_removal_notice(
    hass: HomeAssistant,
    entry: ConfigEntry,
    mac: str,
    name: str,
    *,
    removed: bool = True,
) -> None:
    """
    Bestätigt, dass ein Client von Hand entfernt wurde.

    Eigener Tag statt des Tags der ursprünglichen Neugeräte-Meldung, aus
    demselben Grund wie bei async_send_exclusion_notice: iOS entfernt eine
    Meldung meist automatisch, sobald eine Aktion darauf getippt wird, und
    eine Bestätigung mit demselben Tag käme dann je nach Timing nicht mehr
    zuverlässig an.

    Der Klick führt auf die Integrationsseite, nicht auf die Geräteseite: die
    gibt es nach dem Entfernen nicht mehr. Ist der Client noch online, legt
    ihn der nächste Poll wieder an und meldet ihn erneut als neu - darauf
    weist der Text hin, damit weder die Rückkehr noch die zweite Meldung als
    Fehler wirkt.
    """
    target = notify_target(entry)
    if target is None:
        return

    lang = msg.hass_language(hass)

    await _async_push(
        hass,
        target,
        msg.title(lang, "removed"),
        msg.removal_message(lang, name, removed=removed),
        notification_data(hass, f"{ACTION_CONFIRM_TAG_PREFIX}_{mac.replace(':', '')}"),
    )


# ---------------------------------------------------------------------------
# Erreichbarkeit des Controllers
# ---------------------------------------------------------------------------


def _controller_tag(entry: ConfigEntry) -> str:
    return f"{CONTROLLER_TAG_PREFIX}_{entry.entry_id}"


def _controller_notification_id(entry: ConfigEntry) -> str:
    return f"{DOMAIN}_controller_{entry.entry_id}"


async def async_send_controller_offline(
    hass: HomeAssistant,
    entry: ConfigEntry,
    host: str,
    gap: float | None,
    failures: int,
) -> None:
    """Meldet, dass der Controller nicht mehr antwortet."""
    lang = msg.hass_language(hass)
    message = msg.build_controller_offline_message(lang, host, gap, failures)
    title = msg.title(lang, "controller_offline")

    if _bool_option(
        entry,
        CONF_PERSISTENT_CONTROLLER_OFFLINE,
        DEFAULT_PERSISTENT_CONTROLLER_OFFLINE,
    ):
        persistent_notification.async_create(
            hass,
            message,
            title=title,
            notification_id=_controller_notification_id(entry),
        )

    target = notify_target(entry)
    if target is None:
        return

    if not _bool_option(
        entry, CONF_NOTIFY_CONTROLLER_OFFLINE, DEFAULT_NOTIFY_CONTROLLER_OFFLINE
    ):
        return

    await _async_push(
        hass,
        target,
        title,
        message,
        notification_data(hass, _controller_tag(entry)),
    )


async def async_send_controller_recovered(
    hass: HomeAssistant, entry: ConfigEntry, host: str, outage: float | None
) -> None:
    """
    Gibt Entwarnung, nachdem der Controller wieder geantwortet hat.

    Die anhaltende Meldung wird dabei entfernt statt ersetzt: Die Störung ist
    vorbei, in der Seitenleiste soll nichts stehenbleiben.
    """
    persistent_notification.async_dismiss(hass, _controller_notification_id(entry))

    target = notify_target(entry)
    if target is None:
        return

    if not _bool_option(
        entry, CONF_NOTIFY_CONTROLLER_OFFLINE, DEFAULT_NOTIFY_CONTROLLER_OFFLINE
    ):
        return

    lang = msg.hass_language(hass)

    await _async_push(
        hass,
        target,
        msg.title(lang, "controller_online"),
        msg.controller_recovered_message(lang, host, outage),
        notification_data(hass, _controller_tag(entry)),
    )
