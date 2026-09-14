"""Benachrichtigungen zum Purge-Lauf."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import (
    CONF_MSG_ACCESS_POINT,
    CONF_MSG_CONNECTION,
    CONF_MSG_IP,
    CONF_MSG_MAC,
    CONF_MSG_NAME,
    CONF_MSG_SSID,
    CONF_NOTIFY_NEW_CLIENTS,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_WHEN_EMPTY,
    CONF_PERSISTENT_NOTIFICATION,
    CONF_PERSISTENT_WHEN_EMPTY,
    DATA_PUSH_IMAGE,
    DEFAULT_NOTIFY_NEW_CLIENTS,
    DEFAULT_NOTIFY_SERVICE,
    DEFAULT_NOTIFY_WHEN_EMPTY,
    DEFAULT_PERSISTENT_NOTIFICATION,
    DEFAULT_PERSISTENT_WHEN_EMPTY,
    DOMAIN,
    FIELD_AP_NAME,
    MAX_NEW_CLIENT_MESSAGES,
    MESSAGE_FIELDS,
    NEW_CLIENT_TAG_PREFIX,
    NEW_CLIENT_TITLE,
    NEW_CLIENTS_TITLE,
    NOTIFICATION_TAG_PREFIX,
    NOTIFICATION_TITLE,
    NOTIFICATION_URL,
    NOTIFY_NONE,
)
from .coordinator import PurgeResult, preferred_client_name

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


def notification_data(
    hass: HomeAssistant, tag: str
) -> dict[str, Any] | None:
    """
    Zusatzdaten für die Companion-App: Bild, Klickziel und Tag.

    Das Bild liefert die Integration selbst aus, es gibt nichts zu
    konfigurieren. Fehlt es, entfällt der ganze Block. Der Tag steuert, welche
    Meldungen sich gegenseitig ersetzen: Purge-Meldungen überschreiben die
    vorige, Neugeräte-Meldungen sind pro MAC eigenständig.
    """
    image_url = hass.data.get(DATA_PUSH_IMAGE)
    if not image_url:
        return None

    return {"tag": tag, "url": NOTIFICATION_URL, "icon_url": image_url}


def _purge_tag(entry: ConfigEntry) -> str:
    return f"{NOTIFICATION_TAG_PREFIX}_{entry.entry_id}"


# ---------------------------------------------------------------------------
# Textbausteine
# ---------------------------------------------------------------------------


def _local_time(epoch: float) -> str:
    return dt_util.as_local(dt_util.utc_from_timestamp(epoch)).strftime(
        "%d.%m.%Y %H:%M"
    )


def _plural(count: int, singular: str, plural: str) -> str:
    return f"{count} {singular if count == 1 else plural}"


def _removed_verb(result: PurgeResult, count: int) -> str:
    if not result.dry_run:
        return "entfernt"
    return "würde entfernt" if count == 1 else "würden entfernt"


def _summary_line(result: PurgeResult) -> str:
    """Kopfzeile: was wurde entfernt bzw. würde entfernt."""
    if result.clients:
        return (
            f"{_plural(result.removed_clients, 'Client', 'Clients')} "
            f"{_removed_verb(result, result.removed_clients)} "
            f"(> {result.purge_days} Tage nicht gesehen)"
        )

    return (
        f"{_plural(result.orphan_devices, 'leeres Gerät', 'leere Geräte')} "
        f"{_removed_verb(result, result.orphan_devices)}"
    )


def _detail_counts(result: PurgeResult) -> str:
    return (
        f"{_plural(result.removed_entities, 'Entität', 'Entitäten')}, "
        f"{_plural(result.removed_devices, 'Gerät', 'Geräte')}"
    )


def build_push_message(result: PurgeResult) -> str:
    if not result.changed:
        return (
            "Keine Clients entfernt. "
            f"{_plural(result.cache_size, 'Client', 'Clients')} im Cache, "
            f"Schwelle {result.purge_days} Tage."
        )

    message = f"{_summary_line(result)}: {_detail_counts(result)}."
    if result.clients and result.orphan_devices:
        message += (
            f" Davon {_plural(result.orphan_devices, 'leeres Gerät', 'leere Geräte')}."
        )
    if result.dry_run:
        message = f"Testlauf: {message}"
    return message


def build_persistent_message(result: PurgeResult) -> str:
    if not result.changed:
        protected = (
            f", davon {result.protected} geschützt" if result.protected else ""
        )
        return (
            "Purge-Lauf abgeschlossen.\n\n"
            "Keine Clients entfernt. Im Cache: "
            f"{_plural(result.cache_size, 'Client', 'Clients')}{protected}, "
            f"Schwelle: {result.purge_days} Tage.\n\n"
            "Entfernte Entitäten: keine"
        )

    lines: list[str] = [f"{_summary_line(result)}."]
    lines.append("")
    lines.append("Davon:")
    lines.append(f"- {_plural(result.removed_entities, 'Entität', 'Entitäten')}")
    lines.append(
        f"- {_plural(result.removed_devices, 'Gerät', 'Geräte')}, davon "
        f"{_plural(result.orphan_devices, 'leeres Gerät', 'leere Geräte')}"
    )
    if result.protected:
        lines.append(
            f"- {_plural(result.protected, 'Client', 'Clients')} vom Entfernen "
            "ausgenommen"
        )

    for client in result.clients:
        lines.append("")
        lines.append(f"{client.name} ({client.mac})")
        lines.append(f"- zuletzt gesehen: {_local_time(client.seen_at)}")
        lines.append(
            f"- offline: {client.age_hours:.1f} Std. / {client.age_days:.1f} Tage"
        )
        lines.append(
            f"- Löschgrund: länger als {result.purge_days} Tage nicht gesehen"
        )
        lines.append(
            f"- {_plural(client.entities, 'Entität', 'Entitäten')} betroffen"
        )

    if result.dry_run:
        lines.append("")
        lines.append("Testlauf: es wurde nichts verändert.")

    return "\n".join(lines).strip()


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
    wiederholt. Die Meldung kommt damit in jedem Fall an, nur ohne Bild.
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
                    "Versuch ohne Bild",
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
    if result.skipped:
        return
    if not result.changed and not report_empty:
        return

    title = NOTIFICATION_TITLE
    if result.dry_run:
        title = f"{NOTIFICATION_TITLE} (Testlauf)"

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
            build_persistent_message(result),
            title=title,
            notification_id=f"{DOMAIN}_purge_{entry.entry_id}",
        )

    target = notify_target(entry)
    if target is None:
        return

    if not result.changed and not _bool_option(
        entry, CONF_NOTIFY_WHEN_EMPTY, DEFAULT_NOTIFY_WHEN_EMPTY
    ):
        return

    await _async_push(
        hass,
        target,
        title,
        build_push_message(result),
        notification_data(hass, _purge_tag(entry)),
    )


# ---------------------------------------------------------------------------
# Neu erkannte Clients
# ---------------------------------------------------------------------------


def _connection_text(data: dict[str, Any]) -> str:
    is_wired = data.get("is_wired")
    if is_wired is None:
        return "unbekannt"
    return "Kabel" if is_wired else "Wireless"


def message_fields(entry: ConfigEntry) -> dict[str, bool]:
    """Welche Angaben die Neugeräte-Meldung enthalten soll."""
    return {
        key: _bool_option(entry, key, default) for key, default in MESSAGE_FIELDS
    }


def build_new_client_message(
    mac: str, data: dict[str, Any], fields: dict[str, bool] | None = None
) -> str:
    """
    Eine Zeile pro neuem Client. Jedes aktivierte Feld ergibt ein Segment.

    SSID und Access Point erscheinen nur bei WLAN-Clients, unabhängig von der
    Einstellung. Ist am Ende nichts übrig, wird ersatzweise der Anzeigename
    gemeldet, damit die Meldung nie leer ist.
    """
    active = fields if fields is not None else dict(MESSAGE_FIELDS)

    name = preferred_client_name(data, mac)
    name_is_mac = name.lower() == mac.lower()
    wireless = not data.get("is_wired")
    parts: list[str] = []

    if active.get(CONF_MSG_NAME):
        parts.append(name)

    if active.get(CONF_MSG_CONNECTION):
        parts.append(f"Verbindung: {_connection_text(data)}")

    essid = data.get("essid")
    if active.get(CONF_MSG_SSID) and wireless and essid:
        parts.append(f"SSID: {essid}")

    ap_name = data.get(FIELD_AP_NAME)
    if active.get(CONF_MSG_ACCESS_POINT) and wireless and ap_name:
        parts.append(f"AP: {ap_name}")

    if active.get(CONF_MSG_IP):
        parts.append(f"IP: {data.get('ip') or 'unbekannt'}")

    # MAC weglassen, wenn sie als Anzeigename ohnehin schon dasteht.
    if active.get(CONF_MSG_MAC) and not (active.get(CONF_MSG_NAME) and name_is_mac):
        parts.append(f"MAC: {mac}")

    if not parts:
        parts.append(name)

    return " • ".join(parts)


def build_new_clients_summary(clients: list[tuple[str, dict[str, Any]]]) -> str:
    names = [preferred_client_name(data, mac) for mac, data in clients]
    shown = ", ".join(names[:MAX_NEW_CLIENT_MESSAGES])
    rest = len(names) - MAX_NEW_CLIENT_MESSAGES
    return f"{len(names)} neue Clients: {shown} und {rest} weitere"


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

    if len(clients) > MAX_NEW_CLIENT_MESSAGES:
        await _async_push(
            hass,
            target,
            NEW_CLIENTS_TITLE,
            build_new_clients_summary(clients),
            notification_data(
                hass, f"{NEW_CLIENT_TAG_PREFIX}_summary_{entry.entry_id}"
            ),
        )
        return

    fields = message_fields(entry)

    for mac, data in clients:
        await _async_push(
            hass,
            target,
            NEW_CLIENT_TITLE,
            build_new_client_message(mac, data, fields),
            notification_data(
                hass, f"{NEW_CLIENT_TAG_PREFIX}_{mac.replace(':', '')}"
            ),
        )
