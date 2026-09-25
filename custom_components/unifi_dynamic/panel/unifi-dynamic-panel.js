/**
 * Panel "UniFi Dynamic Clients": Tabelle aller Clients mit Suche, Filtern
 * und Aktionen (löschen, Ausnahmeliste) pro Zeile.
 *
 * Bewusst ein reines Vanilla-Web-Component ohne Lit oder sonstige externe
 * Bibliothek: Die Integration wird über HACS als reine Dateikopie
 * installiert, es gibt keinen Build-Schritt. Lit steht Panels (anders als
 * manchen Lovelace-Karten über Tricks) nicht als globales Modul zur
 * Verfügung; ein CDN-Import würde die Integration von Internetzugriff im
 * Browser abhängig machen. Ein Custom Element mit manuellem DOM-Handling
 * kommt ganz ohne das aus.
 *
 * Datenquelle: die WebSocket-Befehle unifi_dynamic/list_clients,
 * unifi_dynamic/remove_client, unifi_dynamic/exclude_client und
 * unifi_dynamic/unexclude_client aus __init__.py - dünne Wrapper um
 * dieselbe Coordinator-Logik, die auch die Push-Aktionen und der Service
 * unifi_dynamic.remove_client nutzen.
 *
 * Ein Tipp auf eine Zeile öffnet die Geräteansicht (Dialog) mit allen Daten,
 * den HA-Entitäten und denselben Aktionen wie das Zeilenmenü. Push-Meldungen
 * verlinken per ?entry=...&mac=... auf diese Ansicht (siehe _checkDeepLink).
 *
 * Läuft in panel.html, die Home Assistant als eingebautes iframe-Panel
 * einbettet. Kopfzeile, Menü-Button und Titel rendert HA selbst um das
 * iframe herum; dieses Element füllt das iframe und bekommt sein hass-
 * Objekt von panel.html (aus dem Elternfenster).
 */

const STRINGS = {
  de: {
    searchPlaceholder: "In allen Spalten suchen…",
    filterPlaceholder: "Filter…",
    ipPlaceholder: "z.B. 192.168.1.",
    optAll: "Alle",
    seen1h: "< 1 Std.",
    seen24h: "< 24 Std.",
    seen7d: "> 7 Tage",
    activeFilters: "Aktive Filter:",
    clearAll: "Alle entfernen",
    filtersTitle: "Spaltenfilter",
    columnsBtn: "Spalten",
    columnsTitle: "Spalten anzeigen",
    columnsAll: "Alle einblenden",
    showN: (n, total) => `${n} von ${total} Clients anzeigen`,
    footer: (n, total, time) => `${n} von ${total} Clients angezeigt · Stand ${time}`,
    footerHint: "Zeile antippen für Details",
    protectedTitle: "Vor automatischem Löschen geschützt",
    statsGroup: "Status-Filter",
    statTotal: (n) => (n === 1 ? "Gerät" : "Geräte"),
    statOnline: "online",
    statOffline: "offline",
    statShowAll: "Alle anzeigen",
    statShowOnline: "Nur Online-Geräte anzeigen",
    statShowOffline: "Nur Offline-Geräte anzeigen",
    filterConnAll: "Alle Verbindungen",
    filterConnWired: "Kabel",
    filterConnWireless: "WLAN",
    colName: "Alias",
    colLinked: "HA-Gerät",
    colIp: "IP",
    colMac: "MAC",
    colSsid: "SSID",
    colAp: "Access Point",
    colConn: "Verbindung",
    colSeen: "Zuletzt gesehen",
    colStatus: "Status",
    colActions: "",
    statusOnline: "Online",
    statusOffline: "Offline",
    connWired: "Kabel",
    connWireless: "WLAN",
    connUnknown: "unbekannt",
    excludedBadge: "geschützt",
    menuDetails: "Details",
    menuOpenDevice: "HA-Geräteseite öffnen",
    menuExclude: "Vor automatischem Löschen schützen",
    menuUnexclude: "Nicht mehr schützen",
    menuRemove: "Löschen",
    confirmRemove: (name) =>
      `${name} jetzt entfernen? Ist der Client noch aktiv, wird er beim nächsten Abgleich neu angelegt.`,
    empty: "Keine Clients gefunden.",
    loading: "Lädt…",
    error: "Fehler beim Laden der Clientliste:",
    retry: "Erneut versuchen",
    resetFilters: "Filter zurücksetzen",
    clearSearch: "Suche leeren",
    multiHost: "Host",
    seenNever: "–",
    dialogClose: "Schliessen",
    fieldStatus: "Status",
    fieldConn: "Verbindung",
    fieldIp: "IP-Adresse",
    fieldMac: "MAC-Adresse",
    fieldHostname: "Hostname",
    fieldSsid: "SSID",
    fieldAp: "Access Point",
    fieldSignal: "Signal (RSSI)",
    fieldFirstSeen: "Zuerst gesehen",
    fieldLastSeen: "Zuletzt gesehen",
    fieldHost: "UniFi-Host",
    signalLast: "zuletzt gemessen",
    unknown: "unbekannt",
    secEntities: "Entitäten",
    entitiesNone: "Keine Entitäten.",
    entitiesNoDevice: "Home Assistant hat für diesen Client noch kein Gerät angelegt.",
    notFound: "Dieser Client ist nicht (mehr) vorhanden.",
    actionFailed: "Aktion fehlgeschlagen:",
    copy: (what) => `${what} kopieren`,
    copied: (value) => `Kopiert: ${value}`,
    copyFailed: "Kopieren nicht möglich - der Browser erlaubt keinen Zugriff auf die Zwischenablage.",
    secLinked: "Verknüpftes Gerät",
    secNetwork: "Netzwerk",
    quickOpenDevice: "HA-Geräteseite",
    quickProtect: "Schützen",
    quickUnprotect: "Schutz aufheben",
    linkedNone: "Kein Home-Assistant-Gerät verknüpft.",
    linkAdd: "Gerät verknüpfen…",
    linkChange: "Ändern",
    linkRemove: "Verknüpfung entfernen",
    linkCancel: "Abbrechen",
    linkOpen: (name) => `Geräteseite von ${name} öffnen`,
    pickerSearch: "Gerät suchen (Name, Bereich, Hersteller)…",
    pickerSuggested: "Passt zur MAC-Adresse",
    pickerAll: "Alle Geräte",
    pickerNone: "Kein Gerät gefunden.",
    pickerMore: (n) => `${n} weitere - Suche verfeinern.`,
    pickerCurrent: "verknüpft",
    pickerHideLinked: "Bereits verknüpfte ausblenden",
    pickerLinkedTo: (names) => `Bereits verknüpft mit: ${names}`,
    pickerHiddenCount: (n) =>
      n === 1 ? "1 bereits verknüpftes Gerät ausgeblendet." : `${n} bereits verknüpfte Geräte ausgeblendet.`,
  },
  en: {
    searchPlaceholder: "Search all columns…",
    filterPlaceholder: "Filter…",
    ipPlaceholder: "e.g. 192.168.1.",
    optAll: "All",
    seen1h: "< 1 h",
    seen24h: "< 24 h",
    seen7d: "> 7 days",
    activeFilters: "Active filters:",
    clearAll: "Clear all",
    filtersTitle: "Column filters",
    columnsBtn: "Columns",
    columnsTitle: "Show columns",
    columnsAll: "Show all",
    showN: (n, total) => `Show ${n} of ${total} clients`,
    footer: (n, total, time) => `${n} of ${total} clients shown · as of ${time}`,
    footerHint: "Tap a row for details",
    protectedTitle: "Protected from automatic removal",
    statsGroup: "Status filter",
    statTotal: (n) => (n === 1 ? "device" : "devices"),
    statOnline: "online",
    statOffline: "offline",
    statShowAll: "Show all",
    statShowOnline: "Show online devices only",
    statShowOffline: "Show offline devices only",
    filterConnAll: "All connections",
    filterConnWired: "Wired",
    filterConnWireless: "Wireless",
    colName: "Alias",
    colLinked: "HA device",
    colIp: "IP",
    colMac: "MAC",
    colSsid: "SSID",
    colAp: "Access point",
    colConn: "Connection",
    colSeen: "Last seen",
    colStatus: "Status",
    colActions: "",
    statusOnline: "Online",
    statusOffline: "Offline",
    connWired: "Wired",
    connWireless: "Wireless",
    connUnknown: "unknown",
    excludedBadge: "protected",
    menuDetails: "Details",
    menuOpenDevice: "Open HA device page",
    menuExclude: "Protect from automatic removal",
    menuUnexclude: "Stop protecting",
    menuRemove: "Remove",
    confirmRemove: (name) =>
      `Remove ${name} now? If the client is still active, it will be recreated on the next sync.`,
    empty: "No clients found.",
    loading: "Loading…",
    error: "Failed to load the client list:",
    retry: "Retry",
    resetFilters: "Reset filters",
    clearSearch: "Clear search",
    multiHost: "Host",
    seenNever: "–",
    dialogClose: "Close",
    fieldStatus: "Status",
    fieldConn: "Connection",
    fieldIp: "IP address",
    fieldMac: "MAC address",
    fieldHostname: "Hostname",
    fieldSsid: "SSID",
    fieldAp: "Access point",
    fieldSignal: "Signal (RSSI)",
    fieldFirstSeen: "First seen",
    fieldLastSeen: "Last seen",
    fieldHost: "UniFi host",
    signalLast: "last measured",
    unknown: "unknown",
    secEntities: "Entities",
    entitiesNone: "No entities.",
    entitiesNoDevice: "Home Assistant has not created a device for this client yet.",
    notFound: "This client does not exist (anymore).",
    actionFailed: "Action failed:",
    copy: (what) => `Copy ${what}`,
    copied: (value) => `Copied: ${value}`,
    copyFailed: "Could not copy - the browser does not allow access to the clipboard.",
    secLinked: "Linked device",
    secNetwork: "Network",
    quickOpenDevice: "HA device page",
    quickProtect: "Protect",
    quickUnprotect: "Stop protecting",
    linkedNone: "No Home Assistant device linked.",
    linkAdd: "Link a device…",
    linkChange: "Change",
    linkRemove: "Remove link",
    linkCancel: "Cancel",
    linkOpen: (name) => `Open device page of ${name}`,
    pickerSearch: "Search devices (name, area, manufacturer)…",
    pickerSuggested: "Matches the MAC address",
    pickerAll: "All devices",
    pickerNone: "No device found.",
    pickerMore: (n) => `${n} more - refine the search.`,
    pickerCurrent: "linked",
    pickerHideLinked: "Hide already linked",
    pickerLinkedTo: (names) => `Already linked to: ${names}`,
    pickerHiddenCount: (n) =>
      n === 1 ? "1 already linked device hidden." : `${n} already linked devices hidden.`,
  },
};

function pickLang(hass) {
  const lang = String((hass && hass.language) || "").toLowerCase();
  return lang === "de" || lang.startsWith("de-") ? "de" : "en";
}

const POLL_INTERVAL_MS = 10000;

// Ein Klick kurz nach einer Scrollbewegung zählt nicht als Tipp auf die
// Zeile: Auf dem Handy stoppt ein Tipp in eine laufende Schwungbewegung nur
// das Scrollen, er soll nicht zusätzlich die Geräteansicht öffnen.
const SCROLL_CLICK_GUARD_MS = 300;

// Wie lange ein Kopieren-Button nach dem Kopieren das Häkchen zeigt.
const COPIED_FEEDBACK_MS = 1500;

// Höchstzahl Geräte in der Auswahlliste ohne Suchbegriff bzw. pro Suche;
// eine Liste mit Hunderten Einträgen wäre auf dem Handy nicht bedienbar.
const PICKER_LIMIT = 50;

// Material Design Icons (mdi:content-copy, mdi:check), inline statt über
// ha-icon, weil das iframe HAs Komponenten nicht kennt.
const ICON_COPY =
  "M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z";
const ICON_CHECK = "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z";

// Derselbe statische Pfad, unter dem __init__.py (_async_register_brand_path)
// bereits brand/icon.png für die Push-Meldungen ausliefert - hier
// wiederverwendet statt neu übergeben, da fest und ohnehin schon öffentlich
// erreichbar. onerror im Template blendet das Bild aus, falls es fehlt
// (z.B. wenn die Registrierung in __init__.py fehlgeschlagen ist), statt
// ein kaputtes Bild-Icon zu zeigen.
const BRAND_ICON_URL = "/unifi_dynamic/icon.png";

// Suche, Filter und Sortierung überleben einen Browser-Neuladen und auch
// einen HA-Neustart, weil localStorage rein clientseitig ist und nichts mit
// dem HA-Prozess zu tun hat - kein eigener Server-Speicher nötig. Bewusst
// pro Browser/Gerät, nicht geräteübergreifend synchronisiert.
const STORAGE_KEY = "unifi_dynamic_panel_prefs";
const SORT_KEYS = ["name", "linked", "ip", "mac", "essid", "ap_name", "conn", "seen_at", "status"];
const ONLINE_FILTERS = ["all", "online", "offline"];
const CONN_FILTERS = ["all", "wired", "wireless"];
const SEEN_FILTERS = ["all", "1h", "24h", "7d"];
// Spalten mit Textfilter (Schlüssel = Feld bzw. Sortierschlüssel).
const TEXT_FILTER_KEYS = ["name", "linked", "ip", "mac", "essid", "ap_name"];
// Ausblendbare Spalten mit Beschriftung und Position in der Tabelle
// (1-basiert, für nth-child). Alias (1) und das Menü (10) bleiben immer
// sichtbar: ohne Alias fehlte der Einstieg in die Geräteansicht.
const HIDEABLE_COLUMNS = [
  ["linked", "colLinked", 2],
  ["ip", "colIp", 3],
  ["mac", "colMac", 4],
  ["essid", "colSsid", 5],
  ["ap_name", "colAp", 6],
  ["conn", "colConn", 7],
  ["seen_at", "colSeen", 8],
  ["status", "colStatus", 9],
];
const HIDEABLE_KEYS = HIDEABLE_COLUMNS.map(([key]) => key);

// Material Design Icons als Pfade; das iframe kennt HAs ha-icon nicht.
const ICONS = {
  wifi: "M12,21L15.6,16.2C14.6,15.45 13.35,15 12,15C10.65,15 9.4,15.45 8.4,16.2L12,21M12,3C7.95,3 4.21,4.34 1.2,6.6L3,9C5.5,7.12 8.62,6 12,6C15.38,6 18.5,7.12 21,9L22.8,6.6C19.79,4.34 16.05,3 12,3M12,9C9.3,9 6.81,9.89 4.8,11.4L6.6,13.8C8.1,12.67 9.97,12 12,12C14.03,12 15.9,12.67 17.4,13.8L19.2,11.4C17.19,9.89 14.7,9 12,9Z",
  eth: "M7,15H9V18H11V15H13V18H15V15H17V18H19V9H15V6H9V9H5V18H7V15M4.38,3H19.63C20.94,3 22,4.06 22,5.38V19.63A2.37,2.37 0 0,1 19.63,22H4.38C3.06,22 2,20.94 2,19.63V5.38C2,4.06 3.06,3 4.38,3Z",
  unknown: "M10,19H13V22H10V19M12,2C17.35,2.22 19.68,7.62 16.5,11.67C15.67,12.67 14.33,13.33 13.67,14.17C13,15 13,16 13,17H10C10,15.33 10,13.92 10.67,12.92C11.33,11.92 12.67,11.33 13.5,10.67C15.92,8.43 15.32,5.26 12,5A3,3 0 0,0 9,8H6A6,6 0 0,1 12,2Z",
  link: "M3.9,12C3.9,10.29 5.29,8.9 7,8.9H11V7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H11V15.1H7C5.29,15.1 3.9,13.71 3.9,12M8,13H16V11H8V13M17,7H13V8.9H17C18.71,8.9 20.1,10.29 20.1,12C20.1,13.71 18.71,15.1 17,15.1H13V17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7Z",
  kebab: "M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z",
  shield: "M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z",
  shieldOff: "M1,4.27L2.28,3L21,21.72L19.73,23L17.3,20.57C15.8,21.72 14,22.57 12,23C6.84,21.74 3,16.55 3,11V6.27L1,4.27M12,1L21,5V11C21,13.53 20.2,16 18.8,18.06L4.72,4L12,1Z",
  search: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  filter: "M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z",
  reset: "M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z",
  info: "M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  open: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  trash: "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z",
  columns: "M16,5V18H21V5M4,18H9V5H4M10,18H15V5H10V18Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  device: "M4,6H20V16H4M20,18A2,2 0 0,0 22,16V6C22,4.89 21.1,4 20,4H4C2.89,4 2,4.89 2,6V16A2,2 0 0,0 4,18H0V20H24V18H20Z",
  entity: "M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7Z",
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"></path></svg>`;
}

// Signalstärke in Balken (1-4) aus dem dBm-Wert des Controllers.
function signalBars(dbm) {
  if (typeof dbm !== "number") return 0;
  if (dbm >= -60) return 4;
  if (dbm >= -67) return 3;
  if (dbm >= -75) return 2;
  return 1;
}

const DEFAULT_PREFS = {
  search: "",
  onlineFilter: "all",
  connFilter: "all",
  // Spaltenfilter: Text pro Spalte (siehe TEXT_FILTER_KEYS) und die Auswahl
  // bei "Zuletzt gesehen". Verbindung und Status nutzen connFilter bzw.
  // onlineFilter - dieselben Zustände wie früher, nur mit neuem Bedienort.
  colFilters: {},
  seenFilter: "all",
  // Ausgeblendete Spalten (Schlüssel aus HIDEABLE_COLUMNS). Gehört zur
  // Ansicht, nicht zu den Filtern: "Filter zurücksetzen" lässt sie stehen.
  hiddenCols: [],
  sortKey: null,
  sortDir: "asc",
  // Geräteauswahl: bei anderen Clients schon verknüpfte Geräte ausblenden
  // statt nur markieren. Gilt nur für die Auswahl, nicht für die Tabelle.
  hideLinked: false,
};

// Fehler beim Lesen/Schreiben werden bewusst nur geloggt, nie geworfen:
// private Browserfenster, blockierter Storage-Zugriff oder ein voller
// Speicher dürfen das Panel nicht lahmlegen, nur die Persistenz entfällt.
function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      search: typeof parsed.search === "string" ? parsed.search : DEFAULT_PREFS.search,
      onlineFilter: ONLINE_FILTERS.includes(parsed.onlineFilter)
        ? parsed.onlineFilter
        : DEFAULT_PREFS.onlineFilter,
      connFilter: CONN_FILTERS.includes(parsed.connFilter)
        ? parsed.connFilter
        : DEFAULT_PREFS.connFilter,
      colFilters: Object.fromEntries(
        TEXT_FILTER_KEYS.filter(
          (k) => parsed.colFilters && typeof parsed.colFilters[k] === "string" && parsed.colFilters[k]
        ).map((k) => [k, parsed.colFilters[k]])
      ),
      seenFilter: SEEN_FILTERS.includes(parsed.seenFilter) ? parsed.seenFilter : "all",
      hiddenCols: Array.isArray(parsed.hiddenCols)
        ? HIDEABLE_KEYS.filter((k) => parsed.hiddenCols.includes(k))
        : [],
      sortKey: SORT_KEYS.includes(parsed.sortKey) ? parsed.sortKey : DEFAULT_PREFS.sortKey,
      sortDir: parsed.sortDir === "desc" ? "desc" : DEFAULT_PREFS.sortDir,
      hideLinked: parsed.hideLinked === true,
    };
  } catch (err) {
    console.warn("unifi-dynamic-panel: Einstellungen konnten nicht geladen werden", err);
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn("unifi-dynamic-panel: Einstellungen konnten nicht gespeichert werden", err);
  }
}

class UnifiDynamicPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._clients = [];
    this._hostCount = 0;
    this._loading = true;
    this._error = null;

    const prefs = loadPrefs();
    this._search = prefs.search;
    this._onlineFilter = prefs.onlineFilter;
    this._connFilter = prefs.connFilter;
    this._colFilters = { ...prefs.colFilters };
    this._seenFilter = prefs.seenFilter;
    this._hiddenCols = new Set(prefs.hiddenCols);
    this._colsOpen = false;
    this._sortKey = prefs.sortKey;
    this._sortDir = prefs.sortDir;
    this._hideLinked = prefs.hideLinked;

    this._openMenuKey = null;
    this._pollTimer = null;
    this._built = false;

    // Geräteansicht: Schlüssel "entry_id|mac" des angezeigten Clients, das
    // zuletzt gerenderte HTML (nur bei Änderung neu aufbauen, sonst verlöre
    // ein Button bei jedem Polling den Fokus) und ein Fehler der letzten
    // Aktion im Dialog.
    this._dialogKey = null;
    this._dialogHtml = "";
    this._dialogError = null;
    this._lastScrollAt = 0;
    this._lastFetchAt = null;
    // Wert, dessen Kopieren-Button gerade das Häkchen zeigt.
    this._copiedValue = null;
    this._copiedTimer = null;
    // Geräteauswahl für die Verknüpfung: offen/zu, Suchbegriff, die per
    // WebSocket geholte Geräteliste (null = noch nicht geladen) und ein
    // Ladefehler.
    this._pickerOpen = false;
    this._pickerQuery = "";
    this._devices = null;
    this._devicesError = null;
    this._onParentLocation = () => this._checkDeepLink();
  }

  _savePrefs() {
    savePrefs({
      search: this._search,
      onlineFilter: this._onlineFilter,
      connFilter: this._connFilter,
      colFilters: this._colFilters,
      seenFilter: this._seenFilter,
      hiddenCols: HIDEABLE_KEYS.filter((k) => this._hiddenCols.has(k)),
      sortKey: this._sortKey,
      sortDir: this._sortDir,
      hideLinked: this._hideLinked,
    });
  }

  // Wird von panel.html gesetzt: das hass-Objekt des Elternfensters, beim
  // Start und danach regelmässig neu (HA ersetzt es bei jeder Änderung).
  set hass(hass) {
    const firstRun = !this._hass;
    this._hass = hass;
    if (!this._built) {
      this._buildStaticLayout();
      this._built = true;
    }
    if (firstRun) {
      this._fetchClients();
      this._startPolling();
    }
    // Entitätszustände im offenen Dialog aktuell halten.
    this._renderDialog();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    if (this._hass && !this._built) {
      this._buildStaticLayout();
      this._built = true;
    }
    this._startPolling();
    this._watchParentLocation(true);
  }

  disconnectedCallback() {
    this._stopPolling();
    this._watchParentLocation(false);
  }

  // Ist das Panel schon offen, wechselt HA bei einem Tipp auf eine weitere
  // Meldung nur die URL, das iframe bleibt stehen. Deshalb auf die
  // Navigation im Elternfenster hören, nicht nur beim Start prüfen.
  _watchParentLocation(on) {
    let parentWin;
    try {
      parentWin = window.parent;
      if (!parentWin || parentWin === window) return;
      const method = on ? "addEventListener" : "removeEventListener";
      parentWin[method]("location-changed", this._onParentLocation);
      parentWin[method]("popstate", this._onParentLocation);
    } catch (err) {
      // Anderer Ursprung (nicht in HA eingebettet): ohne Deep-Link weiter.
    }
  }

  _t(key) {
    return STRINGS[pickLang(this._hass)][key];
  }

  _startPolling() {
    this._stopPolling();
    this._pollTimer = window.setInterval(
      () => this._fetchClients(),
      POLL_INTERVAL_MS
    );
  }

  _stopPolling() {
    if (this._pollTimer) {
      window.clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async _fetchClients() {
    if (!this._hass) return;
    try {
      const result = await this._hass.callWS({ type: "unifi_dynamic/list_clients" });
      this._clients = result.clients || [];
      this._hostCount = new Set(this._clients.map((c) => c.entry_id)).size;
      this._lastFetchAt = new Date();
      this._error = null;
    } catch (err) {
      this._error = (err && err.message) || String(err);
    }
    this._loading = false;
    this._renderRows();
    if (!this._error) this._checkDeepLink();
  }

  // Fehler hier abfangen statt die Promise unbehandelt durchfallen zu
  // lassen: ohne try/catch verschwindet ein fehlgeschlagenes Entfernen
  // (z.B. Berechtigungsfehler) sang- und klanglos in der Browser-Konsole,
  // ohne dass in der Tabelle etwas darauf hindeutet.
  async _removeClient(entryId, mac) {
    try {
      await this._hass.callWS({
        type: "unifi_dynamic/remove_client",
        entry_id: entryId,
        mac,
      });
    } catch (err) {
      this._actionFailed(err);
      return false;
    }
    await this._fetchClients();
    return true;
  }

  async _excludeClient(entryId, mac) {
    try {
      await this._hass.callWS({
        type: "unifi_dynamic/exclude_client",
        entry_id: entryId,
        mac,
      });
    } catch (err) {
      this._actionFailed(err);
      return false;
    }
    await this._fetchClients();
    return true;
  }

  async _unexcludeClient(entryId, mac) {
    try {
      await this._hass.callWS({
        type: "unifi_dynamic/unexclude_client",
        entry_id: entryId,
        mac,
      });
    } catch (err) {
      this._actionFailed(err);
      return false;
    }
    await this._fetchClients();
    return true;
  }

  // Fehler einer Aktion: im Banner über der Tabelle und, falls die
  // Geräteansicht offen ist, auch dort - das Banner liegt sonst verdeckt
  // hinter dem Dialog.
  _actionFailed(err) {
    const text = (err && err.message) || String(err);
    this._error = text;
    if (this._dialogKey) this._dialogError = text;
    this._renderRows();
  }

  // Navigation gehört ins Elternfenster (Home Assistant selbst): im iframe
  // würde history.pushState sonst nur das iframe auf eine HA-URL schicken.
  // Gleiches Muster wie HAs eigene navigate()-Funktion: pushState plus
  // "location-changed" am window, auf das der HA-Router hört.
  _openDevice(deviceId) {
    if (!deviceId) return;
    this._navigate(`/config/devices/device/${deviceId}`, false);
  }

  _navigate(path, replace) {
    const target = window.parent || window;
    if (replace) {
      target.history.replaceState(target.history.state, "", path);
    } else {
      target.history.pushState(null, "", path);
    }
    target.dispatchEvent(
      new target.CustomEvent("location-changed", { detail: { replace } })
    );
  }

  // Deep-Link aus einer Push-Meldung: /unifi-dynamic?entry=...&mac=...
  // steht in der URL von Home Assistant, nicht in der des iframes (die ist
  // fest). Erst nach dem ersten erfolgreichen Laden auswerten, damit der
  // Dialog die Daten hat. Danach die Parameter aus der URL entfernen
  // (replace, kein neuer Verlaufseintrag), sonst öffnete ein Neuladen des
  // Panels den Dialog erneut.
  _checkDeepLink() {
    if (this._loading || this._error) return;
    let loc;
    try {
      loc = (window.parent || window).location;
    } catch (err) {
      return;
    }
    const params = new URLSearchParams(loc.search || "");
    const mac = String(params.get("mac") || "").trim().toLowerCase();
    if (!mac) return;
    const entryId = String(params.get("entry") || "").trim();
    // Passt die Entry-ID nicht (z.B. Integration neu eingerichtet), reicht
    // die MAC; unbekannt bleibt der Schlüssel trotzdem gesetzt und der
    // Dialog meldet "nicht vorhanden" statt still nichts zu tun.
    const hit =
      this._clients.find((c) => c.mac === mac && (!entryId || c.entry_id === entryId)) ||
      this._clients.find((c) => c.mac === mac);
    try {
      params.delete("mac");
      params.delete("entry");
      const rest = params.toString();
      this._navigate(`${loc.pathname}${rest ? `?${rest}` : ""}${loc.hash || ""}`, true);
    } catch (err) {
      // URL bleibt stehen, der Dialog öffnet trotzdem.
    }
    this._openDialog(hit ? `${hit.entry_id}|${hit.mac}` : `${entryId}|${mac}`);
  }

  _clientByKey(key) {
    return this._clients.find((c) => `${c.entry_id}|${c.mac}` === key) || null;
  }

  _openDialog(key) {
    const dialog = this.shadowRoot && this.shadowRoot.querySelector("dialog.device");
    if (!dialog) return;
    this._openMenuKey = null;
    this._dialogKey = key;
    this._dialogError = null;
    this._dialogHtml = "";
    this._pickerOpen = false;
    this._pickerQuery = "";
    this._renderRows();
    this._renderDialog();
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    dialog.scrollTop = 0;
  }

  _closeDialog() {
    const dialog = this.shadowRoot && this.shadowRoot.querySelector("dialog.device");
    this._dialogKey = null;
    this._dialogError = null;
    this._dialogHtml = "";
    this._pickerOpen = false;
    if (dialog && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }

  // Entitäten des HA-Geräts aus der Entity-Registry, die HA dem Frontend im
  // hass-Objekt mitgibt (hass.entities), mit Zustand aus hass.states.
  _deviceEntities(deviceId) {
    const hass = this._hass;
    if (!deviceId || !hass || !hass.entities) return [];
    return Object.values(hass.entities)
      .filter((e) => e && e.device_id === deviceId)
      .map((e) => {
        const stateObj = hass.states ? hass.states[e.entity_id] : undefined;
        const name =
          (stateObj && stateObj.attributes && stateObj.attributes.friendly_name) ||
          e.name ||
          e.entity_id;
        return { entityId: e.entity_id, name, value: this._formatEntityState(stateObj) };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  // HAs eigene Formatierung (Übersetzung, Einheit, Zeitstempel), sofern das
  // hass-Objekt sie anbietet (ab HA 2023.12); sonst Rohwert plus Einheit.
  _formatEntityState(stateObj) {
    if (!stateObj) return this._t("unknown");
    try {
      if (typeof this._hass.formatEntityState === "function") {
        return this._hass.formatEntityState(stateObj);
      }
    } catch (err) {
      // Rückfall unten.
    }
    const unit = stateObj.attributes && stateObj.attributes.unit_of_measurement;
    return unit ? `${stateObj.state} ${unit}` : String(stateObj.state);
  }

  // Öffnet HAs eigenen Entitäts-Dialog (mehr Infos, Verlauf) über dem Panel.
  _openMoreInfo(entityId) {
    try {
      const ha = (window.parent || window).document.querySelector("home-assistant");
      if (!ha) return;
      ha.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId },
          bubbles: true,
          composed: true,
        })
      );
    } catch (err) {
      console.warn("unifi-dynamic-panel: Entitäts-Dialog nicht verfügbar", err);
    }
  }

  // Abschnitt "Verknüpftes Gerät" in der Geräteansicht: entweder das
  // verknüpfte Gerät mit Ändern/Entfernen, oder die Geräteauswahl.
  _linkedSectionHtml(c) {
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const meta = (d) =>
      [d.area, [d.manufacturer, d.model].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" · ");

    if (!this._pickerOpen) {
      const d = c.linked_device;
      if (!d) {
        return `<div class="linked-empty"><span class="dlg-note">${esc(t("linkedNone"))}</span>
          <button class="link-add" data-dlg="link-open">${icon("link")}${esc(t("linkAdd"))}</button></div>`;
      }
      return `<div class="linked-card">
          <button class="linked-main" data-dlg="open-linked" data-linked-id="${esc(d.id)}"
            title="${esc(t("linkOpen")(d.name))}">
            <span class="ln-icon">${icon("device")}</span>
            <span class="ln-text"><span class="ln-name">${esc(d.name)}</span>
            ${meta(d) ? `<small>${esc(meta(d))}</small>` : ""}</span>
          </button>
          <div class="linked-actions">
            <button data-dlg="link-open">${esc(t("linkChange"))}</button>
            <button data-dlg="link-remove">${esc(t("linkRemove"))}</button>
          </div>
        </div>`;
    }

    let list;
    if (this._devicesError) {
      list = `<p class="dlg-note">${esc(t("error"))} ${esc(this._devicesError)}</p>
        <button class="link-add" data-dlg="link-retry">${esc(t("retry"))}</button>`;
    } else if (!this._devices) {
      list = `<p class="dlg-note">${esc(t("loading"))}</p>`;
    } else {
      const q = this._pickerQuery.trim().toLowerCase();
      const currentId = c.linked_device ? c.linked_device.id : null;
      const currentKey = `${c.entry_id}|${c.mac}`;
      // Geräte, die schon bei anderen Clients verknüpft sind, mit deren
      // Namen. Mehrere Clients pro Gerät sind erlaubt (z.B. LAN und WLAN
      // desselben Geräts), deshalb nur markieren bzw. wahlweise ausblenden,
      // nie sperren.
      const linkedElsewhere = new Map();
      for (const other of this._clients) {
        if (!other.linked_device || `${other.entry_id}|${other.mac}` === currentKey) continue;
        const names = linkedElsewhere.get(other.linked_device.id) || [];
        names.push(other.name);
        linkedElsewhere.set(other.linked_device.id, names);
      }
      const takenBy = (d) => (d.id === currentId ? null : linkedElsewhere.get(d.id) || null);
      const matches = (d) =>
        !q ||
        [d.name, d.area, d.manufacturer, d.model, ...(takenBy(d) || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      // Ausgeblendet werden nur bei anderen verknüpfte Geräte, nie das
      // eigene - sonst liesse sich die eigene Zuordnung nicht mehr sehen.
      let hiddenCount = 0;
      const visible = (d) => {
        if (!this._hideLinked || !takenBy(d)) return true;
        hiddenCount += 1;
        return false;
      };
      const item = (d) => {
        const taken = takenBy(d);
        return `<button class="pick${d.id === currentId ? " current" : ""}${taken ? " taken" : ""}"
          data-dlg="link-pick" data-device-id="${esc(d.id)}">
          <span class="ln-icon">${icon("device")}</span><span class="ln-text"><span class="ln-name">${esc(d.name)}${
            d.id === currentId ? ` <span class="badge excluded">${esc(t("pickerCurrent"))}</span>` : ""
          }</span>
          ${meta(d) ? `<small>${esc(meta(d))}</small>` : ""}
          ${taken ? `<small class="pick-taken">${esc(t("pickerLinkedTo")(taken.join(", ")))}</small>` : ""}
        </span></button>`;
      };
      const candidates = this._devices.filter((d) => matches(d) && visible(d));
      // Vorschläge: Geräte, die dieselbe MAC melden (Shelly, Sonos, ...).
      // Bleiben oben, auch wenn schon verknüpft (dann mit Hinweis).
      const suggested = candidates.filter((d) => (d.macs || []).includes(c.mac));
      const suggestedIds = new Set(suggested.map((d) => d.id));
      // Freie Geräte zuerst, bereits verknüpfte ans Ende; innerhalb der
      // Gruppen bleibt die alphabetische Reihenfolge vom Backend.
      const rest = candidates.filter((d) => !suggestedIds.has(d.id));
      rest.sort((a, b) => (takenBy(a) ? 1 : 0) - (takenBy(b) ? 1 : 0));
      const shown = rest.slice(0, PICKER_LIMIT);
      list = "";
      if (suggested.length) {
        list += `<div class="pick-group">${esc(t("pickerSuggested"))}</div>${suggested
          .map(item)
          .join("")}`;
      }
      if (shown.length) {
        list += `${suggested.length ? `<div class="pick-group">${esc(t("pickerAll"))}</div>` : ""}${shown
          .map(item)
          .join("")}`;
      }
      if (!suggested.length && !shown.length) {
        list = `<p class="dlg-note">${esc(t("pickerNone"))}</p>`;
      }
      if (rest.length > shown.length) {
        list += `<p class="dlg-note">${esc(t("pickerMore")(rest.length - shown.length))}</p>`;
      }
      if (hiddenCount) {
        list += `<p class="dlg-note">${esc(t("pickerHiddenCount")(hiddenCount))}</p>`;
      }
    }

    return `<div class="picker">
        <div class="picker-bar">
          ${icon("search")}<input type="search" data-dlg="picker-search" placeholder="${esc(
            t("pickerSearch")
          )}" value="${esc(this._pickerQuery)}" autocomplete="off" />
          <button data-dlg="link-cancel">${esc(t("linkCancel"))}</button>
        </div>
        <label class="picker-toggle">
          <input type="checkbox" data-dlg="picker-hide-linked" ${this._hideLinked ? "checked" : ""} />
          ${esc(t("pickerHideLinked"))}
        </label>
        <div class="picker-list">${list}</div>
      </div>`;
  }

  async _openPicker() {
    this._pickerOpen = true;
    this._pickerQuery = "";
    this._devicesError = null;
    this._renderDialog();
    const input = this.shadowRoot.querySelector('[data-dlg="picker-search"]');
    if (input) input.focus();
    // Liste bei jedem Öffnen frisch holen: neue oder umbenannte Geräte.
    try {
      const result = await this._hass.callWS({ type: "unifi_dynamic/list_devices" });
      this._devices = result.devices || [];
    } catch (err) {
      this._devicesError = (err && err.message) || String(err);
    }
    this._renderDialog();
  }

  async _linkDevice(c, deviceId) {
    try {
      await this._hass.callWS({
        type: "unifi_dynamic/link_device",
        entry_id: c.entry_id,
        mac: c.mac,
        device_id: deviceId,
      });
    } catch (err) {
      this._actionFailed(err);
      return false;
    }
    this._pickerOpen = false;
    await this._fetchClients();
    return true;
  }

  _copyButtonHtml(value, label) {
    const done = this._copiedValue === value;
    const title = this._escape(this._t("copy")(label));
    return `<button class="copy-btn${done ? " done" : ""}" data-dlg="copy" data-copy="${this._escape(
      value
    )}" title="${title}" aria-label="${title}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${
      done ? ICON_CHECK : ICON_COPY
    }"></path></svg></button>`;
  }

  // Kopiert in die Zwischenablage. Reihenfolge der Wege:
  // 1. Clipboard-API des Elternfensters (HA selbst): nicht von der
  //    Permissions-Policy des iframes abhängig.
  // 2. Clipboard-API des iframes.
  // 3. execCommand("copy") über ein verstecktes Textfeld - nötig, wenn HA
  //    über http:// statt https:// läuft: Dort gibt es navigator.clipboard
  //    gar nicht (nur in sicheren Kontexten), execCommand geht trotzdem.
  async _copy(value) {
    const text = String(value || "");
    if (!text) return;
    let ok = false;
    const apis = [];
    try {
      if (window.parent && window.parent !== window) apis.push(window.parent.navigator.clipboard);
    } catch (err) {
      // Anderer Ursprung: nur die eigenen Wege.
    }
    apis.push(navigator.clipboard);
    for (const api of apis) {
      if (ok || !api || typeof api.writeText !== "function") continue;
      try {
        await api.writeText(text);
        ok = true;
      } catch (err) {
        // Nächster Weg.
      }
    }
    if (!ok) ok = this._copyFallback(text);

    this._toast(ok ? this._t("copied")(text) : this._t("copyFailed"));
    if (!ok) return;
    this._copiedValue = text;
    window.clearTimeout(this._copiedTimer);
    this._copiedTimer = window.setTimeout(() => {
      this._copiedValue = null;
      this._renderDialog();
    }, COPIED_FEEDBACK_MS);
    this._renderDialog();
  }

  _copyFallback(text) {
    // Das Textfeld muss im Dialog liegen: showModal macht alles ausserhalb
    // inert, dort liesse es sich nicht fokussieren und auswählen.
    const host =
      (this.shadowRoot && this.shadowRoot.querySelector("dialog.device[open]")) ||
      this.shadowRoot ||
      document.body;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
    host.appendChild(area);
    let ok = false;
    try {
      area.focus();
      area.select();
      area.setSelectionRange(0, text.length);
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    area.remove();
    return ok;
  }

  // Kurze Rückmeldung als HA-eigene Toast-Meldung unten im Bild (dasselbe
  // Ereignis, das HA intern nutzt). Ohne HA drumherum bleibt es beim
  // Häkchen am Button.
  _toast(message) {
    try {
      const ha = (window.parent || window).document.querySelector("home-assistant");
      if (!ha) return;
      ha.dispatchEvent(
        new CustomEvent("hass-notification", {
          detail: { message },
          bubbles: true,
          composed: true,
        })
      );
    } catch (err) {
      // Keine Toast-Meldung möglich, das Häkchen genügt.
    }
  }

  _formatRelative(epoch, short = false) {
    if (!epoch) return "";
    const diff = epoch - Date.now() / 1000;
    const abs = Math.abs(diff);
    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    try {
      const rtf = new Intl.RelativeTimeFormat(
        pickLang(this._hass) === "de" ? "de-CH" : "en-US",
        { numeric: "auto", style: short ? "short" : "long" }
      );
      for (const [unit, secs] of units) {
        if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
      }
      return rtf.format(0, "minute");
    } catch (err) {
      return "";
    }
  }

  _formatSignal(c) {
    const parts = [];
    if (typeof c.signal === "number") parts.push(`${c.signal} dBm`);
    if (typeof c.rssi === "number") parts.push(`RSSI ${c.rssi}`);
    if (!parts.length) return null;
    const text = parts.join(" · ");
    return c.online ? text : `${text} (${this._t("signalLast")})`;
  }

  _renderDialog() {
    const dialog = this.shadowRoot && this.shadowRoot.querySelector("dialog.device");
    if (!dialog || !this._dialogKey) return;
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const c = this._clientByKey(this._dialogKey);

    const closeBtn = `<button class="dlg-close" data-dlg="close" title="${esc(
      t("dialogClose")
    )}" aria-label="${esc(t("dialogClose"))}">${icon("close")}</button>`;
    const errorHtml = this._dialogError
      ? `<div class="dlg-error">${esc(t("actionFailed"))} ${esc(this._dialogError)}</div>`
      : "";

    let html;
    if (!c) {
      const mac = this._dialogKey.split("|")[1] || "";
      html = `
        <div class="dlg-head">
          <span class="dlg-avatar">${icon("unknown")}</span>
          <div class="dlg-title"><h2>${esc(mac)}</h2></div>
          ${closeBtn}
        </div>
        <div class="dlg-body"><p class="dlg-note">${esc(t("notFound"))}</p></div>`;
    } else {
      const kind = c.is_wired == null ? "unknown" : c.is_wired ? "eth" : "wifi";
      const connText =
        c.is_wired == null ? t("connUnknown") : c.is_wired ? t("connWired") : t("connWireless");
      const status = c.online
        ? `<span class="pill online"><span class="dot online"></span>${esc(t("statusOnline"))}</span>`
        : `<span class="pill offline"><span class="dot offline"></span>${esc(t("statusOffline"))}</span>`;
      const protectedBadge = c.excluded
        ? `<span class="pill protected">${icon("shield")}${esc(t("excludedBadge"))}</span>`
        : "";
      // Zeitpunkt absolut, darunter relativ.
      const timeValue = (epoch) =>
        epoch
          ? `${esc(this._formatSeen(epoch))}<small>${esc(this._formatRelative(epoch))}</small>`
          : `<span class="muted">${esc(t("unknown"))}</span>`;
      // Kachel: Beschriftung (mit Kopieren-Button, wenn es etwas zu
      // kopieren gibt) und Wert. Ohne Wert ein Strich und kein Button.
      const tile = (label, valueHtml, copyValue, wide) => `<div class="tile${wide ? " wide" : ""}">
          <div class="tile-k"><span>${esc(label)}</span>${
            copyValue ? this._copyButtonHtml(copyValue, label) : ""
          }</div>
          <div class="tile-v">${valueHtml}</div>
        </div>`;
      const text = (v, cls = "") =>
        v ? `<span class="${cls}">${esc(v)}</span>` : `<span class="muted">–</span>`;

      const tiles = [
        tile(t("fieldIp"), text(c.ip, "mono"), c.ip),
        tile(t("fieldMac"), text(c.mac, "mono"), c.mac),
        tile(t("fieldHostname"), text(c.hostname), c.hostname),
      ];
      // WLAN-Felder nur, wenn der Client nicht nachweislich am Kabel hängt.
      if (!c.is_wired) {
        tiles.push(tile(t("fieldSsid"), text(c.essid), c.essid));
        tiles.push(tile(t("fieldAp"), text(c.ap_name), c.ap_name));
        const signal = this._formatSignal(c);
        const bars = signalBars(c.signal);
        tiles.push(
          tile(
            t("fieldSignal"),
            signal
              ? `${esc(signal)}${
                  bars
                    ? ` <span class="bars s${bars}${c.online ? "" : " stale"}"><i></i><i></i><i></i><i></i></span>`
                    : ""
                }`
              : `<span class="muted">–</span>`
          )
        );
      }
      tiles.push(tile(t("fieldFirstSeen"), timeValue(c.first_seen)));
      tiles.push(tile(t("fieldLastSeen"), timeValue(c.seen_at)));
      tiles.push(tile(t("fieldConn"), `<span class="conn">${icon(kind)}${esc(connText)}</span>`));
      if (this._hostCount > 1) tiles.push(tile(t("fieldHost"), text(c.host)));

      let entitiesHtml;
      let entityCount = 0;
      if (!c.device_id) {
        entitiesHtml = `<p class="dlg-note">${esc(t("entitiesNoDevice"))}</p>`;
      } else {
        const entities = this._deviceEntities(c.device_id);
        entityCount = entities.length;
        entitiesHtml = entities.length
          ? `<ul class="entities">${entities
              .map(
                // Die ganze Zeile öffnet den Entitäts-Dialog; der Kopieren-
                // Button liegt darin und gewinnt beim Klick, weil
                // closest("[data-dlg]") zuerst ihn findet. Eine Zeile als
                // <button> ginge nicht: Buttons dürfen keine Buttons enthalten.
                (e) => `<li class="entity" role="button" tabindex="0" data-dlg="more-info" data-entity-id="${esc(
                  e.entityId
                )}">
                  <span class="ent-icon">${icon("entity")}</span>
                  <span class="ent-name">${esc(e.name)}<span class="ent-id"><small>${esc(
                    e.entityId
                  )}</small>${this._copyButtonHtml(e.entityId, "Entity-ID")}</span></span>
                  <span class="ent-state">${esc(e.value)}</span>
                </li>`
              )
              .join("")}</ul>`
          : `<p class="dlg-note">${esc(t("entitiesNone"))}</p>`;
      }

      html = `
        <div class="dlg-head">
          <span class="dlg-avatar">${icon(kind)}</span>
          <div class="dlg-title">
            <h2>${esc(c.name)}</h2>
            <div class="dlg-sub">${status}${protectedBadge}${
              c.hostname ? `<span class="dlg-host">${esc(c.hostname)}</span>` : ""
            }</div>
          </div>
          ${closeBtn}
        </div>
        <div class="dlg-quick">
          <button class="qbtn" data-dlg="open-device" ${c.device_id ? "" : "disabled"}>${icon(
            "open"
          )}${esc(t("menuOpenDevice"))}</button>
          <button class="qbtn" data-dlg="${c.excluded ? "unexclude" : "exclude"}">${icon(
            c.excluded ? "shieldOff" : "shield"
          )}${esc(c.excluded ? t("quickUnprotect") : t("quickProtect"))}</button>
        </div>
        <div class="dlg-body">
          ${errorHtml}
          <h3>${esc(t("secNetwork"))}</h3>
          <div class="tiles">${tiles.join("")}</div>
          <h3>${esc(t("secLinked"))}</h3>
          ${this._linkedSectionHtml(c)}
          <h3>${esc(t("secEntities"))}${entityCount ? `<span class="h3-count">${entityCount}</span>` : ""}</h3>
          ${entitiesHtml}
        </div>
        <div class="dlg-actions">
          <button class="dlg-btn" data-dlg="close">${esc(t("dialogClose"))}</button>
          <button class="dlg-btn destructive" data-dlg="remove">${icon("trash")}${esc(
            t("menuRemove")
          )}</button>
        </div>`;
    }

    if (html === this._dialogHtml) return;
    // Fokus und Scrollposition über den Neuaufbau retten (Polling).
    const active = this.shadowRoot.activeElement;
    const focusSel =
      active && active.dataset && active.dataset.dlg
        ? `[data-dlg="${active.dataset.dlg}"]${
            active.dataset.entityId ? `[data-entity-id="${CSS.escape(active.dataset.entityId)}"]` : ""
          }${active.dataset.copy ? `[data-copy="${CSS.escape(active.dataset.copy)}"]` : ""}`
        : null;
    // Beim Suchfeld der Geräteauswahl auch die Cursorposition retten, sonst
    // spränge der Cursor bei jedem Tastendruck (Neuaufbau) ans Ende.
    // Nur bei Textfeldern: Checkboxen haben keine Textauswahl, dort würde
    // setSelectionRange einen Fehler werfen.
    const caret =
      active && active.tagName === "INPUT" && (active.type === "search" || active.type === "text")
        ? [active.selectionStart, active.selectionEnd]
        : null;
    const scroll = dialog.scrollTop;
    const pickerList = dialog.querySelector(".picker-list");
    const pickerScroll = pickerList ? pickerList.scrollTop : 0;
    this._dialogHtml = html;
    dialog.innerHTML = html;
    dialog.scrollTop = scroll;
    const newList = dialog.querySelector(".picker-list");
    if (newList) newList.scrollTop = pickerScroll;
    if (focusSel) {
      const el = dialog.querySelector(focusSel);
      if (el) {
        el.focus();
        if (caret && typeof el.setSelectionRange === "function") {
          el.setSelectionRange(caret[0], caret[1]);
        }
      }
    }
  }

  async _handleDialogClick(ev) {
    const dialog = ev.currentTarget;
    // Klick auf den Hintergrund (ausserhalb des Inhalts) schliesst.
    if (ev.target === dialog) {
      const r = dialog.getBoundingClientRect();
      const inside =
        ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!inside) this._closeDialog();
      return;
    }
    const btn = ev.target.closest("[data-dlg]");
    if (!btn || btn.disabled) return;
    const action = btn.dataset.dlg;
    if (action === "close") {
      this._closeDialog();
      return;
    }
    if (action === "more-info") {
      this._openMoreInfo(btn.dataset.entityId);
      return;
    }
    if (action === "copy") {
      this._copy(btn.dataset.copy);
      return;
    }
    if (action === "open-linked") {
      this._closeDialog();
      this._openDevice(btn.dataset.linkedId);
      return;
    }
    if (action === "link-open") {
      this._openPicker();
      return;
    }
    if (action === "link-cancel") {
      this._pickerOpen = false;
      this._renderDialog();
      return;
    }
    // Direkt im Klick verarbeiten, nicht erst bei "change": der Neuaufbau
    // unten würde die Checkbox sonst auf den alten Zustand zurücksetzen,
    // bevor "change" feuert.
    if (action === "picker-hide-linked") {
      this._hideLinked = btn.checked;
      this._savePrefs();
      this._renderDialog();
      return;
    }
    if (action === "link-retry") {
      this._devices = null;
      this._openPicker();
      return;
    }
    const c = this._clientByKey(this._dialogKey);
    if (!c) return;
    this._dialogError = null;
    if (action === "open-device") {
      this._closeDialog();
      this._openDevice(c.device_id);
    } else if (action === "link-pick") {
      await this._linkDevice(c, btn.dataset.deviceId);
    } else if (action === "link-remove") {
      await this._linkDevice(c, null);
    } else if (action === "exclude") {
      await this._excludeClient(c.entry_id, c.mac);
    } else if (action === "unexclude") {
      await this._unexcludeClient(c.entry_id, c.mac);
    } else if (action === "remove") {
      if (!window.confirm(this._t("confirmRemove")(c.name))) return;
      // Nach erfolgreichem Löschen schliessen: der Client existiert nicht
      // mehr, weitere Aktionen im Dialog liefen ins Leere.
      if (await this._removeClient(c.entry_id, c.mac)) this._closeDialog();
    }
    this._renderDialog();
  }

  _filteredClients() {
    const q = this._search.trim().toLowerCase();
    const rows = this._clients.filter((c) => {
      if (this._onlineFilter === "online" && !c.online) return false;
      if (this._onlineFilter === "offline" && c.online) return false;
      if (!this._matchesColumns(c)) return false;
      if (!q) return true;
      const linked = c.linked_device || {};
      const haystack = [c.name, c.ip, c.mac, c.essid, c.ap_name, linked.name, linked.area]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    if (!this._sortKey) return rows;

    const dir = this._sortDir === "desc" ? -1 : 1;
    const key = this._sortKey;
    return [...rows].sort((a, b) => {
      const va = this._sortValue(a, key);
      const vb = this._sortValue(b, key);
      // null/undefined sortieren immer ans Ende, unabhängig von der
      // Richtung - ein Client ohne IP soll nicht abwechselnd oben und
      // unten landen, nur weil die Sortierrichtung umgedreht wurde. Daher
      // ausserhalb von dir * (...), nicht mitgedreht.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return dir * this._compareValues(va, vb);
    });
  }

  // "conn" und "status" sind keine eigenen Felder in den Client-Daten,
  // sondern aus is_wired/online abgeleitet - hier auf das jeweilige
  // Rohfeld zurückgeführt, damit sortiert werden kann.
  _sortValue(client, key) {
    if (key === "conn") return client.is_wired;
    if (key === "linked") return client.linked_device ? client.linked_device.name : null;
    if (key === "status") return client.online;
    return client[key];
  }

  // Vergleich zweier bereits als nicht-null bekannter Werte gleichen Typs.
  _compareValues(a, b) {
    if (typeof a === "boolean" || typeof b === "boolean") {
      return a === b ? 0 : a ? -1 : 1;
    }
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  }

  _formatSeen(seenAt) {
    if (!seenAt) return this._t("seenNever");
    try {
      return new Date(seenAt * 1000).toLocaleString(
        pickLang(this._hass) === "de" ? "de-CH" : "en-US"
      );
    } catch {
      return this._t("seenNever");
    }
  }

  _escape(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  _headerCellHtml(key, label) {
    const active = this._sortKey === key;
    const arrow = active ? (this._sortDir === "desc" ? "▼" : "▲") : "";
    return `<th class="sortable" data-sort-key="${key}">${this._escape(
      label
    )}<span class="sort-arrow">${arrow}</span></th>`;
  }

  _headerRowHtml() {
    const t = (k) => this._t(k);
    return `
      ${this._headerCellHtml("name", t("colName"))}
      ${this._headerCellHtml("linked", t("colLinked"))}
      ${this._headerCellHtml("ip", t("colIp"))}
      ${this._headerCellHtml("mac", t("colMac"))}
      ${this._headerCellHtml("essid", t("colSsid"))}
      ${this._headerCellHtml("ap_name", t("colAp"))}
      ${this._headerCellHtml("conn", t("colConn"))}
      ${this._headerCellHtml("seen_at", t("colSeen"))}
      ${this._headerCellHtml("status", t("colStatus"))}
      <th>${this._escape(t("colActions"))}</th>
    `;
  }

  // Nur die Titelzeile neu aufbauen (Pfeil-Indikator). Die Filterzeile
  // darunter bleibt stehen, sonst verlöre ein Filterfeld beim Sortieren
  // den Fokus.
  _renderHeader() {
    const row = this.shadowRoot.querySelector("thead tr.head-row");
    if (!row) return;
    row.innerHTML = this._headerRowHtml();
  }

  _textFilterHtml(key, placeholder) {
    const value = this._colFilters[key] || "";
    return `<input type="text" class="col-filter${value ? " on" : ""}" data-col="${key}"
      placeholder="${this._escape(placeholder || this._t("filterPlaceholder"))}"
      value="${this._escape(value)}" autocomplete="off" spellcheck="false" />`;
  }

  _optionsHtml(options, current) {
    return options
      .map(
        ([value, label]) =>
          `<option value="${value}"${value === current ? " selected" : ""}>${this._escape(
            label
          )}</option>`
      )
      .join("");
  }

  _connOptionsHtml() {
    const t = (k) => this._t(k);
    return this._optionsHtml(
      [["all", t("optAll")], ["wireless", t("connWireless")], ["wired", t("connWired")]],
      this._connFilter
    );
  }

  _seenOptionsHtml() {
    const t = (k) => this._t(k);
    return this._optionsHtml(
      [["all", t("optAll")], ["1h", t("seen1h")], ["24h", t("seen24h")], ["7d", t("seen7d")]],
      this._seenFilter
    );
  }

  _statusOptionsHtml() {
    const t = (k) => this._t(k);
    return this._optionsHtml(
      [["all", t("optAll")], ["online", t("statusOnline")], ["offline", t("statusOffline")]],
      this._onlineFilter
    );
  }

  // Filterfelder (Desktop-Zeile) mit dem Zustand abgleichen, z.B. nach
  // Chip-Klick, Zurücksetzen, Statusleiste oder Filter-Blatt. Geschrieben
  // wird nur bei Abweichung: beim Tippen sind Feld und Zustand gleich, der
  // Cursor bleibt also stehen.
  _syncFilterInputs() {
    const root = this.shadowRoot;
    for (const el of root.querySelectorAll("tr.filter-row .col-filter")) {
      const col = el.dataset.col;
      const value =
        col === "conn"
          ? this._connFilter
          : col === "seen"
          ? this._seenFilter
          : col === "status"
          ? this._onlineFilter
          : this._colFilters[col] || "";
      if (el.value !== value) el.value = value;
      el.classList.toggle("on", value !== "" && value !== "all");
    }
    const search = root.querySelector(".search");
    if (search && search.value !== this._search) {
      search.value = this._search;
    }
    const clear = root.querySelector(".search-clear");
    if (clear) clear.classList.toggle("visible", this._search.length > 0);
  }

  // Einen Spaltenfilter setzen (Textfeld, Auswahl oder Filter-Blatt).
  _setColumnFilter(col, value) {
    if (col === "conn") this._connFilter = CONN_FILTERS.includes(value) ? value : "all";
    else if (col === "seen") this._seenFilter = SEEN_FILTERS.includes(value) ? value : "all";
    else if (col === "status") this._onlineFilter = ONLINE_FILTERS.includes(value) ? value : "all";
    else if (TEXT_FILTER_KEYS.includes(col)) {
      if (value) this._colFilters[col] = value;
      else delete this._colFilters[col];
    }
    this._openMenuKey = null;
    this._renderRows();
    this._savePrefs();
  }

  _chipsHtml() {
    const t = (k) => this._t(k);
    const labels = {
      name: t("colName"),
      linked: t("colLinked"),
      ip: t("colIp"),
      mac: t("colMac"),
      essid: t("colSsid"),
      ap_name: t("colAp"),
    };
    const chips = [];
    for (const key of TEXT_FILTER_KEYS) {
      const v = String(this._colFilters[key] || "").trim();
      if (v) chips.push([key, labels[key], v]);
    }
    if (this._connFilter !== "all") {
      chips.push([
        "conn",
        t("colConn"),
        this._connFilter === "wired" ? t("connWired") : t("connWireless"),
      ]);
    }
    if (this._seenFilter !== "all") {
      chips.push(["seen", t("colSeen"), t(`seen${this._seenFilter}`)]);
    }
    if (!chips.length) return "";
    return `<span class="chips-label">${this._escape(t("activeFilters"))}</span>${chips
      .map(
        ([key, label, value]) =>
          `<button class="chip" data-chip="${key}"><b>${this._escape(label)}:</b>${this._escape(
            value
          )}<span class="x" aria-hidden="true">✕</span></button>`
      )
      .join("")}<button class="chips-clear">${this._escape(t("clearAll"))}</button>`;
  }

  // Sichtbarkeit per dynamischer Style-Regel statt Klassen an jeder Zelle:
  // eine Regel pro ausgeblendeter Spalte blendet Titel, Filterfeld und
  // alle Zeilen auf einmal aus und übersteht jeden Neuaufbau des tbody.
  _applyColumnVisibility() {
    const root = this.shadowRoot;
    const style = root.querySelector("style.colvis");
    if (!style) return;
    const css = HIDEABLE_COLUMNS.filter(([key]) => this._hiddenCols.has(key))
      .map(([, , n]) => `table tr > :nth-child(${n}) { display: none; }`)
      .join("\n");
    if (style.textContent !== css) style.textContent = css;
    const badge = root.querySelector(".cols-btn .count-badge");
    if (badge) {
      badge.textContent = String(this._hiddenCols.size);
      badge.hidden = this._hiddenCols.size === 0;
    }
  }

  _setColumnVisible(key, visible) {
    if (!HIDEABLE_KEYS.includes(key)) return;
    if (visible) this._hiddenCols.delete(key);
    else this._hiddenCols.add(key);
    this._applyColumnVisibility();
    this._savePrefs();
  }

  _columnTogglesHtml(attr) {
    return HIDEABLE_COLUMNS.map(
      ([key, label]) => `<label class="col-toggle">${this._escape(this._t(label))}
        <input type="checkbox" class="switch" ${attr}="${key}" ${
          this._hiddenCols.has(key) ? "" : "checked"
        } /></label>`
    ).join("");
  }

  _renderColumnsPopover() {
    const pop = this.shadowRoot.querySelector(".cols-pop");
    if (!pop) return;
    const t = (k) => this._t(k);
    pop.innerHTML = `<div class="cols-head">${this._escape(t("columnsTitle"))}
        <button data-cols-all>${this._escape(t("columnsAll"))}</button></div>
      ${this._columnTogglesHtml("data-colvis")}`;
  }

  _toggleColumnsPopover(open) {
    const root = this.shadowRoot;
    const pop = root.querySelector(".cols-pop");
    const btn = root.querySelector(".cols-btn");
    this._colsOpen = open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) {
      pop.hidden = true;
      return;
    }
    this._renderColumnsPopover();
    pop.hidden = false;
    // Unter dem Button, rechtsbündig; fixed, damit nichts abschneidet.
    const r = btn.getBoundingClientRect();
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  }

  // Filter-Blatt (Handy): Felder aus dem aktuellen Zustand aufbauen.
  _renderFilterSheet() {
    const sheet = this.shadowRoot.querySelector("dialog.filters");
    if (!sheet) return;
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const text = (key, label, ph) => `<label class="sheet-row">${esc(label)}
        <input type="text" class="col-filter${this._colFilters[key] ? " on" : ""}" data-fcol="${key}"
          placeholder="${esc(ph || t("filterPlaceholder"))}" value="${esc(
            this._colFilters[key] || ""
          )}" autocomplete="off" spellcheck="false" /></label>`;
    const seg = (col, label, options, current) => `<div class="sheet-row">${esc(label)}
        <div class="seg" role="group">${options
          .map(
            ([value, l]) =>
              `<button data-fseg="${col}" data-value="${value}" class="${
                value === current ? "active" : ""
              }">${esc(l)}</button>`
          )
          .join("")}</div></div>`;
    sheet.innerHTML = `<div class="sheet-grab"></div>
      <div class="sheet-head"><h3>${esc(t("filtersTitle"))}</h3>
        <button class="chips-clear" data-fclear>${esc(t("clearAll"))}</button></div>
      ${text("name", t("colName"))}
      ${text("linked", t("colLinked"))}
      ${text("ip", t("colIp"), t("ipPlaceholder"))}
      ${text("mac", t("colMac"))}
      ${text("essid", t("colSsid"))}
      ${text("ap_name", t("colAp"))}
      ${seg("conn", t("colConn"), [["all", t("optAll")], ["wireless", t("connWireless")], ["wired", t("connWired")]], this._connFilter)}
      ${seg("seen", t("colSeen"), [["all", t("optAll")], ["1h", t("seen1h")], ["24h", t("seen24h")], ["7d", t("seen7d")]], this._seenFilter)}
      <div class="sheet-sec">${esc(t("columnsTitle"))}</div>
      <div class="sheet-cols">${this._columnTogglesHtml("data-fcolvis")}</div>
      <button class="sheet-apply" data-fapply></button>`;
    this._updateSheetApply();
  }

  _updateSheetApply() {
    const btn = this.shadowRoot.querySelector("dialog.filters [data-fapply]");
    if (btn) btn.textContent = this._t("showN")(this._filteredClients().length, this._clients.length);
  }

  _handleHeaderClick(ev) {
    const th = ev.target.closest("th[data-sort-key]");
    if (!th) return;
    const key = th.dataset.sortKey;
    if (this._sortKey === key) {
      this._sortDir = this._sortDir === "asc" ? "desc" : "asc";
    } else {
      this._sortKey = key;
      this._sortDir = "asc";
    }
    this._renderHeader();
    this._renderRows();
    this._savePrefs();
  }

  // Toolbar, Tabellenkopf und Grundgerüst stehen fest; nur der <tbody>
  // wird bei jeder Aktualisierung neu gerendert. So verliert das Suchfeld
  // beim Live-Polling nie Fokus oder Cursorposition.
  _buildStaticLayout() {
    const t = (k) => this._t(k);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          /* Flex-Spalte über die volle Höhe des iframes: Werkzeugleiste und
             Fehlerbanner stehen oben fest, .content nimmt den Rest ein und
             ist der einzige Bereich, der scrollt - in beide Richtungen, weil
             die Tabelle mehr Spalten hat, als auf ein Handy passen. Im
             iframe ist height: 100% verlässlich, weil HA die Höhe des
             iframes selbst festlegt (hass-subpage). Als Custom Panel (bis
             2.0.11) fehlte genau diese feste Höhe; alle Varianten mit
             position: sticky auf Seitenebene scheiterten am horizontalen
             Scrollen oder am Safe-Area-Bereich des iPhones. */
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--primary-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-family: var(
            --ha-font-family-body,
            var(
              --paper-font-body1_-_font-family,
              -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
            )
          );
        }
        /* Abgeleitete Farben aus den HA-Theme-Variablen (hell und dunkel):
           weiche Hintergründe für Pillen und aktive Elemente, ein
           deckender Hover-Ton (nötig für die fixierte erste Spalte auf dem
           Handy, die sonst beim Scrollen durchscheinen würde). */
        :host {
          --udc-card: var(--card-background-color, #fff);
          --udc-text: var(--primary-text-color, #212121);
          --udc-text2: var(--secondary-text-color, #727272);
          --udc-text3: var(--disabled-text-color, #9e9e9e);
          --udc-divider: var(--divider-color, rgba(0,0,0,0.12));
          --udc-primary: var(--primary-color, #03a9f4);
          --udc-success: var(--success-color, #43a047);
          --udc-warning: var(--warning-color, #ff9800);
          --udc-error: var(--error-color, #db4437);
          --udc-hover: color-mix(in srgb, var(--udc-text) 5%, var(--udc-card));
          --udc-subtle: color-mix(in srgb, var(--udc-text) 4%, var(--udc-card));
          --udc-primary-soft: color-mix(in srgb, var(--udc-primary) 14%, transparent);
          --udc-success-soft: color-mix(in srgb, var(--udc-success) 16%, transparent);
          --udc-warning-soft: color-mix(in srgb, var(--udc-warning) 16%, transparent);
          --udc-input: var(--primary-background-color, #fff);
          --udc-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }
        svg {
          fill: currentColor;
        }
        .toolbar {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 16px 20px 12px;
        }
        .brand-icon {
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          border-radius: 9px;
        }
        .search-wrap {
          position: relative;
          /* Kleine Basisbreite, damit das Suchfeld auf dem Handy neben dem
             Icon Platz findet; wachsen darf es, aber nie über 520px, sonst
             verdrängt es die Statusleiste (siehe 2.0.3/2.0.4). */
          flex: 1 1 240px;
          max-width: 520px;
          min-width: 180px;
        }
        .search-wrap > svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          color: var(--udc-text3);
          pointer-events: none;
        }
        input[type="search"].search {
          width: 100%;
          box-sizing: border-box;
          height: 42px;
          padding: 0 34px 0 40px;
          border-radius: 12px;
          border: 1px solid var(--udc-divider);
          background: var(--udc-input);
          color: var(--udc-text);
          font: inherit;
          /* 16px verhindert das automatische Hineinzoomen von iOS. */
          font-size: 16px;
        }
        input:focus-visible,
        select:focus-visible {
          outline: none;
          border-color: var(--udc-primary);
          box-shadow: 0 0 0 3px var(--udc-primary-soft);
        }
        /* Eigener "×"-Button statt der nativen, browserabhängigen Lösung
           von type="search" - die native ist hier ausgeblendet. */
        input[type="search"]::-webkit-search-cancel-button {
          -webkit-appearance: none;
          appearance: none;
        }
        .search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 26px;
          height: 26px;
          border: none;
          border-radius: 50%;
          background: none;
          color: var(--udc-text2);
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          display: none;
        }
        .search-clear.visible {
          display: block;
        }
        .search-clear:hover {
          background: var(--udc-hover);
          color: var(--udc-text);
        }
        /* Zähler und Online/Offline-Filter in einem, als Segment-Umschalter.
           Die Zahlen folgen den Spaltenfiltern, nicht der globalen Suche
           (siehe _renderStats). */
        .stats {
          flex: 0 0 auto;
          display: inline-flex;
          gap: 2px;
          padding: 3px;
          border: 1px solid var(--udc-divider);
          border-radius: 12px;
          background: var(--udc-card);
        }
        .stat {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 6px 13px;
          border: none;
          border-radius: 9px;
          background: none;
          color: var(--udc-text2);
          font: inherit;
          font-size: 14px;
          line-height: 20px;
          cursor: pointer;
          white-space: nowrap;
        }
        .stat:hover {
          background: var(--udc-hover);
        }
        .stat.active {
          background: var(--udc-primary-soft);
          color: var(--udc-primary);
        }
        .stat-num {
          font-weight: 600;
          font-size: 15px;
          font-variant-numeric: tabular-nums;
          color: var(--udc-text);
        }
        .stat.active .stat-num {
          color: var(--udc-primary);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .dot.online {
          background: var(--udc-success);
          box-shadow: 0 0 0 3px var(--udc-success-soft);
        }
        .dot.offline {
          background: var(--udc-text3);
        }
        .toolbar-spacer {
          flex: 1 1 0;
        }
        .tool-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid var(--udc-divider);
          background: var(--udc-card);
          color: var(--udc-text);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
          white-space: nowrap;
        }
        .tool-btn:hover {
          background: var(--udc-hover);
        }
        .tool-btn svg {
          width: 18px;
          height: 18px;
        }
        .count-badge {
          min-width: 18px;
          padding: 1px 6px;
          box-sizing: border-box;
          border-radius: 99px;
          background: var(--udc-primary);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          line-height: 16px;
          text-align: center;
        }
        .count-badge[hidden] {
          display: none;
        }
        /* Filter-Button nur auf dem Handy (dort ersetzt er die Filterzeile). */
        .filter-btn {
          display: none;
          width: 42px;
          height: 42px;
          padding: 0;
          justify-content: center;
          border-radius: 12px;
        }
        .filter-btn .count-badge {
          position: absolute;
          top: -6px;
          right: -6px;
        }
        /* Aktive Spaltenfilter als entfernbare Chips. */
        .chips {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          padding: 0 20px 12px;
          color: var(--udc-text2);
          font-size: 13px;
        }
        .chips[hidden] {
          display: none;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 6px 4px 11px;
          border: none;
          border-radius: 99px;
          background: var(--udc-primary-soft);
          color: var(--udc-primary);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        .chip b {
          font-weight: 500;
          color: var(--udc-text2);
        }
        .chip .x {
          display: grid;
          place-items: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--udc-primary) 20%, transparent);
          font-size: 11px;
        }
        .chips-clear {
          border: none;
          background: none;
          color: var(--udc-primary);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
          padding: 4px;
        }
        @media (max-width: 600px) {
          .toolbar {
            padding: 12px 12px 10px;
            gap: 10px;
          }
          .search-wrap {
            flex: 1 1 0;
            min-width: 0;
          }
          .stats {
            order: 5;
            flex: 1 1 100%;
          }
          .stat {
            flex: 1 1 0;
            padding: 6px;
          }
          .toolbar-spacer,
          .reset-btn {
            display: none;
          }
          .filter-btn {
            display: inline-flex;
          }
          .chips {
            padding: 0 12px 10px;
            flex-wrap: nowrap;
            overflow-x: auto;
          }
          .chips-label {
            display: none;
          }
        }
        .content {
          /* min-height: 0 ist nötig, damit sich das Flex-Kind auf den
             Restplatz begrenzen lässt statt auf die volle Tabellenhöhe
             anzuwachsen - erst dann greift overflow: auto. overscroll-
             behavior verhindert, dass iOS am Rand das ganze iframe
             mitzieht. .content ist der einzige Scroll-Container (beide
             Richtungen); die Kopfzeilen kleben per sticky an ihm. */
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
          overscroll-behavior: contain;
          padding: 0 20px 12px;
        }
        @media (max-width: 600px) {
          .content {
            padding: 0 12px 12px;
          }
        }
        /* Die Tabelle selbst ist die "Karte": abgerundet über border-
           collapse: separate. Kein overflow auf einem Wrapper - der würde
           zum Scroll-Container und das sticky der Kopfzeilen brechen. */
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 14px;
          background: var(--udc-card);
          border: 1px solid var(--udc-divider);
          border-radius: 16px;
        }
        thead th {
          position: sticky;
          z-index: 2;
          background: var(--udc-card);
          text-align: left;
          white-space: nowrap;
        }
        thead tr.head-row th {
          top: 0;
          height: 38px;
          box-sizing: border-box;
          padding: 12px 12px 4px;
          color: var(--udc-text2);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        thead tr.head-row th:first-child {
          border-top-left-radius: 16px;
        }
        thead tr.head-row th:last-child {
          border-top-right-radius: 16px;
        }
        /* Filterzeile klebt direkt unter der Titelzeile (feste 38px). */
        thead tr.filter-row th {
          top: 38px;
          padding: 4px 6px 10px;
          border-bottom: 1px solid var(--udc-divider);
          font-weight: normal;
        }
        thead th.sortable {
          cursor: pointer;
          user-select: none;
        }
        thead th.sortable:hover {
          color: var(--udc-text);
        }
        thead th .sort-arrow {
          display: inline-block;
          width: 1em;
          margin-left: 2px;
          color: var(--udc-primary);
        }
        .col-filter {
          width: 100%;
          min-width: 56px;
          box-sizing: border-box;
          height: 30px;
          padding: 0 8px;
          border-radius: 8px;
          border: 1px solid var(--udc-divider);
          background: var(--udc-input);
          color: var(--udc-text);
          font: inherit;
          font-size: 13px;
        }
        .col-filter::placeholder {
          color: var(--udc-text3);
        }
        .col-filter.on {
          border-color: var(--udc-primary);
          box-shadow: 0 0 0 3px var(--udc-primary-soft);
        }
        select.col-filter {
          padding-right: 4px;
        }
        tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--udc-divider);
          white-space: nowrap;
          background: var(--udc-card);
        }
        tbody tr:last-child td {
          border-bottom: none;
        }
        tbody tr:last-child td:first-child {
          border-bottom-left-radius: 16px;
        }
        tbody tr:last-child td:last-child {
          border-bottom-right-radius: 16px;
        }
        tbody tr[data-key] {
          cursor: pointer;
        }
        tbody tr[data-key]:hover td {
          background: var(--udc-hover);
        }
        tbody tr[data-key]:focus-visible {
          outline: 2px solid var(--udc-primary);
          outline-offset: -2px;
        }
        .name-cell .name {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .avatar {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: var(--udc-subtle);
          color: var(--udc-text2);
        }
        .avatar svg {
          width: 17px;
          height: 17px;
        }
        .name-text {
          min-width: 0;
        }
        .name-text .t {
          font-weight: 500;
        }
        .name-text small {
          display: block;
          color: var(--udc-text3);
          font-size: 12px;
        }
        .name-text .mob-sub {
          display: none;
        }
        .shield {
          display: inline-flex;
          vertical-align: -3px;
          margin-left: 5px;
          color: var(--udc-warning);
        }
        .shield svg {
          width: 15px;
          height: 15px;
        }
        .mob-dot {
          display: none;
        }
        .muted {
          color: var(--udc-text3);
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 13px;
        }
        .linked-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0;
          border: none;
          background: none;
          color: var(--udc-primary);
          font: inherit;
          cursor: pointer;
          text-align: left;
        }
        .linked-link svg {
          width: 15px;
          height: 15px;
          flex: 0 0 auto;
          opacity: 0.8;
        }
        .linked-link:hover {
          text-decoration: underline;
        }
        .conn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--udc-text2);
        }
        .conn > svg {
          width: 16px;
          height: 16px;
        }
        .bars {
          display: inline-flex;
          align-items: flex-end;
          gap: 2px;
          height: 13px;
          margin-left: 3px;
        }
        .bars i {
          width: 3px;
          border-radius: 1px;
          background: var(--udc-text3);
          opacity: 0.35;
        }
        .bars i:nth-child(1) { height: 4px; }
        .bars i:nth-child(2) { height: 7px; }
        .bars i:nth-child(3) { height: 10px; }
        .bars i:nth-child(4) { height: 13px; }
        .bars.s4 i,
        .bars.s3 i:nth-child(-n+3) {
          background: var(--udc-success);
          opacity: 1;
        }
        .bars.s2 i:nth-child(-n+2) {
          background: var(--udc-warning);
          opacity: 1;
        }
        .bars.s1 i:nth-child(1) {
          background: var(--udc-error);
          opacity: 1;
        }
        /* Offline: letzter bekannter Wert, grau statt farbig. */
        .bars.stale i {
          background: var(--udc-text3) !important;
        }
        .seen small {
          display: block;
          color: var(--udc-text3);
          font-size: 12px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px 3px 8px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 500;
        }
        .pill.online {
          background: var(--udc-success-soft);
          color: var(--udc-success);
        }
        .pill.offline {
          background: var(--udc-subtle);
          color: var(--udc-text2);
        }
        /* Kleine Pillen im Geräte-Dialog und in der Geräteauswahl. */
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge.online {
          background: var(--udc-success-soft);
          color: var(--udc-success);
        }
        .badge.offline {
          background: var(--udc-subtle);
          color: var(--udc-text2);
        }
        .badge.excluded {
          background: var(--udc-warning-soft);
          color: var(--udc-warning);
          margin-left: 6px;
        }
        /* Platzhalterzeilen beim ersten Laden. */
        .skeleton {
          height: 12px;
          border-radius: 6px;
          background: linear-gradient(90deg, var(--udc-subtle), var(--udc-hover), var(--udc-subtle));
          background-size: 200% 100%;
          animation: udc-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes udc-shimmer {
          from { background-position: 100% 0; }
          to { background-position: -100% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .skeleton {
            animation: none;
          }
        }
        .table-foot {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 4px 0;
          color: var(--udc-text3);
          font-size: 12px;
        }
        /* Handy: Tabelle bleibt Tabelle. Filterzeile weicht dem Filter-
           Blatt, die Alias-Spalte bleibt beim seitlichen Scrollen stehen
           und zeigt Status-Punkt sowie Verbindung/AP darunter. */
        @media (max-width: 600px) {
          thead tr.filter-row {
            display: none;
          }
          thead tr.head-row th {
            border-bottom: 1px solid var(--udc-divider);
          }
          /* left: -12px = minus Innenabstand von .content: die Spalte
             klebt am Bildschirmrand, nicht 12px daneben - sonst scrollen
             die übrigen Spalten in diesem Streifen sichtbar vorbei. Im
             Ruhezustand wirkt sticky nicht, die Spalte sitzt normal. */
          thead tr.head-row th:first-child,
          tbody td:first-child {
            position: sticky;
            left: -12px;
            box-shadow: 1px 0 0 var(--udc-divider);
          }
          thead tr.head-row th:first-child {
            z-index: 3;
          }
          tbody td:first-child {
            z-index: 1;
            min-width: 150px;
            max-width: 190px;
            white-space: normal;
          }
          tbody td {
            padding: 10px;
          }
          .name-text .t {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .name-text .mob-sub {
            display: block;
          }
          /* Auf dem Handy trägt der Status-Punkt die Information, das
             Verbindungssymbol würde nur Breite kosten. */
          .name-cell .avatar {
            display: none;
          }
          .mob-dot {
            display: inline-block;
            margin-right: 6px;
            vertical-align: 1px;
          }
          .table-foot .hint {
            display: none;
          }
        }
        .actions-cell {
          position: relative;
          text-align: right;
          width: 1%;
        }
        .menu-btn {
          display: inline-grid;
          place-items: center;
          width: 32px;
          height: 32px;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: none;
          color: var(--udc-text2);
          cursor: pointer;
        }
        .menu-btn svg {
          width: 20px;
          height: 20px;
        }
        .menu-btn:hover {
          background: var(--udc-hover);
        }
        .menu {
          /* position: fixed statt absolute, und Position wird bei jedem
             Öffnen per JS anhand der echten Bildschirmkoordinaten des
             Buttons gesetzt (siehe _positionOpenMenu). Grund: .content
             scrollt und schneidet ein absolut positioniertes Menü nahe dem
             unteren Rand ab; fixed orientiert sich am Viewport. */
          position: fixed;
          z-index: 10;
          min-width: 240px;
          padding: 6px;
          background: var(--udc-card);
          border: 1px solid var(--udc-divider);
          border-radius: 14px;
          box-shadow: var(--udc-shadow);
        }
        .menu button {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: left;
          padding: 9px 12px;
          border: none;
          border-radius: 9px;
          background: none;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          color: var(--udc-text);
        }
        .menu button svg {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
          color: var(--udc-text2);
        }
        .menu button:hover:not(:disabled) {
          background: var(--udc-hover);
        }
        .menu button:disabled {
          color: var(--udc-text3);
          cursor: default;
        }
        .menu button.destructive,
        .menu button.destructive svg {
          color: var(--udc-error);
        }
        .menu hr {
          border: 0;
          border-top: 1px solid var(--udc-divider);
          margin: 4px 6px;
        }
        /* Spalten ein-/ausblenden: Popover unter dem Button (Desktop). */
        .cols-pop {
          position: fixed;
          z-index: 10;
          min-width: 230px;
          padding: 8px;
          background: var(--udc-card);
          border: 1px solid var(--udc-divider);
          border-radius: 14px;
          box-shadow: var(--udc-shadow);
        }
        .cols-pop[hidden] {
          display: none;
        }
        .cols-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 6px 8px;
          color: var(--udc-text2);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .cols-head button {
          border: none;
          background: none;
          color: var(--udc-primary);
          font: inherit;
          font-size: 13px;
          letter-spacing: 0;
          text-transform: none;
          cursor: pointer;
          padding: 2px 4px;
        }
        .col-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 8px 6px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          user-select: none;
        }
        .col-toggle:hover {
          background: var(--udc-hover);
        }
        /* Schalter wie in der Geräteauswahl; bleibt eine echte Checkbox. */
        .switch {
          -webkit-appearance: none;
          appearance: none;
          position: relative;
          flex: 0 0 auto;
          width: 34px;
          height: 20px;
          margin: 0;
          border-radius: 99px;
          background: var(--udc-text3);
          cursor: pointer;
          transition: background 0.15s;
        }
        .switch::before {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.15s;
        }
        .switch:checked {
          background: var(--udc-primary);
        }
        .switch:checked::before {
          transform: translateX(14px);
        }
        .switch:focus-visible {
          outline: 2px solid var(--udc-primary);
          outline-offset: 2px;
        }
        @media (max-width: 600px) {
          .cols-btn {
            display: none;
          }
        }
        .sheet-sec {
          margin: 18px 0 6px;
          color: var(--udc-text2);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .sheet-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 12px;
        }
        .sheet-cols .col-toggle {
          padding: 8px 4px;
        }
        /* Filter-Blatt (Handy): natives <dialog>, von unten. */
        dialog.filters {
          width: 100%;
          max-width: 100%;
          max-height: 90%;
          margin: auto 0 0;
          padding: 8px 18px calc(18px + env(safe-area-inset-bottom, 0px));
          box-sizing: border-box;
          border: none;
          border-radius: 20px 20px 0 0;
          background: var(--udc-card);
          color: var(--udc-text);
          overflow: auto;
          overscroll-behavior: contain;
        }
        dialog.filters::backdrop {
          background: rgba(0,0,0,0.45);
        }
        .sheet-grab {
          width: 38px;
          height: 5px;
          margin: 0 auto 6px;
          border-radius: 3px;
          background: var(--udc-text3);
          opacity: 0.5;
        }
        .sheet-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 8px 0 14px;
        }
        .sheet-head h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        }
        .sheet-row {
          display: grid;
          grid-template-columns: 110px 1fr;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          color: var(--udc-text2);
          font-size: 14px;
        }
        .sheet-row .col-filter {
          height: 40px;
          font-size: 16px;
        }
        .seg {
          display: flex;
          gap: 2px;
          padding: 3px;
          border-radius: 10px;
          background: var(--udc-subtle);
        }
        .seg button {
          flex: 1 1 auto;
          white-space: nowrap;
          padding: 7px 6px;
          border: none;
          border-radius: 8px;
          background: none;
          color: var(--udc-text2);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }
        .seg button.active {
          background: var(--udc-card);
          color: var(--udc-text);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .sheet-apply {
          width: 100%;
          height: 46px;
          margin-top: 8px;
          border: none;
          border-radius: 12px;
          background: var(--udc-primary);
          color: #fff;
          font: inherit;
          font-size: 15px;
          cursor: pointer;
        }
        /* Geräteansicht: natives <dialog> (showModal) - Hintergrund, Esc und
           Fokusfalle liefert der Browser. Auf dem Handy als Blatt von unten
           über die ganze Breite. Der Dialog selbst scrollt, Kopf und
           Aktionsleiste bleiben dabei per sticky sichtbar. */
        dialog.device {
          width: min(640px, calc(100vw - 32px));
          max-height: calc(100% - 48px);
          padding: 0;
          border: none;
          border-radius: 22px;
          background: var(--udc-card);
          color: var(--udc-text);
          box-shadow: var(--udc-shadow);
          overflow: auto;
          overscroll-behavior: contain;
        }
        dialog.device::backdrop {
          background: rgba(0,0,0,0.5);
        }
        @media (max-width: 600px) {
          dialog.device {
            width: 100%;
            max-width: 100%;
            max-height: 92%;
            margin: auto 0 0;
            border-radius: 22px 22px 0 0;
          }
        }
        .dlg-head {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 20px 16px 14px 22px;
          background: var(--udc-card);
        }
        .dlg-avatar {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 52px;
          height: 52px;
          border-radius: 15px;
          background: var(--udc-primary-soft);
          color: var(--udc-primary);
        }
        .dlg-avatar svg {
          width: 28px;
          height: 28px;
        }
        .dlg-title {
          flex: 1 1 auto;
          min-width: 0;
        }
        .dlg-title h2 {
          margin: 2px 0 6px;
          font-size: 21px;
          font-weight: 500;
          overflow-wrap: anywhere;
        }
        .dlg-sub {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          color: var(--udc-text2);
          font-size: 13px;
        }
        .dlg-host::before {
          content: "· ";
        }
        .pill.protected {
          background: var(--udc-warning-soft);
          color: var(--udc-warning);
        }
        .pill svg {
          width: 13px;
          height: 13px;
        }
        .dlg-close {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 50%;
          background: var(--udc-subtle);
          color: var(--udc-text2);
          cursor: pointer;
        }
        .dlg-close svg {
          width: 18px;
          height: 18px;
        }
        .dlg-close:hover {
          background: var(--udc-hover);
          color: var(--udc-text);
        }
        .dlg-quick {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0 22px 6px;
        }
        .qbtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 14px;
          border-radius: 99px;
          border: 1px solid var(--udc-divider);
          background: none;
          color: var(--udc-text);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }
        .qbtn svg {
          width: 17px;
          height: 17px;
          color: var(--udc-text2);
        }
        .qbtn:hover:not(:disabled) {
          background: var(--udc-hover);
        }
        .qbtn:disabled {
          color: var(--udc-text3);
          cursor: default;
        }
        .dlg-body {
          padding: 4px 22px 18px;
        }
        .dlg-body h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 18px 0 8px;
          font-size: 12px;
          font-weight: 500;
          color: var(--udc-text2);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .h3-count {
          padding: 0 7px;
          border-radius: 99px;
          background: var(--udc-subtle);
          letter-spacing: 0;
        }
        .tiles {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 600px) {
          .tiles {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .tile {
          min-width: 0;
          padding: 9px 12px 10px;
          border-radius: 12px;
          background: var(--udc-subtle);
        }
        .tile-k {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
          min-height: 22px;
          color: var(--udc-text2);
          font-size: 12px;
        }
        .tile-v {
          margin-top: 2px;
          font-size: 14px;
          overflow-wrap: anywhere;
        }
        .tile-v small {
          display: block;
          color: var(--udc-text3);
          font-size: 12px;
        }
        .tile .copy-btn {
          margin: -4px -6px -4px 0;
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 13px;
        }
        .dlg-note {
          margin: 8px 0;
          color: var(--udc-text2);
          font-size: 14px;
        }
        .dlg-error {
          margin: 8px 0;
          padding: 10px 12px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--udc-error) 12%, transparent);
          color: var(--udc-error);
          font-size: 14px;
        }
        /* Verknüpftes Gerät */
        .linked-empty {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px 12px;
          padding: 10px 12px 10px 14px;
          border-radius: 14px;
          background: var(--udc-subtle);
        }
        .linked-empty .dlg-note {
          margin: 0;
        }
        .linked-card {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          padding: 6px 10px 6px 6px;
          border-radius: 14px;
          background: var(--udc-subtle);
        }
        .linked-main,
        .pick {
          display: flex;
          align-items: center;
          gap: 12px;
          box-sizing: border-box;
          padding: 8px;
          border: none;
          border-radius: 10px;
          background: none;
          color: inherit;
          font: inherit;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
        }
        .linked-main {
          flex: 1 1 200px;
          min-width: 0;
        }
        .pick {
          width: 100%;
          padding: 9px 14px;
          border-radius: 0;
        }
        .ln-icon {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 11px;
          background: var(--udc-card);
          color: var(--udc-primary);
        }
        .pick .ln-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          color: var(--udc-text2);
        }
        .ln-icon svg {
          width: 19px;
          height: 19px;
        }
        .ln-text {
          min-width: 0;
        }
        .linked-main .ln-name {
          color: var(--udc-primary);
          font-weight: 500;
        }
        .linked-main small,
        .pick small {
          display: block;
          color: var(--udc-text2);
          font-size: 12px;
        }
        .linked-main:hover,
        .pick:hover {
          background: var(--udc-hover);
        }
        .linked-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .linked-actions button,
        .link-add,
        .picker-bar button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid var(--udc-divider);
          background: var(--udc-card);
          color: var(--udc-text);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        .link-add svg {
          width: 16px;
          height: 16px;
          color: var(--udc-primary);
        }
        .linked-actions button:hover,
        .link-add:hover,
        .picker-bar button:hover {
          background: var(--udc-hover);
        }
        .picker {
          border-radius: 14px;
          background: var(--udc-subtle);
          overflow: hidden;
        }
        .picker-bar {
          position: relative;
          display: flex;
          gap: 8px;
          padding: 10px;
        }
        .picker-bar > svg {
          position: absolute;
          left: 21px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          color: var(--udc-text3);
          pointer-events: none;
        }
        .picker-bar input {
          flex: 1 1 auto;
          min-width: 0;
          box-sizing: border-box;
          height: 38px;
          padding: 0 10px 0 36px;
          border-radius: 10px;
          border: 1px solid var(--udc-divider);
          background: var(--udc-input);
          color: var(--udc-text);
          /* 16px verhindert das automatische Hineinzoomen von iOS. */
          font-size: 16px;
        }
        .picker-bar button {
          height: 38px;
        }
        .picker-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px 10px;
          color: var(--udc-text2);
          font-size: 13px;
          cursor: pointer;
          user-select: none;
        }
        /* Checkbox als Schalter dargestellt; bleibt eine echte Checkbox
           (Tastatur, Leertaste, Bildschirmleser). */
        .picker-toggle input {
          -webkit-appearance: none;
          appearance: none;
          position: relative;
          flex: 0 0 auto;
          width: 34px;
          height: 20px;
          margin: 0;
          border-radius: 99px;
          background: var(--udc-text3);
          cursor: pointer;
          transition: background 0.15s;
        }
        .picker-toggle input::before {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.15s;
        }
        .picker-toggle input:checked {
          background: var(--udc-primary);
        }
        .picker-toggle input:checked::before {
          transform: translateX(14px);
        }
        .picker-toggle input:focus-visible {
          outline: 2px solid var(--udc-primary);
          outline-offset: 2px;
        }
        /* Eigene Scrollfläche, damit die Liste den Dialog nicht endlos lang
           macht; Kopf und Aktionen des Dialogs bleiben erreichbar. */
        .picker-list {
          max-height: 320px;
          overflow: auto;
          overscroll-behavior: contain;
          border-top: 1px solid var(--udc-divider);
        }
        .picker-list .dlg-note {
          padding: 0 14px;
        }
        .pick.current {
          background: var(--udc-primary-soft);
        }
        .pick.taken .ln-name {
          color: var(--udc-text2);
        }
        .pick small.pick-taken {
          color: var(--udc-warning);
        }
        .pick-group {
          padding: 10px 14px 4px;
          color: var(--udc-text2);
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        /* Entitäten */
        .entities {
          list-style: none;
          margin: 0;
          padding: 0;
          border-radius: 14px;
          background: var(--udc-subtle);
          overflow: hidden;
        }
        .entities li + li {
          border-top: 1px solid var(--udc-divider);
        }
        .entities li.entity {
          display: flex;
          align-items: center;
          gap: 12px;
          box-sizing: border-box;
          width: 100%;
          padding: 10px 14px;
          font-size: 14px;
          cursor: pointer;
        }
        .entities li.entity:hover {
          background: var(--udc-hover);
        }
        .entities li.entity:focus-visible {
          outline: 2px solid var(--udc-primary);
          outline-offset: -2px;
        }
        .ent-icon {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: var(--udc-card);
          color: var(--udc-text2);
        }
        .ent-icon svg {
          width: 16px;
          height: 16px;
        }
        .ent-name {
          flex: 1 1 auto;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .ent-id {
          display: flex;
          align-items: center;
          gap: 2px;
          min-width: 0;
        }
        .ent-id small {
          min-width: 0;
          color: var(--udc-text3);
          font-size: 12px;
          overflow-wrap: anywhere;
        }
        .ent-state {
          flex: 0 0 auto;
          max-width: 45%;
          text-align: right;
          overflow-wrap: anywhere;
        }
        /* Kleiner Icon-Button, aber mit ausreichend grosser Trefferfläche
           für den Finger (negativer Rand gleicht das Polster optisch aus). */
        .copy-btn {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          margin: -6px 0;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: none;
          color: var(--udc-text3);
          cursor: pointer;
        }
        .copy-btn svg {
          width: 15px;
          height: 15px;
        }
        .copy-btn:hover {
          background: var(--udc-hover);
          color: var(--udc-text);
        }
        .copy-btn.done {
          color: var(--udc-success);
        }
        .dlg-actions {
          position: sticky;
          bottom: 0;
          z-index: 2;
          display: flex;
          gap: 8px;
          padding: 14px 22px calc(16px + env(safe-area-inset-bottom, 0px));
          background: var(--udc-card);
          border-top: 1px solid var(--udc-divider);
        }
        .dlg-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 42px;
          padding: 0 18px;
          border-radius: 12px;
          border: 1px solid var(--udc-divider);
          background: none;
          color: var(--udc-text);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
        }
        .dlg-btn[data-dlg="close"] {
          flex: 1 1 auto;
        }
        .dlg-btn svg {
          width: 18px;
          height: 18px;
        }
        .dlg-btn:hover {
          background: var(--udc-hover);
        }
        .dlg-btn.destructive {
          color: var(--udc-error);
          border-color: color-mix(in srgb, var(--udc-error) 45%, transparent);
        }
        .state-row td {
          text-align: center;
          padding: 40px 12px;
          color: var(--secondary-text-color, #727272);
        }
        .error-banner {
          flex: 0 0 auto;
          margin: 16px;
          padding: 12px 16px;
          border-radius: 8px;
          background: var(--card-background-color, #fff);
          box-shadow: inset 0 0 0 999px rgba(176, 0, 32, 0.08);
          color: var(--error-color, #b00020);
          display: none;
        }
        .error-banner button {
          margin-left: 12px;
          border: 1px solid currentColor;
          background: none;
          color: inherit;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
        }
      </style>

      <div class="toolbar">
        <img
          class="brand-icon"
          src="${BRAND_ICON_URL}"
          alt=""
          onerror="this.style.display='none'"
        />
        <div class="search-wrap">
          ${icon("search")}
          <input type="search" class="search" placeholder="${this._escape(
            t("searchPlaceholder")
          )}" value="${this._escape(this._search)}" />
          <button class="search-clear${
            this._search ? " visible" : ""
          }" title="${this._escape(t("clearSearch"))}" aria-label="${this._escape(
            t("clearSearch")
          )}">×</button>
        </div>
        <button class="tool-btn filter-btn" title="${this._escape(
          t("filtersTitle")
        )}" aria-label="${this._escape(t("filtersTitle"))}">
          ${icon("filter")}<span class="count-badge" hidden></span>
        </button>
        <div class="stats" role="group" aria-label="${this._escape(t("statsGroup"))}">
          <button class="stat" data-filter="all" title="${this._escape(t("statShowAll"))}">
            <span class="stat-num" data-count="all">–</span>
            <span class="stat-label" data-label="all">${this._escape(t("statTotal")(0))}</span>
          </button>
          <button class="stat" data-filter="online" title="${this._escape(t("statShowOnline"))}">
            <span class="dot online"></span>
            <span class="stat-num" data-count="online">–</span>
            <span class="stat-label">${this._escape(t("statOnline"))}</span>
          </button>
          <button class="stat" data-filter="offline" title="${this._escape(t("statShowOffline"))}">
            <span class="dot offline"></span>
            <span class="stat-num" data-count="offline">–</span>
            <span class="stat-label">${this._escape(t("statOffline"))}</span>
          </button>
        </div>
        <span class="toolbar-spacer"></span>
        <button class="tool-btn cols-btn" aria-haspopup="true" aria-expanded="false">
          ${icon("columns")}${this._escape(t("columnsBtn"))}<span class="count-badge" hidden></span>
        </button>
        <button class="tool-btn reset-btn">
          ${icon("reset")}${this._escape(t("resetFilters"))}<span class="count-badge" hidden></span>
        </button>
      </div>

      <div class="chips" hidden></div>

      <div class="error-banner">
        <span class="error-text"></span>
        <button class="retry-btn">${this._escape(t("retry"))}</button>
      </div>

      <div class="content">
        <table>
          <thead>
            <tr class="head-row">${this._headerRowHtml()}</tr>
            <tr class="filter-row">
              <th>${this._textFilterHtml("name")}</th>
              <th>${this._textFilterHtml("linked")}</th>
              <th>${this._textFilterHtml("ip", t("ipPlaceholder"))}</th>
              <th>${this._textFilterHtml("mac")}</th>
              <th>${this._textFilterHtml("essid")}</th>
              <th>${this._textFilterHtml("ap_name")}</th>
              <th><select class="col-filter filter-conn" data-col="conn" aria-label="${this._escape(
                t("colConn")
              )}">${this._connOptionsHtml()}</select></th>
              <th><select class="col-filter filter-seen" data-col="seen" aria-label="${this._escape(
                t("colSeen")
              )}">${this._seenOptionsHtml()}</select></th>
              <th><select class="col-filter filter-status" data-col="status" aria-label="${this._escape(
                t("colStatus")
              )}">${this._statusOptionsHtml()}</select></th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div class="table-foot"><span class="foot-count"></span><span class="hint">${this._escape(
          t("footerHint")
        )}</span></div>
      </div>

      <div class="cols-pop" hidden></div>
      <style class="colvis"></style>
      <dialog class="device"></dialog>
      <dialog class="filters"></dialog>
    `;

    const root = this.shadowRoot;
    const search = root.querySelector(".search");
    const searchClear = root.querySelector(".search-clear");
    search.addEventListener("input", () => {
      this._search = search.value;
      searchClear.classList.toggle("visible", this._search.length > 0);
      this._openMenuKey = null;
      this._renderRows();
      this._savePrefs();
    });

    searchClear.addEventListener("click", () => {
      this._search = "";
      search.value = "";
      searchClear.classList.remove("visible");
      search.focus();
      this._renderRows();
      this._savePrefs();
    });

    // Statusleiste als Filter: erneuter Tipp auf den bereits aktiven Teil
    // (online/offline) schaltet zurück auf alle.
    root.querySelector(".stats").addEventListener("click", (ev) => {
      const btn = ev.target.closest(".stat");
      if (!btn) return;
      const filter = btn.dataset.filter;
      this._setColumnFilter(
        "status",
        filter !== "all" && filter === this._onlineFilter ? "all" : filter
      );
    });

    // Filterzeile: Textfelder live beim Tippen, Auswahlfelder bei Änderung.
    const filterRow = root.querySelector("tr.filter-row");
    filterRow.addEventListener("input", (ev) => {
      const el = ev.target;
      if (!el.dataset || !el.dataset.col || el.tagName !== "INPUT") return;
      el.classList.toggle("on", el.value.trim() !== "");
      this._setColumnFilter(el.dataset.col, el.value);
    });
    filterRow.addEventListener("change", (ev) => {
      const el = ev.target;
      if (!el.dataset || !el.dataset.col || el.tagName !== "SELECT") return;
      this._setColumnFilter(el.dataset.col, el.value);
    });

    // Chips: einzelnen Filter entfernen oder alle.
    root.querySelector(".chips").addEventListener("click", (ev) => {
      const chip = ev.target.closest("[data-chip]");
      if (chip) {
        const col = chip.dataset.chip;
        this._setColumnFilter(col, col === "conn" || col === "seen" ? "all" : "");
        return;
      }
      if (ev.target.closest(".chips-clear")) {
        this._colFilters = {};
        this._connFilter = "all";
        this._seenFilter = "all";
        this._renderRows();
        this._savePrefs();
      }
    });

    root.querySelector(".reset-btn").addEventListener("click", () => {
      this._clearAllFilters();
      this._sortKey = DEFAULT_PREFS.sortKey;
      this._sortDir = DEFAULT_PREFS.sortDir;
      this._openMenuKey = null;
      this._renderHeader();
      this._renderRows();
      this._savePrefs();
    });

    // Spalten-Popover (Desktop).
    root.querySelector(".cols-btn").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._openMenuKey = null;
      this._toggleColumnsPopover(!this._colsOpen);
    });
    const colsPop = root.querySelector(".cols-pop");
    colsPop.addEventListener("change", (ev) => {
      const key = ev.target.dataset && ev.target.dataset.colvis;
      if (key) this._setColumnVisible(key, ev.target.checked);
    });
    colsPop.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (ev.target.closest("[data-cols-all]")) {
        this._hiddenCols.clear();
        this._applyColumnVisibility();
        this._savePrefs();
        this._renderColumnsPopover();
      }
    });
    // Schliessen bei Klick ausserhalb oder Esc.
    root.addEventListener("click", () => {
      if (this._colsOpen) this._toggleColumnsPopover(false);
    });
    root.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && this._colsOpen) {
        this._toggleColumnsPopover(false);
        root.querySelector(".cols-btn").focus();
      }
    });

    // Filter-Blatt (Handy).
    const sheet = root.querySelector("dialog.filters");
    root.querySelector(".filter-btn").addEventListener("click", () => {
      this._openMenuKey = null;
      this._renderRows();
      this._renderFilterSheet();
      if (typeof sheet.showModal === "function") sheet.showModal();
      else sheet.setAttribute("open", "");
    });
    sheet.addEventListener("change", (ev) => {
      const key = ev.target.dataset && ev.target.dataset.fcolvis;
      if (key) this._setColumnVisible(key, ev.target.checked);
    });
    sheet.addEventListener("input", (ev) => {
      const el = ev.target;
      if (!el.dataset || !el.dataset.fcol) return;
      el.classList.toggle("on", el.value.trim() !== "");
      this._setColumnFilter(el.dataset.fcol, el.value);
      this._updateSheetApply();
    });
    sheet.addEventListener("click", (ev) => {
      // Klick auf den Hintergrund schliesst.
      if (ev.target === sheet) {
        const r = sheet.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) {
          sheet.close();
        }
        return;
      }
      const seg = ev.target.closest("[data-fseg]");
      if (seg) {
        this._setColumnFilter(seg.dataset.fseg, seg.dataset.value);
        this._renderFilterSheet();
        return;
      }
      if (ev.target.closest("[data-fclear]")) {
        this._colFilters = {};
        this._connFilter = "all";
        this._seenFilter = "all";
        this._renderRows();
        this._savePrefs();
        this._renderFilterSheet();
        return;
      }
      if (ev.target.closest("[data-fapply]")) sheet.close();
    });

    this._applyColumnVisibility();

    this.shadowRoot.querySelector(".retry-btn").addEventListener("click", () => {
      this._loading = true;
      this._renderRows();
      this._fetchClients();
    });

    // Ein delegierter Klick-Handler für die ganze Tabelle statt pro Zeile
    // neu zu binden - robust gegenüber dem kompletten tbody-Neuaufbau bei
    // jeder Aktualisierung.
    this.shadowRoot.querySelector("tbody").addEventListener("click", (ev) =>
      this._handleTableClick(ev)
    );

    // Delegiert wie beim tbody: die Kopfzeile wird bei jeder Sortierung
    // neu aufgebaut (Pfeil-Indikator), ein einzelner Listener übersteht das.
    this.shadowRoot.querySelector("thead").addEventListener("click", (ev) =>
      this._handleHeaderClick(ev)
    );

    // Menü schliessen, wenn irgendwo ausserhalb geklickt wird.
    this.shadowRoot.addEventListener("click", (ev) => {
      if (!ev.target.closest(".menu") && !ev.target.closest(".menu-btn")) {
        if (this._openMenuKey !== null) {
          this._openMenuKey = null;
          this._renderRows();
        }
      }
    });

    // Menü schliessen beim Scrollen: es ist position: fixed (siehe
    // CSS-Kommentar bei .menu), scrollt also nicht mit seiner Zeile mit und
    // würde sonst optisch abdriften. .content ist der einzige Bereich, der
    // scrollt (siehe Kommentar bei :host).
    this.shadowRoot.querySelector(".content").addEventListener("scroll", () => {
      this._lastScrollAt = Date.now();
      if (this._openMenuKey !== null) {
        this._openMenuKey = null;
        this._renderRows();
      }
    });

    // Tastatur: Enter/Leertaste auf einer fokussierten Zeile öffnet die
    // Geräteansicht wie ein Klick.
    this.shadowRoot.querySelector("tbody").addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const row = ev.target.closest && ev.target.closest("tr[data-key]");
      if (!row || ev.target !== row) return;
      ev.preventDefault();
      this._openDialog(row.dataset.key);
    });

    const dialog = this.shadowRoot.querySelector("dialog.device");
    dialog.addEventListener("click", (ev) => this._handleDialogClick(ev));
    // Entitätszeilen sind keine echten Buttons (siehe _renderDialog), also
    // Enter/Leertaste selbst in einen Klick übersetzen.
    dialog.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      if (!ev.target.matches || !ev.target.matches("li.entity")) return;
      ev.preventDefault();
      ev.target.click();
    });
    dialog.addEventListener("input", (ev) => {
      if (!ev.target.matches || !ev.target.matches('[data-dlg="picker-search"]')) return;
      this._pickerQuery = ev.target.value;
      this._renderDialog();
    });
    // Esc bei offener Geräteauswahl schliesst nur die Auswahl, nicht den
    // ganzen Dialog.
    dialog.addEventListener("cancel", (ev) => {
      if (!this._pickerOpen) return;
      ev.preventDefault();
      this._pickerOpen = false;
      this._renderDialog();
    });
    // Esc schliesst den Dialog nativ; hier nur den Zustand nachziehen.
    dialog.addEventListener("close", () => {
      // "close" kommt asynchron. Wurde inzwischen schon der nächste Client
      // geöffnet (Esc und sofort andere Zeile), gehört der Zustand bereits
      // zu diesem und darf nicht zurückgesetzt werden.
      if (dialog.open) return;
      this._dialogKey = null;
      this._dialogError = null;
      this._dialogHtml = "";
    });

    this._renderRows();
  }

  _handleTableClick(ev) {
    const menuBtn = ev.target.closest(".menu-btn");
    const actionBtn = ev.target.closest("button[data-action]");
    const row = ev.target.closest("tr[data-key]");
    if (!row) return;
    const key = row.dataset.key;
    const entryId = row.dataset.entryId;
    const mac = row.dataset.mac;
    const name = row.dataset.name;
    const deviceId = row.dataset.deviceId || null;

    if (menuBtn) {
      ev.stopPropagation();
      this._openMenuKey = this._openMenuKey === key ? null : key;
      this._renderRows();
      return;
    }

    if (actionBtn) {
      ev.stopPropagation();
      const action = actionBtn.dataset.action;
      this._openMenuKey = null;
      if (action === "details") {
        this._openDialog(key);
      } else if (action === "open-linked") {
        this._openDevice(actionBtn.dataset.linkedId);
      } else if (action === "open-device") {
        this._openDevice(deviceId);
      } else if (action === "exclude") {
        this._excludeClient(entryId, mac);
      } else if (action === "unexclude") {
        this._unexcludeClient(entryId, mac);
      } else if (action === "remove") {
        if (window.confirm(this._t("confirmRemove")(name))) {
          this._removeClient(entryId, mac);
        }
      }
      this._renderRows();
      return;
    }

    // Klick auf die Zeile öffnet die Geräteansicht. Früher führte er auf
    // die HA-Geräteseite und damit weg vom Panel, was beim Scrollen leicht
    // ungewollt passierte. Jetzt ist es nur ein Dialog, der sich mit einem
    // Tipp wieder schliesst, und zusätzlich abgesichert: Nach einer
    // Wischbewegung löst der Browser ohnehin keinen Klick aus; ein Tipp
    // in eine noch laufende Schwungbewegung (stoppt nur das Scrollen) und
    // ein Markieren von Text (z.B. MAC kopieren) öffnen ebenfalls nichts.
    // Ist ein Zeilenmenü offen, schliesst der erste Tipp nur dieses (der
    // Handler am shadowRoot erledigt das), statt gleich einen Dialog zu öffnen.
    if (this._openMenuKey !== null) return;
    // Dasselbe für die offene Spaltenauswahl.
    if (this._colsOpen) return;
    if (Date.now() - this._lastScrollAt < SCROLL_CLICK_GUARD_MS) return;
    const selection = window.getSelection ? String(window.getSelection() || "") : "";
    if (selection) return;
    this._openDialog(key);
  }

  // Gemeinsame Regel für Tabelle und Zähler, damit beide nie auseinander-
  // laufen können.
  _matchesConn(c) {
    if (this._connFilter === "wired") return !!c.is_wired;
    if (this._connFilter === "wireless") return !c.is_wired;
    return true;
  }

  // Alle Spaltenfilter ausser Status: Verbindung, "Zuletzt gesehen" und die
  // Textfelder. Gross-/Kleinschreibung egal; bei der MAC auch ohne
  // Trennzeichen ("a1d0" findet "…:a1:d0").
  _matchesColumns(c) {
    if (!this._matchesConn(c)) return false;
    if (this._seenFilter !== "all") {
      const age = c.seen_at ? Date.now() / 1000 - c.seen_at : Infinity;
      if (this._seenFilter === "1h" && age > 3600) return false;
      if (this._seenFilter === "24h" && age > 86400) return false;
      if (this._seenFilter === "7d" && age <= 7 * 86400) return false;
    }
    for (const key of TEXT_FILTER_KEYS) {
      const needle = String(this._colFilters[key] || "").trim().toLowerCase();
      if (!needle) continue;
      let hay;
      if (key === "linked") {
        const d = c.linked_device || {};
        hay = [d.name, d.area].filter(Boolean).join(" ");
      } else {
        hay = c[key] == null ? "" : String(c[key]);
      }
      hay = hay.toLowerCase();
      if (key === "mac") {
        const strip = (v) => v.replace(/[^0-9a-f]/g, "");
        if (!hay.includes(needle) && !(strip(needle) && strip(hay).includes(strip(needle)))) {
          return false;
        }
      } else if (!hay.includes(needle)) {
        return false;
      }
    }
    return true;
  }

  // Anzahl aktiver Spaltenfilter (ohne Status, den zeigt die Statusleiste).
  _activeColumnFilterCount() {
    let n = TEXT_FILTER_KEYS.filter((k) => String(this._colFilters[k] || "").trim()).length;
    if (this._connFilter !== "all") n += 1;
    if (this._seenFilter !== "all") n += 1;
    return n;
  }

  _clearAllFilters() {
    this._search = "";
    this._onlineFilter = "all";
    this._connFilter = "all";
    this._seenFilter = "all";
    this._colFilters = {};
  }

  // Zählt über alle Hosts innerhalb der Spaltenfilter (sie bestimmen,
  // welche Gerätegruppe man anschaut), aber bewusst ohne globale Suche und
  // ohne Online/Offline-Filter: sonst stünde beim Tipp auf "offline" bei
  // "online" immer 0. Vor dem ersten Laden und wenn es noch nie geklappt
  // hat ein Strich statt einer falschen 0.
  _renderStats() {
    const root = this.shadowRoot;
    const stats = root && root.querySelector(".stats");
    if (!stats) return;
    const base = this._clients.filter((c) => this._matchesColumns(c));
    const total = base.length;
    const known = this._clients.length > 0 || (!this._loading && !this._error);
    const online = base.filter((c) => c.online).length;
    const counts = { all: total, online, offline: total - online };
    for (const key of Object.keys(counts)) {
      stats.querySelector(`[data-count="${key}"]`).textContent = known
        ? String(counts[key])
        : "–";
    }
    stats.querySelector('[data-label="all"]').textContent = this._t("statTotal")(total);
    for (const btn of stats.querySelectorAll(".stat")) {
      const active = btn.dataset.filter === this._onlineFilter;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  _renderRows() {
    if (!this.shadowRoot) return;
    const root = this.shadowRoot;
    const tbody = root.querySelector("tbody");
    if (!tbody) return;
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);

    this._renderStats();
    this._syncFilterInputs();
    // Vor den frühen Rückgaben unten (Laden, leere Tabelle): der Dialog
    // hängt nicht davon ab, ob der Client gerade in der Tabelle sichtbar ist.
    this._renderDialog();

    // Chips, Zähler-Badges und Fusszeile.
    const chips = root.querySelector(".chips");
    const chipsHtml = this._chipsHtml();
    if (chips.innerHTML !== chipsHtml) chips.innerHTML = chipsHtml;
    chips.hidden = !chipsHtml;
    const colCount = this._activeColumnFilterCount();
    const filterBadge = root.querySelector(".filter-btn .count-badge");
    filterBadge.textContent = String(colCount);
    filterBadge.hidden = colCount === 0;
    const resetCount =
      colCount + (this._onlineFilter !== "all" ? 1 : 0) + (this._search.trim() ? 1 : 0);
    const resetBadge = root.querySelector(".reset-btn .count-badge");
    resetBadge.textContent = String(resetCount);
    resetBadge.hidden = resetCount === 0;
    this._updateSheetApply();

    const errorBanner = root.querySelector(".error-banner");
    if (this._error) {
      errorBanner.style.display = "flex";
      errorBanner.style.alignItems = "center";
      root.querySelector(".error-text").textContent = `${t("error")} ${this._error}`;
    } else {
      errorBanner.style.display = "none";
    }

    const foot = root.querySelector(".foot-count");
    if (this._loading) {
      // Platzhalterzeilen in etwa der Breite echter Inhalte.
      const widths = [150, 110, 95, 120, 70, 90, 80, 90, 60, 20];
      tbody.innerHTML = Array.from(
        { length: 8 },
        () =>
          `<tr class="skeleton-row">${widths
            .map((w) => `<td><div class="skeleton" style="width:${w}px"></div></td>`)
            .join("")}</tr>`
      ).join("");
      foot.textContent = t("loading");
      return;
    }

    const rows = this._filteredClients();
    const time = this._lastFetchAt
      ? this._lastFetchAt.toLocaleTimeString(pickLang(this._hass) === "de" ? "de-CH" : "en-US")
      : "–";
    foot.textContent = t("footer")(rows.length, this._clients.length, time);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr class="state-row"><td colspan="10">${esc(t("empty"))}</td></tr>`;
      return;
    }

    const multiHost = this._hostCount > 1;

    tbody.innerHTML = rows
      .map((c) => {
        const key = `${c.entry_id}|${c.mac}`;
        const kind = c.is_wired == null ? "unknown" : c.is_wired ? "eth" : "wifi";
        const connText =
          c.is_wired == null ? t("connUnknown") : c.is_wired ? t("connWired") : t("connWireless");
        const bars = kind === "wifi" ? signalBars(c.signal) : 0;
        const barsHtml = bars
          ? `<span class="bars s${bars}${c.online ? "" : " stale"}" title="${esc(
              this._formatSignal(c) || ""
            )}"><i></i><i></i><i></i><i></i></span>`
          : "";
        const status = c.online
          ? `<span class="pill online"><span class="dot online"></span>${esc(t("statusOnline"))}</span>`
          : `<span class="pill offline"><span class="dot offline"></span>${esc(t("statusOffline"))}</span>`;
        const shield = c.excluded
          ? `<span class="shield" title="${esc(t("protectedTitle"))}" aria-label="${esc(
              t("protectedTitle")
            )}">${icon("shield")}</span>`
          : "";
        const mobSub = [connText, kind === "wifi" ? c.ap_name : null].filter(Boolean).join(" · ");
        const seen = c.seen_at
          ? `<span class="seen">${esc(this._formatRelative(c.seen_at, true))}<small>${esc(
              this._formatSeen(c.seen_at)
            )}</small></span>`
          : `<span class="muted">${esc(t("seenNever"))}</span>`;
        const dash = `<span class="muted">–</span>`;

        const menuOpen = this._openMenuKey === key;
        const menu = menuOpen
          ? `
          <div class="menu">
            <button data-action="details">${icon("info")}${esc(t("menuDetails"))}</button>
            <button data-action="open-device" ${c.device_id ? "" : "disabled"}>${icon("open")}${esc(
              t("menuOpenDevice")
            )}</button>
            <button data-action="${c.excluded ? "unexclude" : "exclude"}">${icon(
              c.excluded ? "shieldOff" : "shield"
            )}${esc(c.excluded ? t("menuUnexclude") : t("menuExclude"))}</button>
            <hr />
            <button data-action="remove" class="destructive">${icon("trash")}${esc(
              t("menuRemove")
            )}</button>
          </div>`
          : "";

        return `
          <tr data-key="${esc(key)}" tabindex="0"
              data-entry-id="${esc(c.entry_id)}"
              data-mac="${esc(c.mac)}"
              data-name="${esc(c.name)}"
              data-device-id="${esc(c.device_id || "")}">
            <td class="name-cell"><div class="name">
              <span class="avatar">${icon(kind)}</span>
              <span class="name-text"><span class="t"><span class="dot ${
                c.online ? "online" : "offline"
              } mob-dot"></span>${esc(c.name)}${shield}</span>${
                multiHost ? `<small>${esc(c.host || "")}</small>` : ""
              }<small class="mob-sub">${esc(mobSub)}</small></span>
            </div></td>
            <td>${
              c.linked_device
                ? `<button class="linked-link" data-action="open-linked" data-linked-id="${esc(
                    c.linked_device.id
                  )}" title="${esc(t("linkOpen")(c.linked_device.name))}">${icon("link")}${esc(
                    c.linked_device.name
                  )}</button>`
                : dash
            }</td>
            <td class="mono">${c.ip ? esc(c.ip) : dash}</td>
            <td class="mono">${esc(c.mac)}</td>
            <td>${c.essid ? esc(c.essid) : dash}</td>
            <td>${c.ap_name ? esc(c.ap_name) : dash}</td>
            <td><span class="conn">${icon(kind)}${esc(connText)}${barsHtml}</span></td>
            <td>${seen}</td>
            <td>${status}</td>
            <td class="actions-cell">
              <button class="menu-btn" title="⋮" aria-label="⋮">${icon("kebab")}</button>
              ${menu}
            </td>
          </tr>`;
      })
      .join("");

    this._positionOpenMenu();
  }
  // Setzt die Bildschirmposition des offenen Menüs anhand der echten
  // Koordinaten seines Buttons (position: fixed, siehe CSS-Kommentar dort).
  // Öffnet automatisch nach oben, wenn unterhalb nicht genug Platz ist -
  // "immer nach oben" wäre für die obersten Zeilen genau dasselbe Problem
  // andersherum. Läuft nach jedem Tabellen-Rebuild, auch nach dem
  // Live-Polling, damit ein offenes Menü nicht an der alten Position
  // hängen bleibt, wenn sich Zeilen verschieben.
  _positionOpenMenu() {
    if (this._openMenuKey === null) return;

    const menuEl = this.shadowRoot.querySelector(".menu");
    const row = this.shadowRoot.querySelector(
      `tr[data-key="${this._openMenuKey}"]`
    );
    const btn = row ? row.querySelector(".menu-btn") : null;
    if (!menuEl || !btn) return;

    const btnRect = btn.getBoundingClientRect();
    const menuHeight = menuEl.offsetHeight;
    const margin = 4;
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;
    const openUp = spaceBelow < menuHeight + margin && spaceAbove > spaceBelow;

    menuEl.style.right = `${window.innerWidth - btnRect.right}px`;
    if (openUp) {
      menuEl.style.top = "";
      menuEl.style.bottom = `${window.innerHeight - btnRect.top + margin}px`;
    } else {
      menuEl.style.bottom = "";
      menuEl.style.top = `${btnRect.bottom + margin}px`;
    }
  }
}

customElements.define("unifi-dynamic-panel", UnifiDynamicPanel);
