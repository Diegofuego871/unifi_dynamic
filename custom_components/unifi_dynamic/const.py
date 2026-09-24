"""Konstanten der Integration "UniFi Dynamic Clients"."""

from __future__ import annotations

DOMAIN = "unifi_dynamic"

CONF_HOST = "host"
CONF_API_KEY = "api_key"
CONF_VERIFY_SSL = "verify_ssl"
CONF_SCAN_INTERVAL = "scan_interval"
CONF_PURGE_DAYS = "purge_days"

DEFAULT_VERIFY_SSL = False
DEFAULT_SCAN_INTERVAL = 30
DEFAULT_PURGE_DAYS = 30

# API-Pfade
SITES_PATH = "/proxy/network/integration/v1/sites"
CLIENTS_PATH = "/proxy/network/api/s/default/stat/sta"
DEVICES_PATH = "/proxy/network/api/s/default/stat/device"

REQUEST_TIMEOUT_SECONDS = 30

# Persistenter Store
STORAGE_VERSION = 1
STORAGE_SAVE_DELAY = 10  # Sekunden, entprellt Schreibzugriffe

STORE_CLIENT_CACHE = "client_cache"
STORE_AP_NAMES = "ap_names"
STORE_KNOWN_NAMES = "known_names"
STORE_ANCHOR = "last_success"
STORE_MIGRATION_FLAG = "entity_id_migration_v1_done"
# Verknüpfung Client-MAC -> Geräte-ID eines beliebigen HA-Geräts, im Panel
# gesetzt. Reine Zuordnung: das verknüpfte Gerät wird nie verändert.
STORE_DEVICE_LINKS = "device_links"

# Internes Cache-Feld: Epoch-Sekunden (UTC), zu denen die Integration den
# Client zuletzt selbst in der UniFi-API gesehen hat. Einzige Grundlage für
# Purge, Online-Erkennung und den "Last seen"-Sensor.
FIELD_SEEN_AT = "_seen_at"

# Internes Cache-Feld: Epoch-Sekunden, zu denen die Integration den Client zum
# ersten Mal gesehen hat. Nur Ersatz, falls der Controller kein eigenes
# "first_seen" liefert; bei Clients, die schon vor diesem Feld im Cache
# standen, bleibt es leer statt eines erfundenen Datums.
FIELD_FIRST_SEEN = "_first_seen"

# Nur diese Felder werden aus der UniFi-Antwort übernommen und persistiert.
# Alles andere aus /stat/sta wird verworfen: kleinerer Store, keine
# Überraschungsfelder, definierte Merge-Semantik.
CLIENT_FIELDS: tuple[str, ...] = (
    "mac",
    "name",
    "hostname",
    "ip",
    "essid",
    "is_wired",
    "rssi",
    "signal",
    "ap_mac",
    "first_seen",
)

# Berechnetes Feld im Snapshot: aufgelöster Name des Access Points. Steht nicht
# im Cache, sondern wird aus der AP-Namensliste ergänzt.
FIELD_AP_NAME = "_ap_name"

# Die AP-Liste ändert sich praktisch nie, wird also viel seltener geholt als die
# Clientliste. Zusätzlich bei einer unbekannten AP-MAC, aber frühestens nach
# AP_NAMES_RETRY, damit ein AP ohne Namen kein Dauerfeuer auslöst.
AP_NAMES_TTL = 900
AP_NAMES_RETRY = 60

# Ab dieser Zeit ohne Sichtung gilt ein Client als offline.
OFFLINE_AFTER_SECONDS = 60

# HA-Ausfälle dürfen nicht als Client-Abwesenheit zählen. Liegt der letzte
# erfolgreiche Poll länger zurück, wird die Lücke allen _seen_at gutgeschrieben.
DOWNTIME_GRACE_SECONDS = 3600

# Verzögerung des Purge-Laufs nach dem Setup, damit das Plattform-Setup und die
# Restore-States von Home Assistant vollständig durch sind.
PURGE_STARTUP_DELAY = 60

# MACs, die vom automatischen Entfernen ausgenommen sind.
CONF_PURGE_EXCLUDE = "purge_exclude"

# Tägliche Purge-Zeit (lokale Zeit, im UI änderbar)
CONF_PURGE_TIME = "purge_time"
DEFAULT_PURGE_TIME = "19:00:00"

# --- Benachrichtigungen ----------------------------------------------------

CONF_NOTIFY_SERVICE = "notify_service"
CONF_PERSISTENT_NOTIFICATION = "persistent_notification"
CONF_NOTIFY_WHEN_EMPTY = "notify_when_empty"

# Sentinel für "keine Push-Benachrichtigung" im Dropdown.
NOTIFY_NONE = "none"

CONF_NOTIFY_NEW_CLIENTS = "notify_new_clients"
DEFAULT_NOTIFY_NEW_CLIENTS = True

# Push, wenn der Controller länger nicht antwortet, und Entwarnung danach.
CONF_NOTIFY_CONTROLLER_OFFLINE = "notify_controller_offline"
DEFAULT_NOTIFY_CONTROLLER_OFFLINE = True

# Wohin ein Tipp auf die Meldung eines Clients führt: die Geräteansicht im
# Panel dieser Integration oder die Geräteseite von Home Assistant. Die
# HA-Geräteseite ist für alle gedacht, die das Panel nicht nutzen.
CONF_NOTIFY_CLICK_TARGET = "notify_click_target"
CLICK_TARGET_PANEL = "panel"
CLICK_TARGET_DEVICE = "device"
CLICK_TARGETS = (CLICK_TARGET_PANEL, CLICK_TARGET_DEVICE)
DEFAULT_NOTIFY_CLICK_TARGET = CLICK_TARGET_PANEL

# Inhalt der Neugeräte-Meldung, einzeln im UI schaltbar.
CONF_MSG_NAME = "message_name"
CONF_MSG_CONNECTION = "message_connection"
CONF_MSG_SSID = "message_ssid"
CONF_MSG_ACCESS_POINT = "message_access_point"
CONF_MSG_IP = "message_ip"
CONF_MSG_MAC = "message_mac"

# Reihenfolge bestimmt zugleich die Reihenfolge in der Meldung.
MESSAGE_FIELDS: tuple[tuple[str, bool], ...] = (
    (CONF_MSG_NAME, True),
    (CONF_MSG_CONNECTION, True),
    (CONF_MSG_SSID, True),
    (CONF_MSG_ACCESS_POINT, True),
    (CONF_MSG_IP, True),
    (CONF_MSG_MAC, False),
)

NEW_CLIENT_TAG_PREFIX = "unifi_dynamic_new"

# Eigener Tag für die Bestätigung nach einer Meldungsaktion, bewusst nicht
# NEW_CLIENT_TAG_PREFIX: iOS entfernt eine Meldung meist automatisch, sobald
# eine Aktion darauf getippt wird. Teilt sich die Bestätigung den Tag mit der
# schon entfernten Neugeräte-Meldung, kommt sie je nach Timing nicht mehr als
# eigener Banner an.
ACTION_CONFIRM_TAG_PREFIX = "unifi_dynamic_confirm"

# Ab dieser Anzahl gleichzeitig neuer Clients kommt eine Sammelmeldung statt
# einer Meldung pro Gerät.
MAX_NEW_CLIENT_MESSAGES = 5

# Fehlt beim ersten Auftauchen noch eine der Angaben, die laut Einstellungen in
# der Meldung stehen sollen, wird die Meldung zurückgehalten. In dieser Zeit
# pollt der Coordinator weiter und zieht Hostname, IP, SSID und AP-Name nach.
# Gesendet wird, sobald alles beisammen ist, spätestens nach Ablauf der Grenze.
NEW_CLIENT_WAIT_TIMEOUT = 120
NEW_CLIENT_WAIT_INTERVAL = 5

# Klickziele der Push-Meldungen. Relative Pfade, die Companion-App löst sie
# gegen die eigene Instanz auf.
NOTIFICATION_URL = "/config/integrations/integration/unifi_dynamic"
DEVICE_URL_TEMPLATE = "/config/devices/device/{device_id}"

# Mitgeliefertes Bild für die Companion-App. Der Ordner brand/ wird beim Setup
# als statischer Pfad registriert und ist damit ohne Authentifizierung
# abrufbar, wie /local/. Nichts zu konfigurieren.
STATIC_URL_PATH = "/unifi_dynamic"
BRAND_DIR = "brand"
PUSH_IMAGE_FILE = "icon.png"
PUSH_IMAGE_URL = f"{STATIC_URL_PATH}/{PUSH_IMAGE_FILE}"

# Eigener hass.data-Schlüssel: hass.data[DOMAIN] bildet ausschliesslich
# entry_id -> Coordinator ab und darf keine Fremdschlüssel enthalten.
DATA_PUSH_IMAGE = "unifi_dynamic_push_image"

# --- Panel -------------------------------------------------------------
# Eigene Seite im Menü: Tabelle aller Clients mit Suche, Filtern und
# Aktionen (löschen, Ausnahmeliste) je Zeile. Einmal pro Home-Assistant-
# Instanz registriert, nicht pro Config-Entry - bei mehreren UniFi-Hosts
# erscheint trotzdem nur ein Menüeintrag, die Tabelle zeigt alle Hosts.
# Als eingebautes iframe-Panel von Home Assistant, nicht als Custom Panel:
# HA rendert dann selbst die Kopfzeile mit Menü-Button (inkl. Punkt für
# Mitteilungen) und Safe-Area-Abstand, und die Seite im iframe hat eine
# feste, von HA vorgegebene Höhe - siehe panel/panel.html.
PANEL_URL_PATH = "unifi-dynamic"
PANEL_TITLE = "UniFi Dynamic Clients"
PANEL_ICON = "mdi:lan-check"
# Deep-Link auf die Geräteansicht im Panel. Das Panel liest die Parameter aus
# der URL von Home Assistant (nicht aus der iframe-URL, die fix ist).
PANEL_CLIENT_URL_TEMPLATE = f"/{PANEL_URL_PATH}?entry={{entry_id}}&mac={{mac}}"
PANEL_DIR = "panel"
PANEL_HTML_FILE = "panel.html"
PANEL_STATIC_URL_PATH = f"{STATIC_URL_PATH}/panel"
# Versionsstempel als Cache-Buster an der Seiten-URL; panel.html reicht ihn
# an den Import der JS-Datei weiter. Wird bei jeder Änderung an panel.html
# oder am Panel-JS von Hand erhöht, unabhängig von der Integrationsversion.
PANEL_VERSION = "17"
PANEL_PAGE_URL = f"{PANEL_STATIC_URL_PATH}/{PANEL_HTML_FILE}?v={PANEL_VERSION}"

DATA_PANEL_REGISTERED = "unifi_dynamic_panel_registered"
DATA_WS_REGISTERED = "unifi_dynamic_ws_registered"

# WebSocket-Befehle für das Panel. Eigener Weg neben Service und
# Meldungsaktion, ruft dieselbe Coordinator-Logik auf.
WS_TYPE_LIST_CLIENTS = f"{DOMAIN}/list_clients"
WS_TYPE_REMOVE_CLIENT = f"{DOMAIN}/remove_client"
WS_TYPE_EXCLUDE_CLIENT = f"{DOMAIN}/exclude_client"
WS_TYPE_UNEXCLUDE_CLIENT = f"{DOMAIN}/unexclude_client"
WS_TYPE_LIST_DEVICES = f"{DOMAIN}/list_devices"
WS_TYPE_LINK_DEVICE = f"{DOMAIN}/link_device"

# Android ersetzt Meldungen mit gleichem Tag, statt sie zu stapeln.
NOTIFICATION_TAG_PREFIX = "unifi_dynamic_purge"

# --- Ausgesetzte Purge-Läufe ----------------------------------------------
# Gründe, aus denen ein Lauf nichts entfernt hat. "disabled" ist der
# Normalfall bei purge_days=0 und wird nicht gemeldet; "no_contact" heisst,
# dass der Controller zu lange nicht erreichbar war, und wird gemeldet.
PURGE_SKIP_DISABLED = "disabled"
PURGE_SKIP_NO_CONTACT = "no_contact"

# --- Aktionen in Push-Meldungen --------------------------------------------
# Beide Companion-Apps melden einen getippten Aktionsbutton über dieses Event
# zurück, mit dem Aktions-Key im Feld "action". Auf action_data wird bewusst
# verzichtet: iOS liest es aus dem Payload-Schlüssel "homeassistant", Android
# aus "action_data". Der Key trägt die Nutzdaten deshalb selbst.
EVENT_NOTIFICATION_ACTION = "mobile_app_notification_action"

# Aufbau: <AKTION>|<entry_id>|<mac ohne Doppelpunkte>
ACTION_EXCLUDE = "UNIFI_DYNAMIC_EXCLUDE"
ACTION_PURGE = "UNIFI_DYNAMIC_PURGE"
ACTION_SEPARATOR = "|"
# Anzeigetitel der Buttons und aller weiteren Meldungstitel: siehe msg.py,
# zweisprachig statt fest codiert.

# --- Überwachung der Controller-Erreichbarkeit -----------------------------
# Gezählt werden aufeinanderfolgende fehlgeschlagene Abfragen, nicht
# verstrichene Zeit: So hängt die Erkennung am eingestellten Abfrageintervall
# und bleibt bei jeder Wahl gleich streng. Gemeldet wird beim Erreichen der
# Schwelle, Entwarnung sofort beim nächsten erfolgreichen Poll.
CONF_OFFLINE_AFTER_FAILURES = "offline_after_failures"
DEFAULT_OFFLINE_AFTER_FAILURES = 30

CONTROLLER_TAG_PREFIX = "unifi_dynamic_controller"

DEFAULT_NOTIFY_SERVICE = NOTIFY_NONE
DEFAULT_PERSISTENT_NOTIFICATION = True
DEFAULT_NOTIFY_WHEN_EMPTY = False

# Gegenstück zu notify_when_empty, aber für die anhaltende Benachrichtigung.
# Vorgabe True, damit sich das bisherige Verhalten nicht ändert.
CONF_PERSISTENT_WHEN_EMPTY = "persistent_when_empty"
DEFAULT_PERSISTENT_WHEN_EMPTY = True

# Gegenstück zur Push-Meldung bei Controller-Ausfall. Die anhaltende Meldung
# bleibt stehen, solange die Störung besteht, und wird bei Entwarnung entfernt.
CONF_PERSISTENT_CONTROLLER_OFFLINE = "persistent_controller_offline"
DEFAULT_PERSISTENT_CONTROLLER_OFFLINE = True

# --- Services --------------------------------------------------------------

SERVICE_PURGE_NOW = "purge_now"
SERVICE_REMOVE_CLIENT = "remove_client"

ATTR_MAC = "mac"
ATTR_DEVICE_ID = "device_id"
ATTR_DRY_RUN = "dry_run"
ATTR_ENTRY_ID = "entry_id"
