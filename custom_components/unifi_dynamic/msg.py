"""
Mehrsprachige Texte für Push- und anhaltende Benachrichtigungen.

Getrennt von strings.json/translations/*.json: Jene decken nur den
Options-Dialog ab, den das HA-Frontend anhand der Sprache des angemeldeten
Nutzers rendert. Meldungstexte werden dagegen serverseitig in Python gebaut,
bevor sie den Notify-Dienst erreichen - dafür braucht es eine eigene, zur
Laufzeit abgefragte Übersetzung.

Massgeblich ist hass.config.language, die konfigurierte Instanzsprache -
nicht zwingend dieselbe wie die Sprache des einzelnen Telefons, aber die
einzige, die serverseitig ohne Weiteres verfügbar ist. Deutsch nur bei
"de"/"de-*", sonst Englisch als Fallback.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.util import dt as dt_util

from .const import (
    CONF_MSG_ACCESS_POINT,
    CONF_MSG_CONNECTION,
    CONF_MSG_IP,
    CONF_MSG_MAC,
    CONF_MSG_NAME,
    CONF_MSG_SSID,
    FIELD_AP_NAME,
    MAX_NEW_CLIENT_MESSAGES,
    MESSAGE_FIELDS,
    PURGE_SKIP_NO_CONTACT,
)

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .coordinator import PurgeResult

LANG_DE = "de"
LANG_EN = "en"


def hass_language(hass: HomeAssistant) -> str:
    """Instanzsprache, auf "de" oder "en" (Fallback) reduziert."""
    lang = (hass.config.language or "").strip().lower()
    if lang == LANG_DE or lang.startswith("de-"):
        return LANG_DE
    return LANG_EN


# ---------------------------------------------------------------------------
# Pluralisierung
# ---------------------------------------------------------------------------

_NOUNS: dict[str, dict[str, tuple[str, str]]] = {
    "client": {LANG_DE: ("Client", "Clients"), LANG_EN: ("client", "clients")},
    "entity": {LANG_DE: ("Entität", "Entitäten"), LANG_EN: ("entity", "entities")},
    "device": {LANG_DE: ("Gerät", "Geräte"), LANG_EN: ("device", "devices")},
    "empty_device": {
        LANG_DE: ("leeres Gerät", "leere Geräte"),
        LANG_EN: ("empty device", "empty devices"),
    },
    "query": {LANG_DE: ("Abfrage", "Abfragen"), LANG_EN: ("query", "queries")},
}


def _noun(lang: str, key: str, count: int) -> str:
    singular, plural = _NOUNS[key][lang]
    return singular if count == 1 else plural


def count_noun(lang: str, count: int, key: str) -> str:
    """'{count} {Nomen}', z. B. '3 Clients' / '1 client'."""
    return f"{count} {_noun(lang, key, count)}"


# ---------------------------------------------------------------------------
# Titel
# ---------------------------------------------------------------------------

_TITLES: dict[str, dict[str, str]] = {
    "purge_report": {LANG_DE: "UniFi Dynamic Purge", LANG_EN: "UniFi Dynamic Purge"},
    "new_client": {
        LANG_DE: "Neues Gerät im Netzwerk erkannt",
        LANG_EN: "New device detected on network",
    },
    "new_clients": {
        LANG_DE: "Neue Geräte im Netzwerk erkannt",
        LANG_EN: "New devices detected on network",
    },
    "excluded": {LANG_DE: "Gerät geschützt", LANG_EN: "Device protected"},
    "removed": {LANG_DE: "Gerät entfernt", LANG_EN: "Device removed"},
    "controller_offline": {
        LANG_DE: "UniFi-Controller nicht erreichbar",
        LANG_EN: "UniFi controller unreachable",
    },
    "controller_online": {
        LANG_DE: "UniFi-Controller wieder erreichbar",
        LANG_EN: "UniFi controller reachable again",
    },
    "action_exclude": {LANG_DE: "Nie entfernen", LANG_EN: "Never remove"},
    "action_purge": {LANG_DE: "Jetzt entfernen", LANG_EN: "Remove now"},
}

_DRY_RUN_SUFFIX = {LANG_DE: " (Testlauf)", LANG_EN: " (dry run)"}
_SUSPENDED_SUFFIX = {LANG_DE: " (ausgesetzt)", LANG_EN: " (suspended)"}


def title(lang: str, key: str) -> str:
    return _TITLES[key][lang]


def purge_report_title(lang: str, *, dry_run: bool, skipped: bool) -> str:
    base = title(lang, "purge_report")
    if dry_run:
        return f"{base}{_DRY_RUN_SUFFIX[lang]}"
    if skipped:
        return f"{base}{_SUSPENDED_SUFFIX[lang]}"
    return base


# ---------------------------------------------------------------------------
# Purge-Bericht
# ---------------------------------------------------------------------------


def _local_time(lang: str, epoch: float) -> str:
    dt = dt_util.as_local(dt_util.utc_from_timestamp(epoch))
    if lang == LANG_DE:
        return dt.strftime("%d.%m.%Y %H:%M")
    return dt.strftime("%Y-%m-%d %H:%M")


def _removed_verb(lang: str, dry_run: bool, count: int) -> str:
    if lang == LANG_DE:
        if not dry_run:
            return "entfernt"
        return "würde entfernt" if count == 1 else "würden entfernt"
    if not dry_run:
        return "removed"
    return "would be removed"


def _summary_line(lang: str, result: PurgeResult) -> str:
    """Kopfzeile: was wurde entfernt bzw. würde entfernt."""
    if result.clients:
        count = result.removed_clients
        verb = _removed_verb(lang, result.dry_run, count)
        if lang == LANG_DE:
            return (
                f"{count_noun(lang, count, 'client')} {verb} "
                f"(> {result.purge_days} Tage nicht gesehen)"
            )
        return (
            f"{count_noun(lang, count, 'client')} {verb} "
            f"(not seen for more than {result.purge_days} days)"
        )

    count = result.orphan_devices
    verb = _removed_verb(lang, result.dry_run, count)
    return f"{count_noun(lang, count, 'empty_device')} {verb}"


def _detail_counts(lang: str, result: PurgeResult) -> str:
    return (
        f"{count_noun(lang, result.removed_entities, 'entity')}, "
        f"{count_noun(lang, result.removed_devices, 'device')}"
    )


def _contact_gap_text(lang: str, result: PurgeResult) -> str:
    """Wie lange der letzte erfolgreiche Poll her ist."""
    if result.contact_gap is None:
        if lang == LANG_DE:
            return "bisher kein erfolgreicher Kontakt zum Controller"
        return "no successful contact with the controller yet"

    hours = result.contact_gap / 3600
    if lang == LANG_DE:
        if hours < 48:
            return f"kein Kontakt zum Controller seit {hours:.1f} Stunden"
        return f"kein Kontakt zum Controller seit {hours / 24:.1f} Tagen"
    if hours < 48:
        return f"no contact with the controller for {hours:.1f} hours"
    return f"no contact with the controller for {hours / 24:.1f} days"


def build_push_message(lang: str, result: PurgeResult) -> str:
    if result.skip_reason == PURGE_SKIP_NO_CONTACT:
        cache = count_noun(lang, result.cache_size, "client")
        if lang == LANG_DE:
            return (
                f"Purge ausgesetzt: {_contact_gap_text(lang, result)}. "
                f"{cache} im Cache bleiben erhalten."
            )
        return (
            f"Purge suspended: {_contact_gap_text(lang, result)}. "
            f"{cache} in the cache are kept."
        )

    if not result.changed:
        cache = count_noun(lang, result.cache_size, "client")
        if lang == LANG_DE:
            return (
                "Keine Clients entfernt. "
                f"{cache} im Cache, Schwelle {result.purge_days} Tage."
            )
        return (
            "No clients removed. "
            f"{cache} in the cache, threshold {result.purge_days} days."
        )

    message = f"{_summary_line(lang, result)}: {_detail_counts(lang, result)}."
    if result.clients and result.orphan_devices:
        empty = count_noun(lang, result.orphan_devices, "empty_device")
        message += f" Davon {empty}." if lang == LANG_DE else f" Of which {empty}."
    if result.dry_run:
        message = f"Testlauf: {message}" if lang == LANG_DE else f"Dry run: {message}"
    return message


def build_persistent_message(lang: str, result: PurgeResult) -> str:
    if result.skip_reason == PURGE_SKIP_NO_CONTACT:
        cache = count_noun(lang, result.cache_size, "client")
        if lang == LANG_DE:
            return (
                "Purge ausgesetzt.\n\n"
                f"Grund: {_contact_gap_text(lang, result)}.\n\n"
                "Ohne erfolgreichen Poll altern die Zeitstempel aller Clients "
                "weiter, obwohl kein einziger tatsächlich verschwunden ist. "
                "Der Lauf würde deshalb Geräte entfernen, die es noch gibt, "
                "und setzt aus, bis der Controller wieder antwortet.\n\n"
                f"Unangetastet: {cache} im Cache"
            )
        return (
            "Purge suspended.\n\n"
            f"Reason: {_contact_gap_text(lang, result)}.\n\n"
            "Without a successful poll, every client's timestamp keeps "
            "aging even though none has actually disappeared. The run "
            "would therefore remove devices that still exist, so it is "
            "suspended until the controller responds again.\n\n"
            f"Untouched: {cache} in the cache"
        )

    if not result.changed:
        cache = count_noun(lang, result.cache_size, "client")
        if lang == LANG_DE:
            protected = (
                f", davon {result.protected} geschützt" if result.protected else ""
            )
            return (
                "Purge-Lauf abgeschlossen.\n\n"
                f"Keine Clients entfernt. Im Cache: {cache}{protected}, "
                f"Schwelle: {result.purge_days} Tage.\n\n"
                "Entfernte Entitäten: keine"
            )
        protected = (
            f", of which {result.protected} protected" if result.protected else ""
        )
        return (
            "Purge run completed.\n\n"
            f"No clients removed. In cache: {cache}{protected}, "
            f"threshold: {result.purge_days} days.\n\n"
            "Removed entities: none"
        )

    lines: list[str] = [f"{_summary_line(lang, result)}."]
    lines.append("")

    if lang == LANG_DE:
        lines.append("Davon:")
        lines.append(f"- {count_noun(lang, result.removed_entities, 'entity')}")
        lines.append(
            f"- {count_noun(lang, result.removed_devices, 'device')}, davon "
            f"{count_noun(lang, result.orphan_devices, 'empty_device')}"
        )
        if result.protected:
            lines.append(
                f"- {count_noun(lang, result.protected, 'client')} vom "
                "Entfernen ausgenommen"
            )
    else:
        lines.append("Of which:")
        lines.append(f"- {count_noun(lang, result.removed_entities, 'entity')}")
        lines.append(
            f"- {count_noun(lang, result.removed_devices, 'device')}, of "
            f"which {count_noun(lang, result.orphan_devices, 'empty_device')}"
        )
        if result.protected:
            lines.append(
                f"- {count_noun(lang, result.protected, 'client')} excluded "
                "from removal"
            )

    for client in result.clients:
        lines.append("")
        lines.append(f"{client.name} ({client.mac})")
        if lang == LANG_DE:
            lines.append(f"- zuletzt gesehen: {_local_time(lang, client.seen_at)}")
            lines.append(
                f"- offline: {client.age_hours:.1f} Std. / "
                f"{client.age_days:.1f} Tage"
            )
            lines.append(
                f"- Löschgrund: länger als {result.purge_days} Tage nicht gesehen"
            )
            lines.append(f"- {count_noun(lang, client.entities, 'entity')} betroffen")
        else:
            lines.append(f"- last seen: {_local_time(lang, client.seen_at)}")
            lines.append(
                f"- offline: {client.age_hours:.1f} h / {client.age_days:.1f} days"
            )
            lines.append(
                f"- reason: not seen for more than {result.purge_days} days"
            )
            lines.append(f"- {count_noun(lang, client.entities, 'entity')} affected")

    if result.dry_run:
        lines.append("")
        lines.append(
            "Testlauf: es wurde nichts verändert."
            if lang == LANG_DE
            else "Dry run: nothing was changed."
        )

    return "\n".join(lines).strip()


# ---------------------------------------------------------------------------
# Neu erkannte Clients
# ---------------------------------------------------------------------------


def _connection_text(lang: str, data: dict[str, Any]) -> str:
    is_wired = data.get("is_wired")
    if is_wired is None:
        return "unbekannt" if lang == LANG_DE else "unknown"
    if lang == LANG_DE:
        return "Kabel" if is_wired else "Wireless"
    return "wired" if is_wired else "wireless"


def build_new_client_message(
    lang: str,
    mac: str,
    data: dict[str, Any],
    fields: dict[str, bool] | None,
    preferred_client_name: Any,
) -> str:
    """
    Eine Zeile pro neuem Client. Jedes aktivierte Feld ergibt ein Segment.

    preferred_client_name wird durchgereicht statt importiert, um keinen
    Zyklus mit coordinator.py einzugehen.
    """
    active = fields if fields is not None else dict(MESSAGE_FIELDS)

    name = preferred_client_name(data, mac)
    name_is_mac = name.lower() == mac.lower()
    wireless = not data.get("is_wired")
    parts: list[str] = []

    if active.get(CONF_MSG_NAME):
        parts.append(name)

    if active.get(CONF_MSG_CONNECTION):
        label = "Verbindung" if lang == LANG_DE else "Connection"
        parts.append(f"{label}: {_connection_text(lang, data)}")

    essid = data.get("essid")
    if active.get(CONF_MSG_SSID) and wireless and essid:
        parts.append(f"SSID: {essid}")

    ap_name = data.get(FIELD_AP_NAME)
    if active.get(CONF_MSG_ACCESS_POINT) and wireless and ap_name:
        parts.append(f"AP: {ap_name}")

    if active.get(CONF_MSG_IP):
        unknown = "unbekannt" if lang == LANG_DE else "unknown"
        parts.append(f"IP: {data.get('ip') or unknown}")

    # MAC weglassen, wenn sie als Anzeigename ohnehin schon dasteht.
    if active.get(CONF_MSG_MAC) and not (active.get(CONF_MSG_NAME) and name_is_mac):
        parts.append(f"MAC: {mac}")

    if not parts:
        parts.append(name)

    return " • ".join(parts)


def build_new_clients_summary(
    lang: str, clients: list[tuple[str, dict[str, Any]]], preferred_client_name: Any
) -> str:
    names = [preferred_client_name(data, mac) for mac, data in clients]
    shown = ", ".join(names[:MAX_NEW_CLIENT_MESSAGES])
    rest = len(names) - MAX_NEW_CLIENT_MESSAGES
    if lang == LANG_DE:
        return f"{len(names)} neue Clients: {shown} und {rest} weitere"
    return f"{len(names)} new clients: {shown} and {rest} more"


# ---------------------------------------------------------------------------
# Bestätigungen für Meldungsaktionen
# ---------------------------------------------------------------------------


def exclusion_message(lang: str, name: str) -> str:
    if lang == LANG_DE:
        return f"{name} wird nicht mehr automatisch entfernt."
    return f"{name} will no longer be removed automatically."


def removal_message(lang: str, name: str, *, removed: bool) -> str:
    if removed:
        if lang == LANG_DE:
            return (
                f"{name} wurde entfernt. Ist der Client noch aktiv, legt ihn "
                "der nächste Abgleich wieder an und meldet ihn erneut."
            )
        return (
            f"{name} was removed. If the client is still active, the next "
            "sync will recreate it and report it again."
        )
    if lang == LANG_DE:
        return f"{name} war bereits entfernt."
    return f"{name} was already removed."


# ---------------------------------------------------------------------------
# Erreichbarkeit des Controllers
# ---------------------------------------------------------------------------


def _duration_text(lang: str, seconds: float) -> str:
    """Dauer in der grössten sinnvollen Einheit."""
    if lang == LANG_DE:
        if seconds < 90:
            return f"{seconds:.0f} Sekunden"
        if seconds < 5400:
            return f"{seconds / 60:.0f} Minuten"
        if seconds < 172800:
            return f"{seconds / 3600:.1f} Stunden"
        return f"{seconds / 86400:.1f} Tagen"
    if seconds < 90:
        return f"{seconds:.0f} seconds"
    if seconds < 5400:
        return f"{seconds / 60:.0f} minutes"
    if seconds < 172800:
        return f"{seconds / 3600:.1f} hours"
    return f"{seconds / 86400:.1f} days"


def build_controller_offline_message(
    lang: str, host: str, gap: float | None, failures: int
) -> str:
    attempts = count_noun(lang, failures, "query")

    if lang == LANG_DE:
        if gap is None:
            return (
                f"Kein erfolgreicher Abruf von {host}, {attempts} in Folge "
                "fehlgeschlagen. Clients werden nicht mehr aktualisiert."
            )
        return (
            f"Kein erfolgreicher Abruf von {host} seit "
            f"{_duration_text(lang, gap)}, {attempts} in Folge fehlgeschlagen. "
            "Clients werden nicht mehr aktualisiert."
        )

    if gap is None:
        return (
            f"No successful request to {host}, {attempts} in a row failed. "
            "Clients are no longer being updated."
        )
    return (
        f"No successful request to {host} for {_duration_text(lang, gap)}, "
        f"{attempts} in a row failed. Clients are no longer being updated."
    )


def controller_recovered_message(lang: str, host: str, outage: float | None) -> str:
    if outage is None:
        if lang == LANG_DE:
            return f"{host} antwortet wieder."
        return f"{host} is responding again."
    if lang == LANG_DE:
        return f"{host} antwortet wieder, nach {_duration_text(lang, outage)}."
    return f"{host} is responding again, after {_duration_text(lang, outage)}."
