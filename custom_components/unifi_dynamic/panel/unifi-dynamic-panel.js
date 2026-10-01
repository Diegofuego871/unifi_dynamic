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

// Wie lange ein Verbindungsunterbruch still überbrückt wird, bevor die
// Fehlermeldung erscheint.
const RETRY_GIVE_UP_MS = 30000;

// Texte und Styles in eigenen Modulen. Der Cache-Buster (?v=...) dieser Datei
// gilt auch für sie, sonst lädt der Browser nach einem Update alte Teile.
const MODULE_VERSION = new URL(import.meta.url).search;
const [{ STRINGS }, { PANEL_CSS }] = await Promise.all([
  import(`./strings.js${MODULE_VERSION}`),
  import(`./styles.js${MODULE_VERSION}`),
]);

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

// Ansichtseinstellungen (Online/Offline, Verbindung, Sortierung,
// ausgeblendete Spalten, "Bereits verknüpfte ausblenden") speichert Home
// Assistant pro Benutzer (frontend/set_user_data) - damit gelten sie auf
// allen Geräten und in der App. localStorage hält nur eine lokale Kopie für
// das sofortige Anzeigen beim Start und als Rückfall, falls HA den Speicher
// nicht anbietet. Suchtext, Textfilter und "Zuletzt gesehen" werden bewusst
// gar nicht gespeichert: sie gelten nur, solange das Panel offen ist.
const STORAGE_KEY = "unifi_dynamic_panel_prefs";
const USER_DATA_KEY = "unifi_dynamic_panel";
const USER_DATA_SAVE_DELAY_MS = 400;
// Schmal = Handy-Layout (gleiche Grenze wie im CSS). Ausgeblendete Spalten
// gibt es getrennt für schmal und breit, sonst fehlte eine am Handy
// ausgeblendete Spalte auch am Desktop.
const NARROW_QUERY = "(max-width: 600px)";
const SORT_KEYS = ["name", "linked", "ip", "mac", "essid", "ap_name", "conn", "ping", "seen_at", "status"];
const ONLINE_FILTERS = ["all", "online", "offline"];
const CONN_FILTERS = ["all", "wired", "wireless"];
const SEEN_FILTERS = ["all", "1h", "24h", "7d"];
// Spalten mit Textfilter (Schlüssel = Feld bzw. Sortierschlüssel).
const TEXT_FILTER_KEYS = ["name", "linked", "ip", "mac", "essid", "ap_name"];
// Ausblend- und verschiebbare Spalten in Standardreihenfolge, mit
// Beschriftung. Alias (immer vorn) und das Menü (immer hinten) sind fest:
// ohne Alias fehlte der Einstieg in die Geräteansicht, und auf dem Handy
// ist Alias die fixierte erste Spalte. Die dritte Angabe (frühere
// nth-child-Position) wird nicht mehr gebraucht.
const HIDEABLE_COLUMNS = [
  ["linked", "colLinked", 2],
  ["ip", "colIp", 3],
  ["mac", "colMac", 4],
  ["essid", "colSsid", 5],
  ["ap_name", "colAp", 6],
  ["conn", "colConn", 7],
  ["ping", "colPing", 7],
  ["seen_at", "colSeen", 8],
  ["status", "colStatus", 9],
];
const HIDEABLE_KEYS = HIDEABLE_COLUMNS.map(([key]) => key);

// Ping-Stufen: Grenzen in ms. Unter der ersten Grenze 5 Balken (sehr gut),
// ab der letzten 1 Balken (schlecht). Gilt für Tabelle und Diagramm.
const PING_TIERS = [5, 15, 40, 100];

function pingTier(ms) {
  if (ms == null) return 0;
  const i = PING_TIERS.findIndex((limit) => ms < limit);
  return i === -1 ? 1 : 5 - i;
}

// WLAN-Fächer wie bei Apple: Punkt + 3 Bögen = 4 Stufen, gleiche Grenzen
// wie signalBars. Farben aus der Ping-Palette (grün, orange, violett, rot).
// Bögen um den Punkt (9/12.2); der äussere Bogen samt halber Strichbreite
// (1.1) endet oben bei 0.5, der Punkt unten bei 13.8: nichts wird vom
// Rand der Fläche (18 x 14) abgeschnitten.
function wifiFanHtml(tier, stale) {
  const cy = 12.2;
  const arc = (r) => {
    const a = Math.PI / 4;
    const x1 = 9 - r * Math.sin(a);
    const y = cy - r * Math.cos(a);
    const x2 = 9 + r * Math.sin(a);
    return `M${x1.toFixed(2)} ${y.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y.toFixed(2)}`;
  };
  return `<svg class="wfan w${tier}${stale ? " stale" : ""}" viewBox="0 0 18 14" aria-hidden="true"><circle class="d" cx="9" cy="${cy}" r="1.6"/>${[4, 7.3, 10.6]
    .map((r, i) => `<path class="s a${i + 1}" d="${arc(r)}"/>`)
    .join("")}</svg>`;
}

function pingBarsHtml(tier) {
  return `<span class="pbars t${tier}" aria-hidden="true"><u></u><u></u><u></u><u></u><u></u></span>`;
}

// Material Design Icons als Pfade; das iframe kennt HAs ha-icon nicht.
const ICONS = {
  chevronRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  chevronLeft: "M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z",
  flask: "M5,19A1,1 0 0,0 6,20H18A1,1 0 0,0 19,19C19,18.79 18.93,18.59 18.82,18.43L13,8.35V4H11V8.35L5.18,18.43C5.07,18.59 5,18.79 5,19M6,22A3,3 0 0,1 3,19C3,18.4 3.18,17.84 3.5,17.37L9,7.81V6A1,1 0 0,1 8,5V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V5A1,1 0 0,1 15,6V7.81L20.5,17.37C20.82,17.84 21,18.4 21,19A3,3 0 0,1 18,22H6M13,16L14.34,14.66L16.27,18H7.73L10.39,13.39L13,16M12.5,12A0.5,0.5 0 0,1 13,12.5A0.5,0.5 0 0,1 12.5,13A0.5,0.5 0 0,1 12,12.5A0.5,0.5 0 0,1 12.5,12Z",
  dice: "M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M7,5A2,2 0 0,0 5,7A2,2 0 0,0 7,9A2,2 0 0,0 9,7A2,2 0 0,0 7,5M17,15A2,2 0 0,0 15,17A2,2 0 0,0 17,19A2,2 0 0,0 19,17A2,2 0 0,0 17,15M17,5A2,2 0 0,0 15,7A2,2 0 0,0 17,9A2,2 0 0,0 19,7A2,2 0 0,0 17,5M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M7,15A2,2 0 0,0 5,17A2,2 0 0,0 7,19A2,2 0 0,0 9,17A2,2 0 0,0 7,15Z",
  alert: "M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  key: "M7,14A2,2 0 0,1 5,12A2,2 0 0,1 7,10A2,2 0 0,1 9,12A2,2 0 0,1 7,14M12.65,10C11.83,7.67 9.61,6 7,6A6,6 0 0,0 1,12A6,6 0 0,0 7,18C9.61,18 11.83,16.33 12.65,14H17V18H21V14H23V10H12.65Z",
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
  gear: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  hub: "M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z",
  verOk: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z",
  verUp: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 7L17 12H14V16H10V12H7L12 7Z",
  verCheck: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  verDownload: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  chevron: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  drag: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  // Kopf des Statistik-Fensters: Verfügbarkeit (mdi:pulse), Antwortzeit
  // (mdi:timer-outline); WLAN nutzt "wifi", der Controller "hub".
  pulse: "M3,13H5.79L10.1,4.79L11.28,13.75L14.5,9.66L17.83,13H21V15H17L14.67,12.67L9.92,18.73L8.94,11.31L7,15H3V13Z",
  timer: "M12,20A7,7 0 0,1 5,13A7,7 0 0,1 12,6A7,7 0 0,1 19,13A7,7 0 0,1 12,20M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39M11,14H13V8H11M15,1H9V3H15V1Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  device: "M4,6H20V16H4M20,18A2,2 0 0,0 22,16V6C22,4.89 21.1,4 20,4H4C2.89,4 2,4.89 2,6V16A2,2 0 0,0 4,18H0V20H24V18H20Z",
  entity: "M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7Z",
};
// innerHTML nur ersetzen, wenn sich das erzeugte HTML geändert hat. Verglichen
// wird mit dem zuletzt gesetzten String, nicht mit el.innerHTML: der Browser
// serialisiert anders (disabled -> disabled="", Leerzeichen), der Vergleich
// wäre nie gleich und der Inhalt würde bei jedem Aufruf neu aufgebaut - mit
// verlorenen Klicks, Fokus und Hover.
const _lastHtml = new WeakMap();
function setHtml(el, html) {
  if (!el || _lastHtml.get(el) === html) return false;
  el.innerHTML = html;
  _lastHtml.set(el, html);
  return true;
}

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
  onlineFilter: "all",
  connFilter: "all",
  sortKey: null,
  sortDir: "asc",
  // Ausgeblendete Spalten (Schlüssel aus HIDEABLE_COLUMNS), getrennt für
  // breites und schmales Layout. Gehört zur Ansicht, nicht zu den Filtern:
  // "Filter zurücksetzen" lässt sie stehen.
  hiddenColsWide: [],
  hiddenColsNarrow: [],
  // Spaltenreihenfolge (ohne Alias und Menü), ebenfalls je Layout.
  colOrderWide: [...HIDEABLE_KEYS],
  colOrderNarrow: [...HIDEABLE_KEYS],
  // Geräteauswahl: bei anderen Clients schon verknüpfte Geräte ausblenden
  // statt nur markieren. Gilt nur für die Auswahl, nicht für die Tabelle.
  hideLinked: false,
  // Zeitraum des Verfügbarkeits-Zeitstrahls in der Geräteansicht.
  availRange: "24h",
  // Gewählter Hub (entry_id) oder "all". Für Handy und Desktop gemeinsam.
  hub: "all",
  // Lade-Animation beim Verlauf (siehe LOADERS) oder "random".
  loader: "elephant",
  // Vorabversionen gelten seit 2.15.8 für die ganze Instanz (Backend,
  // unifi_dynamic/set_panel), nicht mehr pro Benutzer.
};

// Lade-Animationen zur Auswahl in den Einstellungen. "random" wählt bei
// jedem Laden eine andere.
const LOADERS = ["elephant", "cat", "hamster", "penguin", "runner"];
const LOADER_CHOICES = [...LOADERS, "random"];

// Zeitraum -> Dauer in Sekunden.
const AVAIL_RANGES = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400 };
// Verlauf höchstens so lange aus dem Zwischenspeicher zeigen, dann neu holen.
const AVAIL_MAX_AGE_MS = 60000;
// Kurze Lücken ohne Daten zwischen zwei gleichen Zuständen gelten als
// durchgehend: typisch ein Neustart von Home Assistant, während dem weder
// das eigene Protokoll noch der Recorder etwas aufzeichnen. Betrifft nur
// "keine Daten", nie echte Unterbrüche; längere Lücken bleiben sichtbar.
const AVAIL_BRIDGE_MS = 5 * 60 * 1000;
// Deckt die Aufzeichnung weniger als diesen Anteil des Zeitraums ab (neu
// installiert, Controller-Protokoll ab 2.9.0), beginnt der Balken beim
// ersten Datenpunkt statt am linken Rand - sonst wäre er fast nur schraffiert.
const AVAIL_ZOOM_SHARE = 0.1;
// So viele Unterbrüche listet der Dialog höchstens auf (neueste zuerst).
const AVAIL_LIST_MAX = 10;

// Gespeicherte Einstellungen prüfen (lokal wie von HA): Unbekanntes oder
// Kaputtes fällt auf den Standard zurück, statt das Panel zu stören. Liest
// auch das Format bis 2.4.0 (hiddenCols für beide Layouts).
function sanitizePrefs(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const cols = (list) =>
    Array.isArray(list) ? HIDEABLE_KEYS.filter((k) => list.includes(k)) : null;
  const legacy = cols(p.hiddenCols) || [];
  // Reihenfolge: bekannte Schlüssel in gespeicherter Folge, doppelte und
  // unbekannte verworfen, fehlende (z.B. neue Spalten) hinten angehängt.
  const order = (list) => {
    const seen = new Set();
    const out = [];
    for (const k of Array.isArray(list) ? list : []) {
      if (HIDEABLE_KEYS.includes(k) && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
    return out.concat(HIDEABLE_KEYS.filter((k) => !seen.has(k)));
  };
  return {
    onlineFilter: ONLINE_FILTERS.includes(p.onlineFilter) ? p.onlineFilter : "all",
    connFilter: CONN_FILTERS.includes(p.connFilter) ? p.connFilter : "all",
    sortKey: SORT_KEYS.includes(p.sortKey) ? p.sortKey : null,
    sortDir: p.sortDir === "desc" ? "desc" : "asc",
    hiddenColsWide: cols(p.hiddenColsWide) || legacy,
    hiddenColsNarrow: cols(p.hiddenColsNarrow) || legacy,
    colOrderWide: order(p.colOrderWide),
    colOrderNarrow: order(p.colOrderNarrow),
    hideLinked: p.hideLinked === true,
    availRange: Object.prototype.hasOwnProperty.call(AVAIL_RANGES, p.availRange) ? p.availRange : "24h",
    hub: typeof p.hub === "string" && p.hub ? p.hub : "all",
    loader: LOADER_CHOICES.includes(p.loader) ? p.loader : "elephant",
    // Zeitpunkt der letzten Änderung: entscheidet beim Laden, ob die lokale
    // Kopie oder der Stand von HA neuer ist.
    updated: typeof p.updated === "number" ? p.updated : 0,
  };
}

// Fehler beim Lesen/Schreiben werden bewusst nur geloggt, nie geworfen:
// private Browserfenster, blockierter Storage-Zugriff oder ein voller
// Speicher dürfen das Panel nicht lahmlegen, nur die Persistenz entfällt.
function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizePrefs(JSON.parse(raw)) : { ...DEFAULT_PREFS };
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
    // Alle Clients aller Hubs, und die in der Tabelle gezeigten (gewählter
    // Hub, siehe _applyHub).
    this._allClients = [];
    this._clients = [];
    // Eingerichtete Hubs (unifi_dynamic/list_hubs).
    this._hubs = [];
    // Einstellungsdialog: siehe _openSettings.
    this._settings = null;
    // Verbindungsdialog: siehe _openConn.
    this._conn = null;
    // Statistik-Unter-Fenster: siehe _openStat.
    this._stat = null;
    this._hostCount = 0;
    this._loading = true;
    this._error = null;

    // Nicht gespeichert: gelten nur, solange das Panel offen ist.
    this._search = "";
    this._colFilters = {};
    this._seenFilter = "all";
    this._colsOpen = false;
    // Gespeichert: zuerst die lokale Kopie, dann (siehe _loadUserPrefs) der
    // Stand von Home Assistant.
    this._applyPrefs(loadPrefs());
    this._narrowQuery = window.matchMedia ? window.matchMedia(NARROW_QUERY) : null;
    this._userPrefsLoaded = false;
    this._userPrefsDirty = false;
    // Stand der geladenen lokalen Kopie als "bereits gespeichert" merken:
    // sonst zählte die erste Eingabe (z.B. im Suchfeld) als Änderung und
    // könnte einen neueren Stand von HA mit der alten Kopie überschreiben.
    this._lastSavedPrefs = JSON.stringify(this._currentPrefs());
    this._userSaveTimer = null;

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
    // Verlauf der Online-Entität für den Zeitstrahl: zuletzt geholter Stand
    // { key: "entity|zeitraum", loading, error, states, start, end, at }.
    this._history = null;
    this._onParentLocation = () => this._checkDeepLink();
  }

  _applyPrefs(prefs) {
    this._prefsUpdated = prefs.updated || 0;
    this._onlineFilter = prefs.onlineFilter;
    this._connFilter = prefs.connFilter;
    this._sortKey = prefs.sortKey;
    this._sortDir = prefs.sortDir;
    this._hiddenColsWide = new Set(prefs.hiddenColsWide);
    this._hiddenColsNarrow = new Set(prefs.hiddenColsNarrow);
    this._colOrderWide = [...prefs.colOrderWide];
    this._colOrderNarrow = [...prefs.colOrderNarrow];
    this._hideLinked = prefs.hideLinked;
    this._availRange = prefs.availRange || "24h";
    this._hub = prefs.hub || "all";
    this._loader = prefs.loader || "elephant";
  }

  _currentPrefs() {
    return {
      onlineFilter: this._onlineFilter,
      connFilter: this._connFilter,
      sortKey: this._sortKey,
      sortDir: this._sortDir,
      hiddenColsWide: HIDEABLE_KEYS.filter((k) => this._hiddenColsWide.has(k)),
      hiddenColsNarrow: HIDEABLE_KEYS.filter((k) => this._hiddenColsNarrow.has(k)),
      colOrderWide: [...this._colOrderWide],
      colOrderNarrow: [...this._colOrderNarrow],
      hideLinked: this._hideLinked,
      availRange: this._availRange,
      hub: this._hub,
      loader: this._loader,
    };
  }

  _isNarrow() {
    return this._narrowQuery ? this._narrowQuery.matches : false;
  }

  // Spaltenreihenfolge des gerade aktiven Layouts (ohne Alias und Menü).
  get _colOrder() {
    return this._isNarrow() ? this._colOrderNarrow : this._colOrderWide;
  }

  set _colOrder(order) {
    if (this._isNarrow()) this._colOrderNarrow = order;
    else this._colOrderWide = order;
  }

  // Ausgeblendete Spalten des gerade aktiven Layouts (schmal/breit).
  get _hiddenCols() {
    const narrow = this._narrowQuery ? this._narrowQuery.matches : false;
    return narrow ? this._hiddenColsNarrow : this._hiddenColsWide;
  }

  // Wird bei jeder Änderung aufgerufen, auch bei nicht gespeicherten wie
  // dem Suchtext - geschrieben wird nur, wenn sich an den gespeicherten
  // Werten etwas geändert hat. An HA verzögert und gebündelt, damit schnelle
  // Klickfolgen nicht je einen Schreibvorgang auslösen.
  _savePrefs() {
    const json = JSON.stringify(this._currentPrefs());
    if (json === this._lastSavedPrefs) return;
    this._lastSavedPrefs = json;
    this._prefsUpdated = Date.now();
    savePrefs({ ...this._currentPrefs(), updated: this._prefsUpdated });
    this._userPrefsDirty = true;
    window.clearTimeout(this._userSaveTimer);
    this._userSaveTimer = window.setTimeout(() => this._saveUserPrefs(), USER_DATA_SAVE_DELAY_MS);
  }

  async _saveUserPrefs() {
    if (!this._hass || !this._userPrefsLoaded) return;
    try {
      await this._hass.callWS({
        type: "frontend/set_user_data",
        key: USER_DATA_KEY,
        value: { ...this._currentPrefs(), updated: this._prefsUpdated },
      });
      this._userPrefsDirty = false;
    } catch (err) {
      console.warn("unifi-dynamic-panel: Einstellungen nicht bei HA gespeichert", err);
    }
  }

  // Stand von Home Assistant holen. Es gewinnt der neuere Stand: Ist die
  // lokale Kopie neuer (Änderung kurz vor dem Neuladen, die HA noch nicht
  // erreicht hat, oder vor dem Eintreffen geändert) oder hat HA noch nichts
  // (Übernahme aus 2.4.0 und früher), geht sie an HA. Ohne HA-Speicher
  // bleibt es bei der lokalen Kopie.
  async _loadUserPrefs() {
    let value = null;
    try {
      const result = await this._hass.callWS({ type: "frontend/get_user_data", key: USER_DATA_KEY });
      value = result ? result.value : null;
    } catch (err) {
      console.warn("unifi-dynamic-panel: Einstellungen von HA nicht verfügbar", err);
      return;
    }
    this._userPrefsLoaded = true;
    const remote = value ? sanitizePrefs(value) : null;
    if (remote && !this._userPrefsDirty && remote.updated >= this._prefsUpdated) {
      const prefs = remote;
      this._applyPrefs(prefs);
      this._lastSavedPrefs = JSON.stringify(this._currentPrefs());
      savePrefs(prefs);
      if (this._built) {
        this._rebuildColumns();
        this._applyHub();
        this._renderRows();
      }
      return;
    }
    await this._saveUserPrefs();
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
      this._loadUserPrefs();
      this._fetchClients();
      this._startPolling();
    } else if (hass && hass.connected === true && this._wasDisconnected) {
      // HA hat die WebSocket-Verbindung wiederhergestellt (z.B. App aus dem
      // Hintergrund geholt): sofort neu laden statt auf den Poll zu warten.
      this._wasDisconnected = false;
      this._fetchClients();
    }
    if (hass && hass.connected === false) this._wasDisconnected = true;
    // Entitätszustände im offenen Dialog aktuell halten.
    this._renderDialog();
    this._renderSettingsVersion();
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
    document.addEventListener("visibilitychange", this._onVisible);
  }

  disconnectedCallback() {
    this._stopPolling();
    this._watchParentLocation(false);
    document.removeEventListener("visibilitychange", this._onVisible);
    this._clearRetry();
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

  // Panel wieder sichtbar (App/Tab aus dem Hintergrund): sofort aktualisieren.
  _onVisible = () => {
    if (document.visibilityState !== "visible" || !this._hass) return;
    this._retryCount = 0;
    this._fetchClients();
  };

  _t(key) {
    return STRINGS[pickLang(this._hass)][key];
  }

  _startPolling() {
    this._stopPolling();
    // Im Hintergrund (App/Tab nicht sichtbar) nicht abfragen; beim
    // Zurückkehren lädt _onVisible sofort.
    this._pollTimer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") this._fetchClients();
    }, POLL_INTERVAL_MS);
  }

  _stopPolling() {
    if (this._pollTimer) {
      window.clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  // Verbindungsfehler der HA-WebSocket-Bibliothek (home-assistant-js-
  // websocket): 1 = ERR_CANNOT_CONNECT, 3 = ERR_CONNECTION_LOST. Sie kommen
  // als nackte Zahl, typischerweise wenn iOS/Android die App im Hintergrund
  // eingefroren hat und die Verbindung beim Öffnen noch nicht wieder steht.
  // Kein echter Fehler: still erneut versuchen, bestehende Daten behalten.
  //
  // Je nach Version und Zeitpunkt kommt der Fehler in anderer Form: als
  // Zahl, als {code, message} oder als ganzes Ergebnis
  // {type: "result", success: false, error: {code, message}}.
  _errorCode(err) {
    if (typeof err === "number") return err;
    if (!err || typeof err !== "object") return null;
    if (err.code !== undefined) return err.code;
    if (err.error && typeof err.error === "object" && err.error.code !== undefined) return err.error.code;
    return null;
  }

  _isConnectionError(err) {
    const code = this._errorCode(err);
    if (code === 1 || code === 3 || code === "connection_lost") return true;
    return Boolean(this._hass && this._hass.connected === false);
  }

  _clearRetry() {
    if (this._retryTimer) {
      window.clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  // Wiederholung mit wachsendem Abstand (1, 2, 4, 8, 15 s). Erst wenn die
  // Verbindung nach RETRY_GIVE_UP_MS immer noch fehlt, kommt die Meldung.
  _scheduleRetry() {
    this._clearRetry();
    const n = (this._retryCount = (this._retryCount || 0) + 1);
    const delay = Math.min(15000, 1000 * 2 ** (n - 1));
    this._retryTimer = window.setTimeout(() => {
      this._retryTimer = null;
      this._fetchClients();
    }, delay);
  }

  _errorText(err) {
    if (this._isConnectionError(err)) return this._t("errorConnection");
    if (typeof err === "number") return `${this._t("errorCode")} ${err}`;
    if (err && typeof err === "object") {
      const inner = err.error && typeof err.error === "object" ? err.error : err;
      if (inner.message) return String(inner.message);
      const code = this._errorCode(err);
      if (code !== null) return `${this._t("errorCode")} ${code}`;
      try {
        return JSON.stringify(err);
      } catch (e) {
        // fällt unten auf String() zurück
      }
    }
    return String(err);
  }

  // Nie zwei Abfragen gleichzeitig: sonst könnte eine ältere Antwort eine
  // neuere überschreiben. Wer während einer laufenden Abfrage aufruft (Poll,
  // Rückkehr in den Vordergrund, nach einer Aktion), bekommt genau eine
  // Folgeabfrage und wartet auf deren Ergebnis, also auf frische Daten.
  _fetchClients() {
    if (!this._hass) return Promise.resolve();
    if (this._fetchRun) {
      if (!this._fetchNext) {
        this._fetchNext = this._fetchRun.then(() => {
          this._fetchNext = null;
          return this._fetchClients();
        });
      }
      return this._fetchNext;
    }
    // Fehler beim Darstellen dürfen die Kette nicht blockieren.
    this._fetchRun = this._fetchClientsOnce()
      .catch((err) => console.warn("unifi-dynamic-panel: Aktualisieren fehlgeschlagen", err))
      .finally(() => {
        this._fetchRun = null;
      });
    return this._fetchRun;
  }

  async _fetchClientsOnce() {
    this._clearRetry();
    try {
      const [result, hubs] = await Promise.all([
        this._hass.callWS({ type: "unifi_dynamic/list_clients" }),
        // Älteres Backend ohne Hub-Liste: aus den Clients ableiten.
        this._hass.callWS({ type: "unifi_dynamic/list_hubs" }).catch(() => null),
      ]);
      this._allClients = result.clients || [];
      this._hubs =
        hubs && Array.isArray(hubs.hubs)
          ? hubs.hubs
          : [...new Map(this._allClients.map((c) => [c.entry_id, { entry_id: c.entry_id, title: c.host, host: c.host }])).values()];
      this._applyHub();
      this._applyColumnVisibility();
      this._lastFetchAt = new Date();
      this._error = null;
      this._retryCount = 0;
      this._connLostSince = null;
    } catch (err) {
      if (this._isConnectionError(err)) {
        const now = Date.now();
        this._connLostSince = this._connLostSince || now;
        this._scheduleRetry();
        // Kurze Unterbrüche nicht melden; vorhandene Daten bleiben stehen.
        if (now - this._connLostSince < RETRY_GIVE_UP_MS) {
          if (!this._allClients.length) return;
          this._renderRows();
          return;
        }
      }
      this._error = this._errorText(err);
    }
    this._loading = false;
    this._renderRows();
    if (!this._error) this._checkDeepLink();
  }

  // Gewählter Hub, sofern es ihn (noch) gibt und es mehr als einen gibt;
  // sonst alle.
  _effectiveHub() {
    if (this._hubs.length < 2) return "all";
    return this._hubs.some((h) => h.entry_id === this._hub) ? this._hub : "all";
  }

  _applyHub() {
    const hub = this._effectiveHub();
    this._clients = hub === "all" ? this._allClients : this._allClients.filter((c) => c.entry_id === hub);
    this._hostCount = new Set(this._clients.map((c) => c.entry_id)).size;
    this._renderHubControl();
  }

  // Hub-Auswahl nur bei mehreren Hubs; das Zahnrad immer. Bei "Alle Hubs"
  // ist es gesperrt, weil die Einstellungen pro Hub gelten.
  _renderHubControl() {
    const root = this.shadowRoot;
    const ctl = root && root.querySelector(".hub-ctl");
    if (!ctl) return;
    const t = (k) => this._t(k);
    const multi = this._hubs.length > 1;
    const hub = this._effectiveHub();
    ctl.classList.toggle("multi", multi);
    const select = ctl.querySelector(".hub-select");
    select.hidden = !multi;
    const opts = multi
      ? [["all", `${t("hubAll")}`], ...this._hubs.map((h) => [h.entry_id, h.title || h.host])]
      : [];
    const html = opts
      .map(([v, label]) => `<option value="${this._escape(v)}"${v === hub ? " selected" : ""}>${this._escape(label)}</option>`)
      .join("");
    setHtml(select, html);
    select.value = hub;
    const gear = ctl.querySelector(".gear-btn");
    const blocked = !this._hubs.length || (multi && hub === "all");
    gear.disabled = blocked;
    const title = blocked && this._hubs.length ? t("settingsNeedHub") : t("settingsBtn");
    gear.title = title;
    gear.setAttribute("aria-label", title);
  }

  // ---------------------------------------------------------------------
  // Einstellungen eines Hubs: dieselben Options wie der Optionsdialog von
  // Home Assistant (unifi_dynamic/get_options, set_options). Gespeichert
  // wird erst mit "Speichern"; der Entwurf lebt nur im Dialog.
  // ---------------------------------------------------------------------

  async _openSettings(entryId) {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    this._settings = {
      entryId,
      // Gemeinsamer Takt der Loader-Vorschauen (siehe _syncLoaders).
      openedAt: Date.now(),
      loading: true,
      error: null,
      saveError: null,
      saving: false,
      data: null,
      draft: null,
      open: new Set(),
      info: new Set(),
    };
    this._renderSettings();
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    this._loadVersion(false);
    try {
      const data = await this._hass.callWS({ type: "unifi_dynamic/get_options", entry_id: entryId });
      if (!this._settings || this._settings.entryId !== entryId) return;
      this._settings.data = data;
      this._settings.draft = JSON.parse(JSON.stringify(data.values));
      this._applyPanelSettings(data.panel);
      // Loader (pro Benutzer) und Vorabversionen (Instanz) gelten wie alles
      // andere erst mit "Speichern".
      this._settings.extraBase = { loader: this._loader, prerelease: Boolean(this._prerelease) };
      this._settings.extra = { ...this._settings.extraBase };
    } catch (err) {
      if (!this._settings) return;
      this._settings.error = (err && err.message) || String(err);
    }
    this._settings.loading = false;
    this._renderSettings();
  }

  _closeSettings() {
    this._closeStat();
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    this._settings = null;
    if (dialog && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }

  // Geänderte Schlüssel gegenüber dem geladenen Stand: Hub-Optionen plus
  // Loader und Vorabversionen (st.extra).
  _settingsChanges() {
    const st = this._settings;
    if (!st || !st.draft) return [];
    return [...this._settingsEntryChanges(), ...this._settingsExtraChanges()];
  }

  _settingsEntryChanges() {
    const st = this._settings;
    if (!st || !st.draft) return [];
    return Object.keys(st.draft).filter(
      (k) => JSON.stringify(st.draft[k]) !== JSON.stringify(st.data.values[k])
    );
  }

  _settingsExtraChanges() {
    const st = this._settings;
    if (!st || !st.extra) return [];
    return Object.keys(st.extra).filter((k) => st.extra[k] !== st.extraBase[k]);
  }

  // Gemeinsame Panel-Einstellungen der Instanz (get_options, version).
  _applyPanelSettings(panel) {
    if (!panel) return;
    this._prerelease = panel.prerelease === true;
    this._prereleaseHacs = panel.prerelease_hacs || null;
  }

  // Fehlermeldung je Feld, leer wenn gültig.
  _settingsErrors() {
    const st = this._settings;
    const errors = {};
    if (!st || !st.draft) return errors;
    const limits = st.data.limits || {};
    for (const key of ["scan_interval", "offline_after_failures", "purge_days", "ping_interval"]) {
      if (!(key in st.draft) || (key === "ping_interval" && !st.draft.ping_enabled)) continue;
      const v = st.draft[key];
      const [min, max] = limits[key] || [0, Infinity];
      if (!Number.isInteger(v) || v < min || v > max) errors[key] = this._t("settingsRange")(min, max);
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(st.draft.purge_time || ""))) {
      errors.purge_time = this._t("settingsTimeError");
    }
    return errors;
  }

  _settingsSections() {
    return [
      ["polling", ["scan_interval", "offline_after_failures"]],
      ["cleanup", ["purge_days", "purge_time", "purge_exclude"]],
      [
        "push",
        [
          "notify_service",
          "notify_click_target",
          "notify_new_clients",
          "notify_controller_offline",
          "notify_when_empty",
          "message_name",
          "message_connection",
          "message_ssid",
          "message_access_point",
          "message_ip",
          "message_mac",
        ],
      ],
      ["persistent", ["persistent_notification", "persistent_when_empty", "persistent_controller_offline"]],
      ["updates", ["update_check"]],
      ["ping", ["ping_enabled", "ping_interval"]],
    ].filter(([id, keys]) => {
      // Fehlt die Option (älteres Backend), Abschnitt ausblenden.
      if (id !== "updates" && id !== "ping") return true;
      return !this._settings || !this._settings.draft || keys[0] in this._settings.draft;
    });
  }

  _settingsSummary(id, d) {
    const t = (k) => this._t(k);
    const hhmm = String(d.purge_time || "").slice(0, 5);
    if (id === "polling") return t("sumPolling")(d.scan_interval, d.offline_after_failures);
    if (id === "cleanup") return t("sumCleanup")(d.purge_days, hhmm);
    if (id === "push") {
      if (!d.notify_service || d.notify_service === "none") return t("sumPushOff");
      const target = (this._settings.data.notify_targets || []).find((o) => o.value === d.notify_service);
      const parts = [
        d.notify_new_clients && t("sumNew"),
        d.notify_controller_offline && t("sumController"),
        d.notify_when_empty && t("sumEmpty"),
      ].filter(Boolean);
      return [target ? target.label : d.notify_service, parts.join(", ")].filter(Boolean).join(" · ");
    }
    if (id === "updates") return t(d.update_check ? "sumUpdatesOn" : "sumUpdatesOff");
    if (id === "ping") {
      if (!d.ping_enabled) return t("sumPingOff");
      const status = this._settings.data.ping_status;
      // Eingeschaltet, aber Messung nicht möglich: das zählt mehr als das Intervall.
      if (status === "permission" || status === "unavailable") return t("sumPingBlocked");
      return t("sumPingOn")(d.ping_interval);
    }
    if (!d.persistent_notification && !d.persistent_controller_offline) return t("sumPersistentOff");
    return [
      d.persistent_notification && t("sumReport"),
      d.persistent_controller_offline && t("sumController"),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  _renderSettings() {
    const dialog = this.shadowRoot && this.shadowRoot.querySelector("dialog.settings");
    const st = this._settings;
    if (!dialog || !st) return;
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const hub = (st.data && st.data.hub) || this._hubs.find((h) => h.entry_id === st.entryId) || {};
    const head = `<div class="dlg-head">
        <span class="dlg-avatar">${icon("gear")}</span>
        <div class="dlg-title"><h2>${esc(t("settingsTitle"))}</h2><div class="dlg-sub">${esc(
          [hub.title, hub.host].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ")
        )}</div></div>
        <button class="dlg-close" data-set="close" title="${esc(t("dialogClose"))}" aria-label="${esc(
          t("dialogClose")
        )}">${icon("close")}</button>
      </div>`;
    // Von _settingsBodyHtml gefüllt: Inhalt der Teilbereiche (siehe unten).
    this._settingsSlots = {};
    let body;
    if (st.loading) body = `<p class="dlg-note">${esc(t("settingsLoading"))}</p>`;
    else if (st.error) body = `<div class="dlg-error">${esc(t("settingsLoadError"))} ${esc(st.error)}</div>`;
    else body = this._settingsBodyHtml();
    const changes = this._settingsChanges();
    const errors = this._settingsErrors();
    const canSave = !st.loading && !st.error && !st.saving && changes.length > 0 && !Object.keys(errors).length;
    const actions = `<div class="dlg-actions">
        <span class="set-count">${changes.length ? esc(t("settingsChanges")(changes.length)) : ""}</span>
        <button class="dlg-btn" data-set="close">${esc(t("settingsCancel"))}</button>
        <button class="dlg-btn primary" data-set="save" title="${esc(t("settingsSaveHint"))}" ${canSave ? "" : "disabled"}>${esc(
          st.saving ? t("settingsSaving") : t("settingsSave")
        )}</button>
      </div>`;
    const scroll = dialog.scrollTop;
    const active = this.shadowRoot.activeElement;
    const focusKey = active && active.dataset ? active.dataset.opt || active.dataset.set : null;
    dialog.innerHTML = `${head}<div class="dlg-body">${body}</div>${actions}`;
    // Die Teilbereiche wurden eben mit aufgebaut: als aktuell vermerken, sonst
    // ersetzte sie das nächste Teil-Update einmal grundlos (siehe setHtml).
    const verSlot = dialog.querySelector(".ver-slot");
    const availSlot = dialog.querySelector(".avail-slot");
    if (verSlot && this._settingsSlots.ver !== undefined) _lastHtml.set(verSlot, this._settingsSlots.ver);
    if (availSlot && this._settingsSlots.avail !== undefined) _lastHtml.set(availSlot, this._settingsSlots.avail);
    this._syncLoaders(dialog);
    dialog.scrollTop = scroll;
    if (focusKey) {
      const el = dialog.querySelector(`[data-opt="${focusKey}"], [data-set="${focusKey}"]`);
      if (el) el.focus();
    }
  }

  _settingsBodyHtml() {
    const st = this._settings;
    const d = st.draft;
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const changes = new Set(this._settingsChanges());
    const errors = this._settingsErrors();
    const infoBtn = (key) =>
      `<button type="button" class="info-btn${st.info.has(key) ? " on" : ""}" data-set="info" data-key="${key}" title="${esc(
        t("settingsInfo")
      )}" aria-label="${esc(t("settingsInfo"))}" aria-expanded="${st.info.has(key)}">${icon("info")}</button>`;
    const infoText = (key, text) => (st.info.has(key) ? `<div class="opt-info">${esc(text)}</div>` : "");
    // Feldzeile: Beschriftung (+ ⓘ), Eingabe, Kurzzeile, aufklappbarer Text.
    const row = (key, label, control, short, info) => `<div class="opt${changes.has(key) ? " changed" : ""}${
        errors[key] ? " invalid" : ""
      }">
        <div class="opt-line"><span class="opt-label">${esc(label)}${info ? infoBtn(key) : ""}</span>${control}</div>
        ${errors[key] ? `<div class="opt-error">${esc(errors[key])}</div>` : short ? `<div class="opt-short">${esc(short)}</div>` : ""}
        ${info ? infoText(key, info) : ""}
      </div>`;
    const num = (key, unit) => `<span class="opt-input"><input type="number" inputmode="numeric" data-opt="${key}" value="${esc(
        d[key]
      )}" /><span class="unit">${esc(unit)}</span></span>`;
    const sw = (key) => `<label class="switch"><input type="checkbox" data-opt="${key}" ${d[key] ? "checked" : ""} /><span></span></label>`;
    const select = (key, options) => `<span class="opt-select"><select data-opt="${key}">${options
        .map(([v, label]) => `<option value="${esc(v)}"${v === d[key] ? " selected" : ""}>${esc(label)}</option>`)
        .join("")}</select>${icon("chevron")}</span>`;

    const dur = this._formatDuration((d.scan_interval || 0) * (d.offline_after_failures || 0) * 1000);
    const targets = (st.data.notify_targets || []).map((o) => [
      o.value,
      o.value === "none" ? t("optNotifyNone") : o.missing ? `${o.label} (${t("optNotifyMissing")})` : o.label,
    ]);
    const protectedMacs = d.purge_exclude || [];
    const known = new Map((st.data.protected || []).map((p) => [p.mac, p.name]));
    const chips = protectedMacs.length
      ? `<div class="opt-chips">${protectedMacs
          .map((mac) => {
            const name = known.get(mac) || this._allClients.find((c) => c.mac === mac)?.name;
            return `<span class="opt-chip">${esc(name || t("optProtectedUnknown"))}<small>${esc(mac)}</small><button type="button" data-set="unprotect" data-mac="${esc(
              mac
            )}" title="${esc(t("optUnprotect")(name || mac))}" aria-label="${esc(t("optUnprotect")(name || mac))}">${icon(
              "close"
            )}</button></span>`;
          })
          .join("")}</div>`
      : `<div class="opt-short">${esc(t("optProtectedNone"))}</div>`;

    const fields = {
      polling:
        row("scan_interval", t("optScanInterval"), num("scan_interval", t("unitSeconds")), t("optScanIntervalShort"), t("optScanIntervalInfo")) +
        row(
          "offline_after_failures",
          t("optOfflineAfter"),
          num("offline_after_failures", t("unitPolls")),
          t("optOfflineAfterLive")(d.scan_interval, dur),
          t("optOfflineAfterInfo")
        ),
      cleanup:
        row("purge_days", t("optPurgeDays"), num("purge_days", t("unitDays")), t("optPurgeDaysShort"), t("optPurgeDaysInfo")) +
        row(
          "purge_time",
          t("optPurgeTime"),
          `<span class="opt-input"><input type="time" data-opt="purge_time" value="${esc(String(d.purge_time || "").slice(0, 5))}" /></span>`,
          t("optPurgeTimeShort"),
          t("optPurgeTimeInfo")
        ) +
        `<div class="opt${changes.has("purge_exclude") ? " changed" : ""}">
          <div class="opt-line"><span class="opt-label">${esc(t("optProtected"))}${infoBtn("purge_exclude")}</span><span class="opt-count">${
            protectedMacs.length
          }</span></div>
          <div class="opt-short">${esc(t("optProtectedShort"))}</div>
          ${infoText("purge_exclude", t("optProtectedInfo"))}
          ${chips}
        </div>`,
      push:
        row("notify_service", t("optNotifyService"), select("notify_service", targets), t("optNotifyServiceShort"), t("optNotifyServiceInfo")) +
        row(
          "notify_click_target",
          t("optClickTarget"),
          select("notify_click_target", [
            ["panel", t("optClickPanel")],
            ["device", t("optClickDevice")],
          ]),
          t("optClickTargetShort"),
          t("optClickTargetInfo")
        ) +
        row("notify_new_clients", t("optNotifyNew"), sw("notify_new_clients"), t("optNotifyNewShort"), t("optNotifyNewInfo")) +
        row("notify_controller_offline", t("optNotifyController"), sw("notify_controller_offline"), t("optNotifyControllerShort"), t("optNotifyControllerInfo")) +
        row("notify_when_empty", t("optNotifyEmpty"), sw("notify_when_empty"), t("optNotifyEmptyShort"), null) +
        `<div class="opt">
          <div class="opt-line"><span class="opt-label">${esc(t("optContent"))}${infoBtn("content")}</span></div>
          <div class="opt-short">${esc(t("optContentShort"))}</div>
          ${infoText("content", t("optContentInfo"))}
          <div class="opt-grid">${[
            ["message_name", "msgName"],
            ["message_connection", "msgConnection"],
            ["message_ssid", "msgSsid"],
            ["message_access_point", "msgAp"],
            ["message_ip", "msgIp"],
            ["message_mac", "msgMac"],
          ]
            .map(
              ([key, label]) =>
                `<div class="opt-line sub${changes.has(key) ? " changed" : ""}"><span>${esc(t(label))}</span>${sw(key)}</div>`
            )
            .join("")}</div>
        </div>`,
      persistent:
        row("persistent_notification", t("optPersistent"), sw("persistent_notification"), t("optPersistentShort"), t("optPersistentInfo")) +
        row("persistent_when_empty", t("optPersistentEmpty"), sw("persistent_when_empty"), t("optPersistentEmptyShort"), t("optPersistentEmptyInfo")) +
        row(
          "persistent_controller_offline",
          t("optPersistentController"),
          sw("persistent_controller_offline"),
          t("optPersistentControllerShort"),
          t("optPersistentControllerInfo")
        ),
      // Fehlt die Option (älteres Backend), blendet _settingsSections den
      // Abschnitt aus.
      updates: row("update_check", t("optUpdateCheck"), sw("update_check"), t("optUpdateCheckShort"), t("optUpdateCheckInfo")),
      ping:
        (st.data.ping_status === "permission" || st.data.ping_status === "unavailable"
          ? `<div class="set-note ping-note">${esc(t(st.data.ping_status === "permission" ? "pingPermission" : "pingUnavailable"))}</div>`
          : "") +
        row("ping_enabled", t("optPingEnabled"), sw("ping_enabled"), t("optPingEnabledShort"), t("optPingEnabledInfo")) +
        (d.ping_enabled
          ? row("ping_interval", t("optPingInterval"), num("ping_interval", t("unitSeconds")), t("optPingIntervalShort"), null)
          : ""),
    };
    const titles = {
      polling: "secPolling",
      cleanup: "secCleanup",
      push: "secPush",
      persistent: "secPersistent",
      updates: "secUpdates",
      ping: "secPing",
    };
    const reload = ["scan_interval", "purge_time", "ping_enabled", "ping_interval"].some((k) => changes.has(k));
    return (
      this._connBannerHtml() +
      `<div class="ver-slot">${(this._settingsSlots.ver = this._versionHtml())}</div>` +
      `<div class="avail-slot">${(this._settingsSlots.avail = this._settingsAvailHtml())}</div>` +
      this._settingsSections()
        .map(([id, keys]) => {
          const open = st.open.has(id);
          const changed = keys.some((k) => changes.has(k));
          return `<section class="set-sec${open ? " open" : ""}">
            <button type="button" class="set-sec-head" data-set="section" data-id="${id}" aria-expanded="${open}">
              <span><span class="set-sec-title">${esc(t(titles[id]))}${
                changed ? `<span class="set-badge">${esc(t("settingsChanged"))}</span>` : ""
              }</span><span class="set-sec-sum">${esc(this._settingsSummary(id, d))}</span></span>
              ${icon("chevron")}
            </button>
            ${open ? `<div class="set-sec-body">${fields[id]}</div>` : ""}
          </section>`;
        })
        .join("") +
      this._loaderSectionHtml() +
      // Verbindung zuunterst: wird nur selten gebraucht.
      this._connSectionHtml() +
      (reload ? `<div class="set-note">${esc(t("settingsReloadNote"))}</div>` : "") +
      (st.saveError ? `<div class="dlg-error">${esc(t("settingsSaveError"))} ${esc(st.saveError)}</div>` : "")
    );
  }

  // ---------------------------------------------------------------------
  // Loader: Benutzereinstellung, gilt sofort (ohne "Speichern") und wird
  // wie die Spaltenauswahl pro Benutzer gespeichert.
  // ---------------------------------------------------------------------

  _loaderSectionHtml() {
    const st = this._settings;
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const names = t("loaderNames");
    const open = st.open.has("loader");
    const draft = st.extra ? st.extra.loader : this._loader;
    const current = LOADER_CHOICES.includes(draft) ? draft : "elephant";
    const changed = Boolean(st.extra && st.extra.loader !== st.extraBase.loader);
    const body = open
      ? `<div class="set-sec-body"><div class="opt-short ld-intro">${esc(t("loaderShort"))}</div><div class="ld-choices">${LOADER_CHOICES.map((k) => {
          const [name, desc] = names[k];
          const on = k === current;
          const preview =
            k === "random"
              ? `<div class="ld-mini ld-dice" aria-hidden="true">${icon("dice")}</div>`
              : `<div class="ld-mini ld-${k}" aria-hidden="true"><div class="ld-mini-in" data-ld-started="${st.openedAt || 0}">${this._loaderTrackHtml(k)}</div></div>`;
          return `<button type="button" class="ld-choice${on ? " on" : ""}" data-set="loader-pick" data-kind="${k}" aria-pressed="${on}" aria-label="${esc(
            t("loaderSelect")(name)
          )}">${preview}<span class="ld-name">${esc(name)}</span><span class="ld-desc">${esc(desc)}</span></button>`;
        }).join("")}</div></div>`
      : "";
    return `<section class="set-sec${open ? " open" : ""}">
        <button type="button" class="set-sec-head" data-set="section" data-id="loader" aria-expanded="${open}">
          <span><span class="set-sec-title">${esc(t("loaderTitle"))}${
            changed ? `<span class="set-badge">${esc(t("settingsChanged"))}</span>` : ""
          }</span><span class="set-sec-sum">${esc(names[current].join(" · "))}</span></span>
          ${icon("chevron")}
        </button>
        ${body}
      </section>`;
  }

  // ---------------------------------------------------------------------
  // Verbindung (Host, API-Key, SSL-Prüfung). Der API-Key kommt nie ins
  // Panel: das Backend meldet nur, ob einer hinterlegt ist. Geändert wird im
  // kleinen Dialog (unifi_dynamic/set_connection), der vor dem Speichern
  // testet.
  // ---------------------------------------------------------------------

  _connInfo() {
    const st = this._settings;
    return (st && st.data && st.data.connection) || null;
  }

  _connBannerHtml() {
    const c = this._connInfo();
    if (!c || c.status !== "auth_failed") return "";
    const esc = (v) => this._escape(v);
    return `<div class="conn-banner" role="alert">
        <span>${icon("alert")}<span>${esc(this._t("connBanner"))}</span></span>
        <button type="button" class="dlg-btn primary" data-set="conn-renew">${esc(this._t("connRenew"))}</button>
      </div>`;
  }

  _connSectionHtml() {
    const c = this._connInfo();
    if (!c) return "";
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const status = { ok: "connOk", auth_failed: "connAuthFailed", offline: "connOffline" }[c.status] || "connOk";
    const line = (label, value) =>
      `<div class="opt"><div class="opt-line"><span class="opt-label">${esc(label)}</span>${value}</div></div>`;
    // Zuklappbar wie die übrigen Abschnitte, standardmässig zu. Bei einem
    // Anmeldefehler bietet das Banner oben den direkten Weg zum Dialog.
    const open = this._settings.open.has("connection");
    const sum = `${c.host} · ${t(status)}`;
    return `<section class="set-sec conn-sec${open ? " open" : ""}">
        <button type="button" class="set-sec-head" data-set="section" data-id="connection" aria-expanded="${open}">
          <span><span class="set-sec-title">${esc(t("secConnection"))}</span><span class="set-sec-sum">${esc(sum)}</span></span>
          ${icon("chevron")}
        </button>
        ${
          open
            ? `<div class="set-sec-body">
          ${line(t("connHost"), `<span class="conn-val">${esc(c.host)}</span>`)}
          ${c.site ? line(t("connSite"), `<span class="conn-val">${esc(c.site_name || c.site)}</span>`) : ""}
          ${line(t("connSsl"), `<span class="conn-val">${esc(c.verify_ssl ? t("connYes") : t("connNo"))}</span>`)}
          ${line(t("connKey"), `<span class="conn-val">${esc(c.has_key ? t("connKeyStored") : t("connKeyMissing"))}</span>`)}
          ${line(t("connStatus"), `<span class="conn-status ${esc(c.status)}">${esc(t(status))}</span>`)}
          <div class="conn-actions"><button type="button" class="dlg-btn" data-set="conn-edit">${esc(t("connEdit"))}</button></div>
        </div>`
            : ""
        }
      </section>`;
  }

  _openConn(renew) {
    const c = this._connInfo();
    const dialog = this.shadowRoot.querySelector("dialog.conn-edit");
    if (!c || !dialog) return;
    this._conn = {
      entryId: this._settings.entryId,
      host: c.host,
      key: "",
      ssl: Boolean(c.verify_ssl),
      // Beim Erneuern ist ein neuer Key Pflicht.
      renew: Boolean(renew),
      busy: false,
      error: null,
    };
    this._renderConn();
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    const focus = dialog.querySelector(renew ? '[data-conn="key"]' : '[data-conn="host"]');
    if (focus) focus.focus();
  }

  _closeConn() {
    const dialog = this.shadowRoot.querySelector("dialog.conn-edit");
    this._conn = null;
    if (dialog && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }

  _connValid() {
    const c = this._conn;
    if (!c) return false;
    if (!c.host.trim()) return false;
    return !(c.renew && !c.key.trim());
  }

  _renderConn() {
    const dialog = this.shadowRoot && this.shadowRoot.querySelector("dialog.conn-edit");
    const c = this._conn;
    if (!dialog || !c) return;
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const err = c.error
      ? `<div class="dlg-error" role="alert">${esc(
          STRINGS.en["connErr_" + c.error] ? t("connErr_" + c.error) : `${t("connErr_other")} ${c.error}`
        )}</div>`
      : "";
    dialog.innerHTML = `<form method="dialog" class="conn-form" novalidate>
        <div class="dlg-head">
          <span class="dlg-avatar">${icon("key")}</span>
          <div class="dlg-title"><h2>${esc(t(c.renew ? "connRenew" : "connDlgTitle"))}</h2></div>
          <button type="button" class="dlg-close" data-conn="close" title="${esc(t("dialogClose"))}" aria-label="${esc(
            t("dialogClose")
          )}">${icon("close")}</button>
        </div>
        <div class="dlg-body">
          <label class="conn-field"><span>${esc(t("connHost"))}</span>
            <input type="text" data-conn="host" autocomplete="off" spellcheck="false" value="${esc(c.host)}" ${c.busy ? "disabled" : ""} /></label>
          <label class="conn-field"><span>${esc(t("connNewKey"))}</span>
            <input type="password" data-conn="key" autocomplete="new-password" spellcheck="false" value="" ${c.busy ? "disabled" : ""} />
            <small>${esc(t(c.renew ? "connNewKeyRequired" : "connNewKeyHint"))}</small></label>
          <div class="opt-line conn-ssl"><span>${esc(t("connSsl"))}</span>
            <label class="switch"><input type="checkbox" data-conn="ssl" ${c.ssl ? "checked" : ""} ${c.busy ? "disabled" : ""} /><span></span></label></div>
          <p class="conn-hint">${esc(t("connHint"))}</p>
          ${err}
        </div>
        <div class="dlg-actions">
          <button type="button" class="dlg-btn" data-conn="close">${esc(t("settingsCancel"))}</button>
          <button type="submit" class="dlg-btn primary" data-conn="save" ${c.busy || !this._connValid() ? "disabled" : ""}>${esc(
            c.busy ? t("connTesting") : t("connTest")
          )}</button>
        </div>
      </form>`;
    // Den Key nie ins HTML schreiben, nur ins Feld setzen.
    const keyInput = dialog.querySelector('[data-conn="key"]');
    if (keyInput) keyInput.value = c.key;
  }

  _bindConn(dialog) {
    dialog.addEventListener("input", (ev) => {
      const c = this._conn;
      const field = ev.target.dataset && ev.target.dataset.conn;
      if (!c || !field) return;
      if (field === "host") c.host = ev.target.value;
      else if (field === "key") c.key = ev.target.value;
      else if (field === "ssl") c.ssl = ev.target.checked;
      c.error = null;
      const save = dialog.querySelector('[data-conn="save"]');
      if (save) save.disabled = c.busy || !this._connValid();
      const err = dialog.querySelector(".dlg-error");
      if (err) err.remove();
    });
    dialog.addEventListener("change", (ev) => {
      if (this._conn && ev.target.dataset && ev.target.dataset.conn === "ssl") this._conn.ssl = ev.target.checked;
    });
    dialog.addEventListener("submit", (ev) => {
      ev.preventDefault();
      this._saveConn();
    });
    dialog.addEventListener("click", (ev) => {
      if (ev.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) {
          if (!(this._conn && this._conn.busy)) this._closeConn();
        }
        return;
      }
      const btn = ev.target.closest('[data-conn="close"]');
      if (btn && !(this._conn && this._conn.busy)) this._closeConn();
    });
    dialog.addEventListener("cancel", (ev) => {
      if (this._conn && this._conn.busy) ev.preventDefault();
    });
    dialog.addEventListener("close", () => {
      if (!dialog.open) this._conn = null;
    });
  }

  async _saveConn() {
    const c = this._conn;
    if (!c || c.busy || !this._connValid()) return;
    c.busy = true;
    c.error = null;
    this._renderConn();
    const msg = { type: "unifi_dynamic/set_connection", entry_id: c.entryId, host: c.host.trim(), verify_ssl: c.ssl };
    if (c.key.trim()) msg.api_key = c.key.trim();
    let error = null;
    try {
      const result = await this._hass.callWS(msg);
      if (!result || !result.ok) error = (result && result.error) || "cannot_connect";
    } catch (err) {
      error = (err && err.message) || String(err);
    }
    if (this._conn !== c) return;
    if (error) {
      c.busy = false;
      c.error = error;
      this._renderConn();
      const focus = this.shadowRoot.querySelector(
        error === "invalid_auth" ? 'dialog.conn-edit [data-conn="key"]' : 'dialog.conn-edit [data-conn="host"]'
      );
      if (focus) focus.focus();
      return;
    }
    c.key = "";
    this._closeConn();
    this._closeSettings();
    this._toast(this._t("connSaved"));
    // Nach dem Reload: Hubs (Titel, Host) und Clients neu holen.
    setTimeout(() => {
      this._fetchClients();
    }, 3000);
  }

  // ---------------------------------------------------------------------
  // Version und Update (oben in den Einstellungen). Die neueste Version
  // kommt von HACS (Update-Entität) und zusätzlich von GitHub
  // (unifi_dynamic/version) - so klappt die Prüfung auch ohne HACS.
  // Installieren geht nur über HACS (update.install).
  // ---------------------------------------------------------------------

  // Update-Entität von HACS für dieses Repository. Erkannt an der Plattform
  // und am Link bzw. Titel, nicht an einer festen Entity-ID.
  _hacsUpdateEntity() {
    const hass = this._hass;
    if (!hass || !hass.entities || !hass.states) return null;
    for (const e of Object.values(hass.entities)) {
      if (!e || e.platform !== "hacs" || !String(e.entity_id).startsWith("update.")) continue;
      const st = hass.states[e.entity_id];
      if (!st) continue;
      const a = st.attributes || {};
      const text = `${a.release_url || ""} ${a.title || ""} ${a.friendly_name || ""} ${e.entity_id}`.toLowerCase();
      if (text.includes("diegofuego871/unifi_dynamic") || text.includes("unifi dynamic clients") || text.includes("unifi_dynamic")) {
        return st;
      }
    }
    return null;
  }

  // Versionsvergleich wie im Backend (update_check.compare_versions):
  // 1.2.10 > 1.2.9, und eine Vorabversion (2.16.0b1) liegt unter der
  // fertigen (2.16.0), aber über der vorherigen (2.15.3).
  _versionKey(v) {
    const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?[-.]?(?:(alpha|beta|pre|rc|a|b)\.?(\d*))?/i.exec(String(v || "").trim());
    if (!m) return [0, 0, 0, 3, 0];
    const rank = { a: 0, alpha: 0, b: 1, beta: 1, pre: 1, rc: 2 };
    return [+m[1], +(m[2] || 0), +(m[3] || 0), m[4] ? rank[m[4].toLowerCase()] : 3, +(m[5] || 0)];
  }

  _cmpVersion(a, b) {
    const x = this._versionKey(a);
    const y = this._versionKey(b);
    for (let i = 0; i < 5; i++) {
      if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
    }
    return 0;
  }

  _isPrerelease(v) {
    return Boolean(v) && this._versionKey(v)[3] < 3;
  }

  // Vorabversion nach Nummer (2.16.0b1) oder weil GitHub genau diese Version
  // als Pre-Release führt - auch ohne Zusatz in der Nummer (Tag v2.15.4 mit
  // Häkchen "Set as a pre-release"). Die stabile Version von GitHub zählt nie.
  _isPreVersion(ver, d) {
    if (!ver) return false;
    if (this._isPrerelease(ver)) return true;
    return Boolean(
      d &&
        d.prerelease &&
        this._cmpVersion(ver, d.prerelease) === 0 &&
        (!d.latest || this._cmpVersion(ver, d.latest) > 0)
    );
  }

  // Schalter "Pre-release" von HACS für dieses Repository: eine Entität am
  // selben HACS-Gerät wie die Update-Entität. Standardmässig deaktiviert;
  // deaktiviert heisst hier: nicht in hass.states.
  _hacsPreReleaseSwitch() {
    const hass = this._hass;
    const upd = this._hacsUpdateEntity();
    if (!hass || !hass.entities || !upd) return null;
    const reg = hass.entities[upd.entity_id];
    const deviceId = reg && reg.device_id;
    if (!deviceId) return null;
    const sw = Object.values(hass.entities).find(
      (e) =>
        e &&
        e.platform === "hacs" &&
        e.device_id === deviceId &&
        String(e.entity_id).startsWith("switch.") &&
        /pre.?release/i.test(`${e.entity_id} ${e.translation_key || ""}`)
    );
    // Deaktivierte Entitäten stehen nicht in hass.entities: dann gilt, was
    // die Entity-Registry geliefert hat (siehe _loadHacsSwitch).
    const regSw = !sw && this._hacsSwitchReg && this._hacsSwitchReg.deviceId === deviceId ? this._hacsSwitchReg : null;
    const entityId = sw ? sw.entity_id : regSw ? regSw.entityId : null;
    const state = entityId ? hass.states[entityId] : null;
    return {
      deviceId,
      entityId,
      on: Boolean(state && state.state === "on"),
      disabled: Boolean(!sw && regSw && regSw.disabled),
    };
  }

  // Schalter "Pre-release" in der Entity-Registry suchen, auch wenn er
  // deaktiviert ist (HACS legt ihn deaktiviert an).
  async _loadHacsSwitch() {
    const upd = this._hacsUpdateEntity();
    const reg = upd && this._hass.entities && this._hass.entities[upd.entity_id];
    if (!reg || !reg.device_id) return;
    try {
      const list = await this._hass.callWS({ type: "config/entity_registry/list" });
      const e = (Array.isArray(list) ? list : []).find(
        (x) =>
          x &&
          x.platform === "hacs" &&
          x.device_id === reg.device_id &&
          String(x.entity_id).startsWith("switch.") &&
          /pre.?release/i.test(`${x.entity_id} ${x.translation_key || ""} ${x.original_name || ""}`)
      );
      this._hacsSwitchReg = e ? { deviceId: reg.device_id, entityId: e.entity_id, disabled: Boolean(e.disabled_by) } : null;
    } catch (err) {
      this._hacsSwitchReg = null;
    }
  }

  // "In HACS freischalten": Entität aktivieren (falls nötig), warten, bis
  // Home Assistant sie nach dem Neuladen von HACS freigibt (etwa 30 s),
  // einschalten und HACS die Versionen neu laden lassen. Nur auf Knopfdruck.
  async _enableHacsPrerelease() {
    const v = (this._version = this._version || {});
    let sw = this._hacsPreReleaseSwitch();
    if (!sw || !sw.entityId) return;
    v.hacsEnabling = true;
    v.hacsError = null;
    this._renderSettingsVersion();
    try {
      if (sw.disabled || !this._hass.states[sw.entityId]) {
        await this._hass.callWS({ type: "config/entity_registry/update", entity_id: sw.entityId, disabled_by: null });
        const until = Date.now() + 90000;
        while (!this._hass.states[sw.entityId] && Date.now() < until) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (!this._hass.states[sw.entityId]) throw new Error(this._t("verPreEnableTimeout"));
        this._hacsSwitchReg = { ...(this._hacsSwitchReg || {}), deviceId: sw.deviceId, entityId: sw.entityId, disabled: false };
      }
      await this._callService("switch", "turn_on", { entity_id: sw.entityId });
      this._prereleaseHacs = sw.entityId;
      await this._hass.callWS({ type: "unifi_dynamic/set_panel", prerelease_hacs: sw.entityId });
      await this._refreshHacs();
    } catch (err) {
      v.hacsError = (err && err.message) || String(err);
    }
    v.hacsEnabling = false;
    this._renderSettingsVersion();
    await this._loadVersion(false);
  }

  // Beim Ausschalten von "Vorabversionen anzeigen": den HACS-Schalter nur
  // zurücksetzen, wenn das Panel ihn selbst eingeschaltet hat.
  async _disableHacsPrerelease() {
    const id = this._prereleaseHacs;
    if (!id) return;
    this._prereleaseHacs = null;
    try {
      await this._hass.callWS({ type: "unifi_dynamic/set_panel", prerelease_hacs: null });
    } catch (err) {
      // Nicht kritisch.
    }
    const st = this._hass.states[id];
    if (st && st.state === "on") {
      try {
        await this._callService("switch", "turn_off", { entity_id: id });
        await this._refreshHacs();
      } catch (err) {
        // Nicht kritisch: der Schalter bleibt dann in HACS an.
      }
    }
  }

  async _loadVersion(force = false) {
    this._version = this._version || {};
    const v = this._version;
    if (force) {
      v.checking = true;
      // Neue Prüfung: alte Meldungen verwerfen, der neue Stand zählt.
      v.installError = null;
    }
    v.error = null;
    this._renderSettingsVersion();
    const jobs = [
      // Vorabversion immer mitabfragen (vom Backend zwischengespeichert):
      // auch bei ausgeschaltetem Schalter muss das Panel wissen, welche
      // Version GitHub als Pre-Release führt, damit es eine solche von HACS
      // gemeldete Version nicht als stabil anbietet. Angezeigt wird sie
      // nur mit eingeschaltetem Schalter (_versionState).
      this._hass.callWS({ type: "unifi_dynamic/version", force, prerelease: true }).then(
        (r) => {
          v.data = r;
          if (!this._settings || !this._settings.extra) this._applyPanelSettings(r && r.panel);
        },
        (err) => (v.error = (err && err.message) || String(err))
      ),
    ];
    // HACS prüft sonst nur alle paar Tage: auf Knopfdruck sofort neu laden.
    if (force) jobs.push(this._refreshHacs());
    await Promise.all(jobs);
    // GitHub kennt eine neuere Version als HACS: HACS einmal pro Sitzung
    // auch ohne Knopfdruck nachladen lassen, sonst lässt es sich nicht
    // über HACS installieren.
    const { hacs, a, latest } = this._versionState();
    if (!force && hacs && !v.hacsRefreshed && latest && (!a.latest_version || this._cmpVersion(latest, a.latest_version) > 0)) {
      v.hacsRefreshed = true;
      // Während HACS nachlädt, nicht zum Klick auf "Nach Updates suchen"
      // auffordern: das Panel erledigt genau das gerade selbst.
      v.hacsSyncing = true;
      this._renderSettingsVersion();
      await this._refreshHacs();
      // Der neue Stand der Update-Entität kommt als Zustandsänderung etwas
      // nach dem Dienstaufruf: kurz darauf warten, höchstens 4 Sekunden.
      const until = Date.now() + 4000;
      while (Date.now() < until) {
        const now = this._versionState().a;
        if (now.latest_version && this._cmpVersion(now.latest_version, latest) >= 0) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      v.hacsSyncing = false;
    }
    v.checking = false;
    if (v.data && v.data.error && !v.data.latest) v.error = v.data.error;
    if (this._versionState().betaBlocked) await this._loadHacsSwitch();
    this._renderSettingsVersion();
  }

  // Dienst über WebSocket statt hass.callService: der zeigt bei einem Fehler
  // zusätzlich eine eigene Toast-Meldung, hier steht der Fehler in der Zeile.
  _callService(domain, service, data) {
    return this._hass.callWS({ type: "call_service", domain, service, service_data: data });
  }

  // HACS die Versionen des Repositories neu laden lassen (seine eigenen
  // WebSocket-Befehle, wie der Menüpunkt "Informationen aktualisieren"),
  // dann die Update-Entität. Alles bestmöglich: fehlt ein Befehl in einer
  // HACS-Version, bleibt es beim Aktualisieren der Entität.
  async _refreshHacs() {
    const hacs = this._hacsUpdateEntity();
    if (!hacs) return;
    try {
      const repos = await this._hass.callWS({ type: "hacs/repositories/list" });
      const list = Array.isArray(repos) ? repos : (repos && repos.repositories) || [];
      const repo = list.find((r) => String(r.full_name || "").toLowerCase() === "diegofuego871/unifi_dynamic");
      if (repo) await this._hass.callWS({ type: "hacs/repository/refresh", repository: String(repo.id) });
    } catch (err) {
      // Älteres oder neueres HACS ohne diese Befehle.
    }
    try {
      await this._callService("homeassistant", "update_entity", { entity_id: hacs.entity_id });
    } catch (err) {
      // Nicht kritisch: dann gilt der bisherige Stand von HACS.
    }
  }

  _versionState() {
    const v = this._version || {};
    const d = v.data || {};
    const hacs = this._hacsUpdateEntity();
    const a = (hacs && hacs.attributes) || {};
    const installed = d.installed || a.installed_version || null;
    let latest = d.latest || null;
    let url = d.release_url || null;
    // Vorabversion nur auf Wunsch und nur, wenn sie neuer ist.
    if (this._prerelease && d.prerelease && (!latest || this._cmpVersion(d.prerelease, latest) > 0)) {
      latest = d.prerelease;
      url = d.prerelease_url || url;
    }
    // HACS kennt eine Vorabversion nur mit eingeschaltetem "Pre-release";
    // ohne unseren Schalter keine Vorabversion von HACS übernehmen.
    if (
      a.latest_version &&
      (!latest || this._cmpVersion(a.latest_version, latest) >= 0) &&
      (this._prerelease || !this._isPreVersion(a.latest_version, d))
    ) {
      latest = a.latest_version;
      url = a.release_url || url;
    }
    const beta = this._isPreVersion(latest, d);
    const preSwitch = beta && hacs ? this._hacsPreReleaseSwitch() : null;
    const inProgress = Boolean(hacs && (a.in_progress === true || typeof a.in_progress === "number"));
    // HACS hat eine neuere Version auf die Platte gelegt, als gerade läuft.
    const restart = Boolean(hacs && a.installed_version && installed && this._cmpVersion(a.installed_version, installed) > 0);
    // Installierbar nur, was HACS selbst als neueste Version kennt: eine
    // Version, die HACS noch nicht geladen hat, lehnt es ab.
    let canInstall = Boolean(hacs && a.latest_version && installed && this._cmpVersion(a.latest_version, installed) > 0);
    // Beta ohne "Pre-release" in HACS: HACS würde die stabile Version
    // installieren (oder gar nichts) - deshalb sperren und erklären.
    const betaBlocked = Boolean(beta && hacs && (!preSwitch || !preSwitch.on));
    if (betaBlocked) canInstall = false;
    return { v, d, hacs, a, installed, latest, url, inProgress, restart, canInstall, beta, betaBlocked, preSwitch };
  }

  _versionHtml() {
    const t = (k) => this._t(k);
    const esc = (x) => this._escape(x);
    const { v, d, hacs, a, installed, latest, url, inProgress, restart, canInstall, beta, betaBlocked, preSwitch } = this._versionState();
    if (!installed && !v.data && !v.error) return "";
    return this._versionRowHtml({ v, d, hacs, a, installed, latest, url, inProgress, restart, canInstall, beta, betaBlocked, preSwitch }) + this._prereleaseOptHtml();
  }

  // Schalter "Vorabversionen anzeigen" unter dem Versionskasten (pro Benutzer).
  _prereleaseOptHtml() {
    const t = (k) => this._t(k);
    const esc = (x) => this._escape(x);
    const st = this._settings;
    const on = st && st.extra ? Boolean(st.extra.prerelease) : Boolean(this._prerelease);
    const changed = st && st.extra && st.extra.prerelease !== st.extraBase.prerelease;
    return `<div class="ver-opt">
        <div><div class="ver-opt-l">${esc(t("verPreToggle"))}${changed ? `<span class="set-badge">${esc(t("settingsChanged"))}</span>` : ""}</div><div class="ver-opt-d">${esc(t("verPreToggleShort"))}</div></div>
        <button type="button" class="sw-btn beta${on ? " on" : ""}" role="switch" aria-checked="${on}" data-ver="prerelease" aria-label="${esc(
          t("verPreToggle")
        )}"><span></span></button>
      </div>`;
  }

  _versionRowHtml({ v, d, hacs, a, installed, latest, url, inProgress, restart, canInstall, beta, betaBlocked, preSwitch }) {
    const t = (k) => this._t(k);
    const esc = (x) => this._escape(x);
    const row = (cls, iconName, title, sub, right) => `<div class="ver ${cls}">
        <span class="ver-ic">${icon(iconName)}</span>
        <div class="ver-t"><b>${esc(title)}</b><small>${esc(sub)}</small></div>
        ${right ? `<div class="ver-btns">${right}</div>` : ""}
      </div>`;
    const notes = url
      ? `<a class="ver-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(t("verReleaseNotes"))}${icon("open")}</a>`
      : "";
    if (v.restarting) return row("rst", "reset", t("verRestarting"), t("verRestartSub"), "");
    if (restart) {
      return row(
        "rst",
        "reset",
        t("verRestartNeeded")(a.installed_version),
        t("verRestartSub"),
        `<button type="button" class="ver-btn warn" data-ver="restart">${icon("reset")}${esc(t("verRestart"))}</button>`
      );
    }
    if (inProgress || v.installing) {
      return `<div class="ver upd">
          <span class="ver-ic">${icon("verUp")}</span>
          <div class="ver-t"><b>${esc(t("verInstalling")(v.installing || latest))}</b><small>${esc(t("verInstallingSub"))}</small></div>
          <div class="ver-prog"><i></i></div>
        </div>`;
    }
    if (latest && installed && this._cmpVersion(latest, installed) > 0) {
      const sub = v.installError
        ? `${t("verInstallError")} ${v.installError}`
        : beta && betaBlocked
        ? `${t("verInstalled")(installed)} · ${t("verPreShort")}`
        : !hacs
        ? `${t("verInstalledVia")(installed, false)} · ${t("verNoHacs")}`
        : canInstall
        ? t("verInstalledVia")(installed, true)
        : v.hacsSyncing
        ? `${t("verInstalledVia")(installed, true)} · ${t("verHacsSyncing")}`
        : `${t("verInstalledVia")(installed, true)} · ${t("verHacsPending")}`;
      // Erneut prüfen geht immer: neben "Aktualisieren" als kompakter
      // Symbolknopf, sonst mit Beschriftung.
      const busy = v.checking || v.hacsSyncing ? `disabled aria-busy="true"` : "";
      const spinOrIcon = v.checking || v.hacsSyncing ? `<span class="ver-spin"></span>` : icon("verCheck");
      const checkBtn = canInstall || betaBlocked
        ? `<button type="button" class="ver-btn icon" data-ver="check" ${busy} title="${esc(t("verCheck"))}" aria-label="${esc(
            t("verCheck")
          )}">${spinOrIcon}</button>`
        : `<button type="button" class="ver-btn" data-ver="check" ${busy}>${spinOrIcon}${esc(t("verCheck"))}</button>`;
      const installBtn = canInstall
        ? `<button type="button" class="ver-btn primary" data-ver="install">${icon("verDownload")}${esc(t("verUpdate"))}</button>`
        : betaBlocked
        ? `<button type="button" class="ver-btn primary" disabled>${icon("verDownload")}${esc(t("verUpdate"))}</button>`
        : "";
      const canEnable = Boolean(preSwitch && preSwitch.entityId);
      const hint = betaBlocked
        ? `<div class="ver-hint">${esc(t(canEnable ? "verPreHintEnable" : "verPreHint"))}${
            v.hacsError ? `<div class="ver-hint-err">${esc(t("verPreEnableError"))} ${esc(v.hacsError)}</div>` : ""
          }<div class="ver-hint-acts">${
            canEnable
              ? `<button type="button" class="ver-btn" data-ver="hacs-enable" ${v.hacsEnabling ? 'disabled aria-busy="true"' : ""}>${
                  v.hacsEnabling ? `<span class="ver-spin"></span>${esc(t("verPreEnabling"))}` : `${icon("flask")}${esc(t("verPreEnable"))}`
                }</button>`
              : ""
          }${
            preSwitch && preSwitch.deviceId
              ? `<button type="button" class="ver-hint-link" data-ver="hacs-device" data-device-id="${esc(preSwitch.deviceId)}">${esc(
                  t("verPreHintLink")
                )}</button>`
              : ""
          }</div></div>`
        : "";
      const html = row(beta ? "upd beta" : "upd", beta ? "flask" : "verUp", t("verAvailable")(latest), sub, `${notes}${checkBtn}${installBtn}`);
      // Etikett "Beta" in den Titel, Hinweis in den Kasten.
      return beta
        ? html.replace("</b>", ` <span class="ver-tag">${esc(t("verBeta"))}</span></b>`).replace(/<\/div>\s*$/, `${hint}</div>`)
        : html;
    }
    const checked = d.checked_at ? t("verChecked")(this._formatRelative(d.checked_at)) : "";
    const sub = v.checking
      ? t("verCheckingSub")
      : v.error
      ? `${t("verCheckError")} ${v.error}`
      : [t("verCurrent"), checked].filter(Boolean).join(" · ");
    return row(
      "ok",
      "verOk",
      t("verName")(installed || "?"),
      sub,
      // Beschriftung bleibt während der Prüfung gleich, nur das Symbol wird
      // zum Spinner: so ändert sich die Breite nicht, und die Zeile bricht
      // nicht anders um (sonst springt die Höhe des Blatts auf dem Handy).
      `<button type="button" class="ver-btn" data-ver="check" ${v.checking ? `disabled aria-busy="true" title="${esc(t("verChecking"))}"` : ""}>${
        v.checking ? `<span class="ver-spin"></span>` : icon("verCheck")
      }${esc(t("verCheck"))}</button>`
    );
  }

  _renderSettingsVersion() {
    const slot = this.shadowRoot && this.shadowRoot.querySelector("dialog.settings .ver-slot");
    if (!slot) return;
    setHtml(slot, this._versionHtml());
  }

  async _versionAction(action) {
    const v = (this._version = this._version || {});
    if (action === "prerelease") {
      // Nur Entwurf: gilt nach "Speichern" für die ganze Instanz.
      const st = this._settings;
      if (!st || !st.extra) return;
      st.extra.prerelease = !st.extra.prerelease;
      this._renderSettings();
    } else if (action === "hacs-enable") {
      await this._enableHacsPrerelease();
    } else if (action === "hacs-device") {
      const sw = this._hacsPreReleaseSwitch();
      if (sw && sw.deviceId) {
        this._closeSettings();
        this._navigate(`/config/devices/device/${sw.deviceId}`, false);
      }
    } else if (action === "check") {
      await this._loadVersion(true);
    } else if (action === "install") {
      const { hacs, a, canInstall } = this._versionState();
      if (!hacs || !canInstall || v.installing) return;
      // Ohne Versionsangabe: HACS installiert seine neueste bekannte Version.
      v.installing = a.latest_version;
      v.installError = null;
      this._renderSettingsVersion();
      try {
        await this._callService("update", "install", { entity_id: hacs.entity_id });
      } catch (err) {
        v.installError = (err && err.message) || String(err);
      }
      v.installing = null;
      this._renderSettingsVersion();
    } else if (action === "restart") {
      if (!window.confirm(this._t("verRestartConfirm"))) return;
      v.restarting = true;
      this._renderSettingsVersion();
      try {
        await this._callService("homeassistant", "restart", {});
      } catch (err) {
        // Die Verbindung bricht beim Neustart ab; ein Fehler hier ist normal.
      }
    }
  }

  // Zeitstrahl des Controllers oben im Einstellungsdialog.
  _settingsAvailSrc() {
    const st = this._settings;
    if (!st || !st.data) return null;
    return {
      id: `controller:${st.entryId}`,
      entryId: st.entryId,
      mac: "controller",
      entityId: st.data.controller_entity_id || null,
      controller: true,
    };
  }

  // Controller-Verfügbarkeit als Kachel (Wert der letzten 24 Stunden),
  // Details im Unter-Fenster. Daneben der Verbindungsstatus.
  _settingsAvailHtml() {
    const st = this._settings;
    if (!st || !st.data) return "";
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const tiles = [this._availTile(st.data.controller_avail, "ctl", "data-set", t("tileAvail"))];
    const c = st.data.connection;
    if (c) {
      const status = { ok: "connOk", auth_failed: "connAuthFailed", offline: "connOffline" }[c.status] || "connOk";
      tiles.push(`<div class="st-tile static"><span class="st-k">${esc(t("connStatus"))}</span>
          <span class="st-v"><span class="conn-status ${esc(c.status)}">${esc(t(status))}</span></span>
          <span class="st-sub">${esc(c.host)}</span></div>`);
    }
    return `<h3>${esc(t("statCtlTitle"))}</h3><div class="st-tiles n${tiles.length}">${tiles.join("")}</div>`;
  }

  // Nur den Zeitstrahl ersetzen (Verlauf nachgeladen, Zeitraum gewechselt):
  // Eingaben und Aufklappzustand im Rest des Dialogs bleiben unberührt.
  _renderSettingsAvail() {
    this._renderStat();
    const slot = this.shadowRoot && this.shadowRoot.querySelector("dialog.settings .avail-slot");
    if (!slot) return;
    if (setHtml(slot, this._settingsAvailHtml())) this._syncLoaders(slot);
  }

  _bindSettings(dialog) {
    // Tooltip über Unterbrüchen, wie in der Geräteansicht.
    dialog.addEventListener("pointerover", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const seg = ev.target.closest && ev.target.closest(".avail-bar .seg");
      if (seg) this._showAvailTip(seg.classList.contains("off") ? seg : null);
    });
    dialog.addEventListener("pointerout", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const bar = ev.target.closest && ev.target.closest(".avail-bar");
      if (bar && !(ev.relatedTarget && bar.contains(ev.relatedTarget))) this._showAvailTip(null);
    });
    dialog.addEventListener("click", (ev) => {
      const seg = ev.target.closest(".avail-bar .seg");
      if (seg) {
        if (ev.pointerType !== "mouse") {
          this._showAvailTip(seg.classList.contains("off") && !seg.classList.contains("hover") ? seg : null);
        }
        return;
      }
      if (!ev.target.closest(".avail-tip")) this._showAvailTip(null);
      const verBtn = ev.target.closest("[data-ver]");
      if (verBtn) {
        if (!verBtn.disabled) this._versionAction(verBtn.dataset.ver);
        return;
      }
      const range = ev.target.closest('[data-dlg="avail-range"]');
      if (range) {
        if (range.dataset.range !== this._availRange) {
          this._availRange = range.dataset.range;
          this._savePrefs();
          this._renderSettingsAvail();
        }
        return;
      }
      if (ev.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) {
          this._closeSettings();
        }
        return;
      }
      const btn = ev.target.closest("[data-set]");
      if (!btn || btn.disabled || !this._settings) return;
      const st = this._settings;
      const action = btn.dataset.set;
      if (action === "close") this._closeSettings();
      else if (action === "section") {
        const id = btn.dataset.id;
        if (st.open.has(id)) st.open.delete(id);
        else st.open.add(id);
        this._renderSettings();
      } else if (action === "info") {
        const key = btn.dataset.key;
        if (st.info.has(key)) st.info.delete(key);
        else st.info.add(key);
        this._renderSettings();
      } else if (action === "unprotect") {
        st.draft.purge_exclude = st.draft.purge_exclude.filter((m) => m !== btn.dataset.mac);
        this._renderSettings();
      } else if (action === "save") this._saveSettings();
      else if (action === "stat") this._openStat(btn.dataset.kind);
      else if (action === "loader-pick") {
        if (st.extra && LOADER_CHOICES.includes(btn.dataset.kind) && btn.dataset.kind !== st.extra.loader) {
          st.extra.loader = btn.dataset.kind;
          this._renderSettings();
        }
      } else if (action === "conn-edit") this._openConn(false);
      else if (action === "conn-renew") this._openConn(true);
    });
    // Zahlen und Uhrzeit: Entwurf beim Tippen nachführen, aber nur die
    // Anzeige drumherum neu aufbauen, wenn das Feld den Fokus verliert -
    // sonst sprünge der Cursor bei jedem Tastendruck.
    dialog.addEventListener("input", (ev) => {
      const key = ev.target.dataset && ev.target.dataset.opt;
      if (!key || !this._settings || !this._settings.draft) return;
      const el = ev.target;
      if (el.type === "number") this._settings.draft[key] = el.value === "" ? null : Number(el.value);
      else if (el.type === "time") this._settings.draft[key] = el.value ? `${el.value}:00` : "";
      else return;
      this._updateSettingsMeta();
    });
    dialog.addEventListener("change", (ev) => {
      const key = ev.target.dataset && ev.target.dataset.opt;
      if (!key || !this._settings || !this._settings.draft) return;
      const el = ev.target;
      // Zahlen und Uhrzeit laufen über "input"; ihr "change" kommt erst beim
      // Verlassen des Felds - ein Neuaufbau dann würde den Klick verschlucken,
      // der den Fokus wegnimmt (z.B. auf "Speichern").
      if (el.type === "checkbox") this._settings.draft[key] = el.checked;
      else if (el.tagName === "SELECT") this._settings.draft[key] = el.value;
      else return;
      this._renderSettings();
    });
    dialog.addEventListener("close", () => {
      if (!dialog.open) this._settings = null;
    });
  }

  // Leichte Aktualisierung während der Eingabe: Zähler, Speichern-Knopf,
  // Markierung und Fehlertext des Felds.
  _updateSettingsMeta() {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    const st = this._settings;
    if (!dialog || !st) return;
    const changes = this._settingsChanges();
    const errors = this._settingsErrors();
    dialog.querySelector(".set-count").textContent = changes.length ? this._t("settingsChanges")(changes.length) : "";
    const save = dialog.querySelector('[data-set="save"]');
    save.disabled = st.saving || !changes.length || Object.keys(errors).length > 0;
    for (const input of dialog.querySelectorAll("input[data-opt]")) {
      const opt = input.closest(".opt");
      if (!opt || input.type === "checkbox") continue;
      const key = input.dataset.opt;
      opt.classList.toggle("changed", changes.includes(key));
      opt.classList.toggle("invalid", Boolean(errors[key]));
    }
    // Zusammenfassungen, Etiketten, Live-Text und Hinweis direkt anpassen,
    // ohne Neuaufbau (Fokus und Klicks bleiben erhalten).
    const d = st.draft;
    for (const [id, keys] of this._settingsSections()) {
      const head = dialog.querySelector(`[data-set="section"][data-id="${id}"]`);
      if (!head) continue;
      head.querySelector(".set-sec-sum").textContent = this._settingsSummary(id, d);
      const title = head.querySelector(".set-sec-title");
      let badge = title.querySelector(".set-badge");
      const changed = keys.some((k) => changes.includes(k));
      if (changed && !badge) {
        badge = document.createElement("span");
        badge.className = "set-badge";
        badge.textContent = this._t("settingsChanged");
        title.appendChild(badge);
      } else if (!changed && badge) badge.remove();
    }
    for (const key of ["scan_interval", "offline_after_failures", "purge_days", "purge_time", "ping_interval"]) {
      const input = dialog.querySelector(`input[data-opt="${key}"]`);
      const opt = input && input.closest(".opt");
      if (!opt) continue;
      let line = opt.querySelector(".opt-short, .opt-error");
      const text = errors[key]
        ? errors[key]
        : key === "offline_after_failures"
        ? this._t("optOfflineAfterLive")(d.scan_interval, this._formatDuration((d.scan_interval || 0) * (d.offline_after_failures || 0) * 1000))
        : null;
      if (line) {
        if (errors[key]) line.className = "opt-error";
        else if (line.className === "opt-error") {
          line.className = "opt-short";
          line.textContent = "";
        }
        if (text !== null) line.textContent = text;
        else if (!errors[key] && !line.textContent) line.textContent = this._settingsShortText(key);
      }
    }
    const body = dialog.querySelector(".dlg-body");
    let note = dialog.querySelector(".set-note");
    const reload = ["scan_interval", "purge_time", "ping_enabled", "ping_interval"].some((k) => changes.includes(k));
    if (reload && !note && body) {
      note = document.createElement("div");
      note.className = "set-note";
      note.textContent = this._t("settingsReloadNote");
      const err = body.querySelector(":scope > .dlg-error");
      body.insertBefore(note, err);
    } else if (!reload && note) note.remove();
  }

  _settingsShortText(key) {
    const map = {
      scan_interval: "optScanIntervalShort",
      purge_days: "optPurgeDaysShort",
      purge_time: "optPurgeTimeShort",
      ping_interval: "optPingIntervalShort",
    };
    return map[key] ? this._t(map[key]) : "";
  }

  async _saveSettings() {
    const st = this._settings;
    if (!st) return;
    const changes = this._settingsEntryChanges();
    const extra = this._settingsExtraChanges();
    if ((!changes.length && !extra.length) || Object.keys(this._settingsErrors()).length) return;
    const values = {};
    for (const key of changes) values[key] = st.draft[key];
    st.saving = true;
    st.saveError = null;
    this._renderSettings();
    try {
      let result = null;
      if (changes.length) {
        result = await this._hass.callWS({
          type: "unifi_dynamic/set_options",
          entry_id: st.entryId,
          values,
        });
      }
      if (extra.includes("prerelease")) {
        const panel = await this._hass.callWS({ type: "unifi_dynamic/set_panel", prerelease: st.extra.prerelease });
        this._applyPanelSettings(panel);
        // Ausgeschaltet: den HACS-Schalter zurücksetzen, falls das Panel ihn
        // eingeschaltet hat.
        if (!this._prerelease) await this._disableHacsPrerelease();
      }
      if (extra.includes("loader")) {
        this._loader = st.extra.loader;
        this._loaderPick = null;
        this._savePrefs();
      }
      this._toast(result && result.reload ? this._t("settingsSavedReload") : this._t("settingsSaved"));
      this._closeSettings();
      // Schutzliste und Namen können sich geändert haben.
      this._fetchClients();
    } catch (err) {
      if (this._settings !== st) return;
      st.saving = false;
      st.saveError = (err && err.message) || String(err);
      this._renderSettings();
    }
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
      this._allClients.find((c) => c.mac === mac && (!entryId || c.entry_id === entryId)) ||
      this._allClients.find((c) => c.mac === mac);
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

  // Über alle Hubs: eine Meldung kann auf einen Client eines gerade nicht
  // gewählten Hubs zeigen.
  _clientByKey(key) {
    return this._allClients.find((c) => `${c.entry_id}|${c.mac}` === key) || null;
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

  // ---------------------------------------------------------------------
  // Ping (Antwortzeit): Tabellenzelle, Abschnitt in der Geräteansicht und
  // Schalter für die Entitäten. Verlauf über unifi_dynamic/ping_history.
  // ---------------------------------------------------------------------

  _pingCellHtml(c) {
    const p = c.ping;
    const esc = (v) => this._escape(v);
    if (!p || !c.online) return `<span class="muted">–</span>`;
    if (p.status === "no_reply") return `<span class="muted">${esc(this._t("pingNoReplyShort"))}</span>`;
    if (p.median == null) return `<span class="muted">–</span>`;
    const loss = p.loss > 0 ? `<small class="ping-loss">${esc(this._t("pingLossShort")(this._fmtNum(p.loss)))}</small>` : "";
    const tier = pingTier(p.median);
    return `<span class="ping-val"><span class="ping-line" title="${esc(this._t("pingTierNames")[tier])}">${pingBarsHtml(
      tier
    )}${esc(this._fmtMs(p.median))}</span>${loss}</span>`;
  }

  _fmtNum(v) {
    const lang = pickLang(this._hass) === "de" ? "de-CH" : "en-US";
    return Number(v).toLocaleString(lang, { maximumFractionDigits: v < 10 ? 1 : 0 });
  }

  _fmtMs(v) {
    return v == null ? "–" : `${this._fmtNum(v)} ms`;
  }

  // Verlauf höchstens eine Minute alt zeigen, dann neu holen.
  // Zeitraum wie beim Verfügbarkeits-Zeitstrahl (gemeinsamer Schalter).
  _ensurePing(c) {
    const range = this._availRange || "24h";
    const key = `${c.entry_id}|${c.mac}|${range}`;
    const h = this._pingHist;
    if (h && h.key === key && (h.loading || Date.now() - h.at < 60000)) return;
    const prev = h && h.key === key ? h.data : null;
    const startedAt = Date.now();
    this._pingHist = { key, loading: true, data: prev, at: startedAt, startedAt };
    this._tickLoader();
    this._hass
      .callWS({ type: "unifi_dynamic/ping_history", entry_id: c.entry_id, mac: c.mac, range })
      .then((data) => {
        if (!this._pingHist || this._pingHist.key !== key) return;
        this._pingHist = { key, loading: false, data, at: Date.now() };
        this._renderDialog();
      })
      .catch((err) => {
        if (!this._pingHist || this._pingHist.key !== key) return;
        this._pingHist = { key, loading: false, data: prev, error: (err && err.message) || String(err), at: Date.now() };
        this._renderDialog();
      });
  }

  // Zeitraum-Schalter der Unter-Fenster (gemeinsam, pro Benutzer gemerkt).
  _rangeSwitchHtml() {
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const range = this._availRange || "24h";
    return `<div class="stat-range"><span class="avail-range" role="group" aria-label="${esc(t("availRangeGroup"))}">${Object.keys(AVAIL_RANGES)
      .map(
        (r) =>
          `<button type="button" data-dlg="avail-range" data-range="${r}" aria-pressed="${r === range}" class="${
            r === range ? "active" : ""
          }">${esc(t("availRanges")[r])}</button>`
      )
      .join("")}</span></div>`;
  }

  _pingSectionHtml(c, inStat = false) {
    // Nur wenn der Hub misst (list_clients liefert dann "ping").
    if (!c.ping) return "";
    this._ensurePing(c);
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const h = this._pingHist;
    const range = this._availRange || "24h";
    const data = h && h.key === `${c.entry_id}|${c.mac}|${range}` ? h.data : null;
    // Die Werte gibt es immer auch als Sensoren am Gerät (für jeden Client).
    const toggle = `<p class="opt-short ping-entity-note">${esc(t("pingEntityNote"))}</p>`;
    const head = inStat
      ? this._rangeSwitchHtml()
      : `<h3 class="avail-h3"><span>${esc(t("pingTitle"))}</span><span class="ping-range">${esc(t("pingRange")[range])}</span></h3>`;
    let body;
    if (!data && h && h.error) body = `<p class="dlg-note">${esc(h.error)}</p>`;
    else if (!data) body = this._availLoaderHtml(`ping|${h ? h.key : ""}`, h && h.startedAt);
    else if (!data.summary) body = `<p class="dlg-note">${esc(t("pingNoData"))}</p>`;
    else if (data.summary.status === "no_reply") body = `<p class="dlg-note">${esc(t("pingNoReply"))}</p>`;
    else {
      const s = data.summary;
      const stat = (label, value, warn) => `<div class="ping-stat${warn ? " warn" : ""}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
      const medianTier = pingTier(s.median);
      body = `<div class="ping-stats">${stat(t("pingMedian"), this._fmtMs(s.median)).replace("<b>", `<b>${pingBarsHtml(medianTier)}`)}${stat(t("pingJitter"), this._fmtMs(s.jitter))}${stat(
        t("pingLoss"),
        `${this._fmtNum(s.loss)} %`,
        s.loss > 0
      )}</div>${this._pingChartHtml(data)}`;
    }
    return `<section class="ping">${head}${body}${toggle}</section>`;
  }

  // ---------------------------------------------------------------------
  // Statistik: Kacheln mit dem Wert der letzten 24 Stunden (kommt mit der
  // Clientliste), ein Tipp öffnet das Unter-Fenster mit Zeitraum-Schalter
  // und Diagramm. Geladen wird erst dort.
  // ---------------------------------------------------------------------

  _statTileHtml(kind, label, valueHtml, sub, attr) {
    const esc = (v) => this._escape(v);
    return `<button type="button" class="st-tile" ${attr}="stat" data-kind="${kind}" aria-label="${esc(label)}">
        <span class="st-k">${esc(label)}</span>${icon("chevronRight")}
        <span class="st-v">${valueHtml}</span>
        <span class="st-sub">${esc(sub)}</span>
      </button>`;
  }

  _availTile(summary, kind, attr, label) {
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    if (!summary) return this._statTileHtml(kind, label, `<span class="muted">–</span>`, t("statNoData"), attr);
    const pct = summary.outages && summary.pct > 99.9 ? 99.9 : summary.pct;
    const value = `${esc(this._fmtPct(pct))}<small>%</small>`;
    const sub = summary.outages
      ? t("statOutages")(summary.outages, this._formatDuration(summary.longest * 1000))
      : t("statNoOutages");
    return this._statTileHtml(kind, label, value, sub, attr);
  }

  _fmtPct(v) {
    const lang = pickLang(this._hass) === "de" ? "de-CH" : "en-US";
    return Number(v).toLocaleString(lang, { minimumFractionDigits: v >= 100 ? 0 : 1, maximumFractionDigits: 1 });
  }

  // Vorhandene Statistiken eines Clients, gleiche Regeln wie die Kacheln:
  // WLAN nur bei WLAN-Clients mit Messwert, Antwortzeit nur mit Ping.
  _statKinds(c) {
    const stats = c.stats || {};
    const kinds = ["avail"];
    if (!c.is_wired && (typeof c.signal === "number" || (stats.signal && stats.signal.median != null))) kinds.push("wifi");
    if (c.ping) kinds.push("ping");
    return kinds;
  }

  _statTilesHtml(c) {
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const stats = c.stats || {};
    const kinds = this._statKinds(c);
    const tiles = [this._availTile(stats.avail, "avail", "data-dlg", t("tileAvail"))];
    if (kinds.includes("wifi")) {
      const dbm = stats.signal && stats.signal.median != null ? stats.signal.median : c.signal;
      const tier = signalBars(dbm);
      tiles.push(
        this._statTileHtml(
          "wifi",
          t("tileWifiShort"),
          `${wifiFanHtml(tier, false)}${esc(Math.round(dbm))}`,
          `dBm · ${t("wifiTierNames")[tier]}`,
          "data-dlg"
        )
      );
    }
    if (kinds.includes("ping")) {
      const p = c.ping;
      const value =
        p.status === "no_reply"
          ? `<span class="muted st-small">${esc(t("pingNoReplyShort"))}</span>`
          : p.median == null
          ? `<span class="muted">–</span>`
          : `${pingBarsHtml(pingTier(p.median))}${esc(this._fmtNum(p.median))}<small>ms</small>`;
      const sub = p.status === "no_reply" || p.loss == null ? t("statNoData") : t("pingLossShort")(this._fmtNum(p.loss));
      tiles.push(this._statTileHtml("ping", t("tilePing"), value, p.status === "no_reply" ? t("tilePingSilent") : sub, "data-dlg"));
    }
    return `<h3>${esc(t("statTitle"))}</h3><div class="st-tiles n${tiles.length}">${tiles.join("")}</div>`;
  }

  // Verlauf der WLAN-Signalstärke (unifi_dynamic/signal_history).
  _ensureSignal(c) {
    const range = this._availRange || "24h";
    const key = `${c.entry_id}|${c.mac}|${range}`;
    const h = this._signalHist;
    if (h && h.key === key && (h.loading || Date.now() - h.at < 60000)) return;
    const prev = h && h.key === key ? h.data : null;
    const startedAt = Date.now();
    this._signalHist = { key, loading: true, data: prev, at: startedAt, startedAt };
    this._tickLoader();
    this._hass
      .callWS({ type: "unifi_dynamic/signal_history", entry_id: c.entry_id, mac: c.mac, range })
      .then((data) => {
        if (!this._signalHist || this._signalHist.key !== key) return;
        this._signalHist = { key, loading: false, data, at: Date.now() };
        this._renderStat();
      })
      .catch((err) => {
        if (!this._signalHist || this._signalHist.key !== key) return;
        this._signalHist = { key, loading: false, data: prev, error: (err && err.message) || String(err), at: Date.now() };
        this._renderStat();
      });
  }

  _signalSectionHtml(c) {
    this._ensureSignal(c);
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const h = this._signalHist;
    const range = this._availRange || "24h";
    const data = h && h.key === `${c.entry_id}|${c.mac}|${range}` ? h.data : null;
    let body;
    if (!data && h && h.error) body = `<p class="dlg-note">${esc(h.error)}</p>`;
    else if (!data) body = this._availLoaderHtml(`signal|${h ? h.key : ""}`, h && h.startedAt);
    else if (!data.summary) body = `<p class="dlg-note">${esc(t("wifiNoData"))}</p>`;
    else {
      const s = data.summary;
      const stat = (label, value) => `<div class="ping-stat"><span>${esc(label)}</span><b>${value}</b></div>`;
      const dbm = (v) => `${esc(Math.round(v))} dBm`;
      body = `<div class="ping-stats">${stat(t("wifiMedian"), `${wifiFanHtml(signalBars(s.median), false)}${dbm(s.median)}`)}${stat(
        t("wifiBest"),
        dbm(s.best)
      )}${stat(t("wifiWorst"), dbm(s.worst))}</div>${this._signalChartHtml(data)}`;
      const aps = (s.aps || []).map((a) => `${a.name} ${a.share} %`).join(" · ");
      // Zeit ohne WLAN-Daten seit dem ersten Block (Kabel, ausser Haus).
      const size = data.bucket || 300;
      const first = (data.buckets || [])[0];
      const slots = first ? Math.max(1, Math.round(((data.now || Date.now() / 1000) - first[0]) / size)) : 0;
      const gap = first ? Math.max(0, slots - data.buckets.length) * size : 0;
      body += `<div class="stat-list">${aps ? `<div><span>${esc(t("wifiAps"))}</span><span>${esc(aps)}</span></div>` : ""}<div><span>${esc(
        t("wifiGaps")
      )}</span><span>${esc(gap >= size * 2 ? this._formatDuration(gap * 1000) : t("wifiGapsNone"))}</span></div></div>`;
    }
    return `<section class="ping">${this._rangeSwitchHtml()}${body}</section>`;
  }

  // Säulen je Block, Höhe von -90 dBm (leer) bis -30 dBm (voll), Farbe nach
  // Stufe des Medians. Lücken, wo der Client nicht im WLAN war.
  _signalChartHtml(data) {
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const size = data.bucket || 300;
    const end = data.now || Date.now() / 1000;
    const span = data.span || 86400;
    const start = end - span;
    const n = Math.round(span / size);
    const lang = pickLang(this._hass) === "de" ? "de-CH" : "en-US";
    const names = new Map(((data.summary && data.summary.aps) || []).map((a) => [a.ap_mac, a.name]));
    const bars = (data.buckets || [])
      .filter((b) => b[0] >= start - size)
      .map((b) => {
        const idx = Math.max(0, Math.min(n - 1, Math.floor((b[0] - start) / size)));
        const left = (idx / n) * 100;
        const hgt = Math.max(6, Math.min(100, ((b[1] + 90) / 60) * 100));
        const d = new Date(b[0] * 1000);
        const time =
          span > 86400
            ? d.toLocaleString(lang, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
            : d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
        const tip = `${time} · ${Math.round(b[1])} dBm (${Math.round(b[2])} … ${Math.round(b[3])})${b[5] ? ` · ${names.get(b[5]) || b[5]}` : ""}`;
        return `<i class="pb w${signalBars(b[1])}" style="left:${left.toFixed(2)}%;height:${hgt.toFixed(1)}%" title="${esc(tip)}"></i>`;
      })
      .join("");
    const ago = t("pingAgo")[span > 7 * 86400 ? "30d" : span > 86400 ? "7d" : "24h"];
    const legend = [4, 3, 2, 1]
      .map((w) => `<span><i class="w${w}"></i>${esc(t("wifiLegend")[w])}</span>`)
      .join("");
    return `<div class="ping-chart sig-chart" style="--n:${n}">${bars}</div>
      <div class="ping-axis"><span>${esc(ago)}</span><span>${esc(t("availNow"))}</span></div>
      <div class="ping-legend sig-legend">${legend}</div>`;
  }

  // Unter-Fenster über der Geräteansicht bzw. den Einstellungen.
  _openStat(kind) {
    const dialog = this.shadowRoot.querySelector("dialog.stat-dlg");
    if (!dialog) return;
    this._stat = { kind };
    this._statHtml = "";
    // Solange das Statistik-Fenster offen ist, das X des Dialogs dahinter
    // ausblenden: es wirkt sonst, als gehöre es zum Statistik-Fenster.
    this.setAttribute("stat-open", "");
    this._renderStat();
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
  }

  _closeStat() {
    const dialog = this.shadowRoot && this.shadowRoot.querySelector("dialog.stat-dlg");
    this._stat = null;
    this._statHtml = "";
    this.removeAttribute("stat-open");
    if (dialog && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }

  _renderStat() {
    const dialog = this.shadowRoot && this.shadowRoot.querySelector("dialog.stat-dlg");
    const st = this._stat;
    if (!dialog || !st) return;
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    let title;
    let sub;
    let body;
    const avatars = { ctl: "hub", avail: "pulse", wifi: "wifi", ping: "timer" };
    const avatar = avatars[st.kind] || "pulse";
    let tabs = "";
    if (st.kind === "ctl") {
      const src = this._settingsAvailSrc();
      if (!src) return this._closeStat();
      const hub = (this._settings && this._settings.data && this._settings.data.hub) || {};
      title = t("secCtlAvail");
      sub = [hub.title, hub.host].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
      body = this._availSectionHtml(null, src, true);
    } else {
      const c = this._dialogKey ? this._clientByKey(this._dialogKey) : null;
      if (!c) return this._closeStat();
      sub = c.name;
      // Tabs zum Wechseln zwischen den Statistiken, ohne zu schliessen. Nur
      // bei mehr als einer; fällt die offene weg (z. B. Ping aus), zur ersten.
      const kinds = this._statKinds(c);
      if (!kinds.includes(st.kind)) st.kind = kinds[0];
      if (kinds.length > 1) {
        const names = t("statTabs");
        tabs = `<div class="stat-tabs" role="tablist">${kinds
          .map((k) => {
            const on = k === st.kind;
            return `<button type="button" class="stat-tab${on ? " on" : ""}" role="tab" aria-selected="${on}" data-stat="tab" data-kind="${k}">${icon(
              avatars[k]
            )}<span class="lg">${esc(names[k][0])}</span><span class="sh">${esc(names[k][1])}</span></button>`;
          })
          .join("")}</div>`;
      }
      if (st.kind === "wifi") {
        title = t("tileWifi");
        sub = [c.name, c.ap_name].filter(Boolean).join(" · ");
        body = this._signalSectionHtml(c);
      } else if (st.kind === "ping") {
        title = t("tilePing");
        body = this._pingSectionHtml(c, true);
      } else {
        title = t("tileAvail");
        body = this._availSectionHtml(c, null, true);
      }
    }
    // Kopf wie bei Gerätedialog und Einstellungen: Symbol der Kachel, Titel,
    // X. Das X schliesst nur das Statistik-Fenster, dahinter bleibt die
    // Geräteansicht bzw. die Einstellungen offen.
    const html = `<div class="dlg-head stat-head">
        <span class="dlg-avatar stat-avatar">${icon(avatar)}</span>
        <div class="dlg-title"><h2>${esc(title)}</h2><div class="dlg-sub">${esc(sub || "")}</div></div>
        <button type="button" class="dlg-close" data-stat="close" title="${esc(t("dialogClose"))}" aria-label="${esc(
          t("dialogClose")
        )}">${icon("close")}</button>
      </div>
      <div class="dlg-body">${tabs}${body}</div>`;
    if (html === this._statHtml) return;
    const scroll = dialog.scrollTop;
    this._statHtml = html;
    dialog.innerHTML = html;
    this._syncLoaders(dialog);
    dialog.scrollTop = scroll;
  }

  _bindStat(dialog) {
    dialog.addEventListener("click", (ev) => {
      if (ev.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this._closeStat();
        return;
      }
      const seg = ev.target.closest(".avail-bar .seg");
      if (seg) {
        if (ev.pointerType !== "mouse") {
          this._showAvailTip(seg.classList.contains("off") && !seg.classList.contains("hover") ? seg : null);
        }
        return;
      }
      if (!ev.target.closest(".avail-tip")) this._showAvailTip(null);
      if (ev.target.closest('[data-stat="close"]')) {
        this._closeStat();
        return;
      }
      const tab = ev.target.closest('[data-stat="tab"]');
      if (tab) {
        if (this._stat && tab.dataset.kind !== this._stat.kind) {
          this._stat.kind = tab.dataset.kind;
          this._renderStat();
          dialog.scrollTop = 0;
        }
        return;
      }
      const btn = ev.target.closest("[data-dlg]");
      if (!btn || btn.disabled) return;
      if (btn.dataset.dlg === "avail-range") {
        if (btn.dataset.range !== this._availRange) {
          this._availRange = btn.dataset.range;
          this._savePrefs();
          this._renderStat();
        }
      }
    });
    dialog.addEventListener("pointerover", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const seg = ev.target.closest && ev.target.closest(".avail-bar .seg");
      if (seg) this._showAvailTip(seg.classList.contains("off") ? seg : null);
    });
    dialog.addEventListener("pointerout", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const bar = ev.target.closest && ev.target.closest(".avail-bar");
      if (bar && !(ev.relatedTarget && bar.contains(ev.relatedTarget))) this._showAvailTip(null);
    });
    dialog.addEventListener("close", () => {
      if (!dialog.open) {
        this._stat = null;
        this._statHtml = "";
        // Auch bei Escape: X des Dialogs dahinter wieder zeigen.
        this.removeAttribute("stat-open");
      }
    });
  }

  // Säulen pro 5-Minuten-Block über 24 Stunden. Höhe = Median, Farbe warnt
  // bei Paketverlust; Blöcke ganz ohne Antwort als roter Strich unten.
  _pingChartHtml(data) {
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const size = data.bucket || 300;
    const end = data.now || Date.now() / 1000;
    const span = data.span || 86400;
    const start = end - span;
    const n = Math.round(span / size);
    const buckets = (data.buckets || []).filter((b) => b[0] >= start - size);
    const medians = buckets.map((b) => b[1]).filter((v) => v != null).sort((a, b) => a - b);
    if (!buckets.length) return "";
    // Skala am 95. Perzentil, damit ein Ausreisser nicht alles plattdrückt.
    const p95 = medians.length ? medians[Math.min(medians.length - 1, Math.floor(medians.length * 0.95))] : 1;
    const scale = Math.max(5, Math.ceil(p95 * 1.2));
    const lang = pickLang(this._hass) === "de" ? "de-CH" : "en-US";
    const bars = buckets
      .map((b) => {
        const idx = Math.max(0, Math.min(n - 1, Math.floor((b[0] - start) / size)));
        const left = (idx / n) * 100;
        const lossPct = b[3] ? Math.round((1 - b[4] / b[3]) * 100) : 0;
        const d = new Date(b[0] * 1000);
        const time =
          span > 86400
            ? d.toLocaleString(lang, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
            : d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
        const tip = t("pingBarTip")(time, b[1] == null ? t("pingNoReplyShort") : this._fmtMs(b[1]), t("pingLossShort")(lossPct));
        if (b[1] == null) {
          return `<i class="pb none" style="left:${left.toFixed(2)}%" title="${esc(tip)}"></i>`;
        }
        const hgt = Math.max(4, Math.min(100, (b[1] / scale) * 100));
        return `<i class="pb t${pingTier(b[1])}${lossPct > 0 ? " lossy" : ""}" style="left:${left.toFixed(2)}%;height:${hgt.toFixed(1)}%" title="${esc(tip)}"></i>`;
      })
      .join("");
    return `<div class="ping-chart" style="--n:${n}"><span class="ping-scale">${esc(t("pingScale")(scale))}</span>${bars}</div>
      <div class="ping-axis"><span>${esc(t("pingAgo")[span > 7 * 86400 ? "30d" : span > 86400 ? "7d" : "24h"])}</span><span>${esc(t("availNow"))}</span></div>
      <div class="ping-legend">${[5, 4, 3, 2, 1]
        .map((tier, i) => {
          const range =
            i === 0 ? `< ${PING_TIERS[0]}` : i === 4 ? `≥ ${PING_TIERS[3]}` : `${PING_TIERS[i - 1]}–${PING_TIERS[i]}`;
          return `<span><i class="t${tier}"></i>${esc(range)} ms</span>`;
        })
        .join("")}<span><i class="lossmark"></i>${esc(t("pingLoss"))}</span></div>`;
  }

  _closeDialog() {
    this._closeStat();
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

  // Die Online-Entität (binary_sensor dieser Integration) des HA-Geräts.
  _onlineEntityId(deviceId) {
    const hass = this._hass;
    if (!deviceId || !hass || !hass.entities) return null;
    const hit = Object.values(hass.entities).find(
      (e) =>
        e &&
        e.device_id === deviceId &&
        e.platform === "unifi_dynamic" &&
        String(e.entity_id).startsWith("binary_sensor.")
    );
    return hit ? hit.entity_id : null;
  }

  // Verlauf holen, wenn für Entität und Zeitraum noch nichts oder nur ein
  // veralteter Stand da ist. Das Ende ist der Abfragezeitpunkt, nicht
  // "jetzt" beim Rendern: sonst änderte sich das HTML bei jedem hass-Update
  // und der Dialog würde ständig neu aufgebaut.
  // src: { id, entryId, mac, entityId } - ein Client oder der Controller
  // (mac = "controller"). entityId nur für den Recorder-Verlauf vor Beginn
  // des eigenen Protokolls; ohne Entität bleibt diese Zeit "keine Daten".
  _ensureHistory(src) {
    const key = `${src.id}|${this._availRange}`;
    const h = this._history;
    if (h && h.key === key && (h.loading || (!h.error && Date.now() - h.at < AVAIL_MAX_AGE_MS))) {
      return;
    }
    if (h && h.key === key && h.error && Date.now() - h.at < AVAIL_MAX_AGE_MS) return;
    this._fetchHistory(src, this._availRange);
  }

  // Recorder-Verlauf im Kurzformat für [start, end] (ms).
  async _recorderStates(entityId, start, end) {
    const result = await this._hass.callWS({
      type: "history/history_during_period",
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      entity_ids: [entityId],
      include_start_time_state: true,
      significant_changes_only: false,
      minimal_response: true,
      no_attributes: true,
    });
    return (result && result[entityId]) || [];
  }

  // Zuerst das eigene Protokoll der Integration (schnell). Nur den Teil
  // davor, den es noch nicht abdeckt (erste Tage nach dem Update auf 2.7.0),
  // aus dem Recorder holen - der ist bei langen Zeiträumen langsam, darum
  // wird dieser ältere Teil zwischengespeichert: er ändert sich nicht mehr.
  async _loadAvailability(src, range, start, end) {
    let log = null;
    try {
      log = await this._hass.callWS({
        type: "unifi_dynamic/availability",
        entry_id: src.entryId,
        mac: src.mac,
        start: start / 1000,
      });
    } catch (err) {
      log = null; // Älteres Backend: nur Recorder.
    }
    const since = log && typeof log.since === "number" ? log.since * 1000 : null;
    const own = log
      ? (log.events || []).map(([t, s]) => ({ s: s === 1 ? "on" : s === 0 ? "off" : "unavailable", lu: t }))
      : [];
    if (since !== null && since <= start + 60000) return own;
    const entityId = src.entityId;
    if (!entityId) return own;
    const until = since !== null ? since : end;
    const ckey = `${entityId}|${range}`;
    this._recorderCache = this._recorderCache || {};
    let cached = this._recorderCache[ckey];
    if (!cached || cached.until < until - 60000 || cached.start > start + 3600000 || Date.now() - cached.at > 600000) {
      cached = { start, until, at: Date.now(), states: await this._recorderStates(entityId, start, until) };
      this._recorderCache[ckey] = cached;
    }
    const older = cached.states.filter((st) => {
      const t = typeof st.lu === "number" ? st.lu * 1000 : Date.parse(st.last_updated || "");
      return !(t >= until);
    });
    return older.concat(own);
  }

  async _fetchHistory(src, range) {
    const key = `${src.id}|${range}`;
    const end = Date.now();
    const start = end - AVAIL_RANGES[range] * 1000;
    // Alten Stand derselben Abfrage beim Nachladen weiter zeigen.
    const prev = this._history && this._history.key === key && this._history.states ? this._history : null;
    this._history = prev
      ? { ...prev, loading: true }
      : { key, loading: true, error: null, states: null, start, end, at: end };
    // Startzeit für den Loader: damit läuft er nach einem Neuaufbau des
    // Dialogs an derselben Stelle weiter (siehe _syncLoaders).
    this._loaderStarted = { key, at: end };
    this._tickLoader();
    let states = null;
    let error = null;
    try {
      states = await this._loadAvailability(src, range, start, end);
    } catch (err) {
      error = (err && err.message) || String(err);
    }
    // Inzwischen anderer Client oder Zeitraum gewählt: Ergebnis verwerfen.
    if (!this._history || this._history.key !== key) return;
    this._history = error
      ? { key, loading: false, error, states: null, start, end, at: Date.now() }
      : { key, loading: false, error: null, states, start, end, at: Date.now() };
    this._renderDialog();
    this._renderSettingsAvail();
  }

  // Zustände (Kurzformat von HA: s = Zustand, lu/lc = Zeit in Sekunden) in
  // lückenlose Abschnitte "on"/"off"/"none" über den Zeitraum umrechnen.
  // Vor dem ersten Eintrag und bei unavailable/unknown: keine Daten.
  _availSegments(states, start, end) {
    const points = [];
    for (const st of states || []) {
      const secs = typeof st.lu === "number" ? st.lu : typeof st.lc === "number" ? st.lc : null;
      let ms = secs != null ? secs * 1000 : Date.parse(st.last_changed || st.last_updated || "");
      if (!Number.isFinite(ms)) continue;
      const s = st.s != null ? st.s : st.state;
      points.push([Math.max(ms, start), s === "on" ? "on" : s === "off" ? "off" : "none"]);
    }
    points.sort((a, b) => a[0] - b[0]);
    const segs = [];
    const push = (from, to, kind) => {
      if (to <= from) return;
      const last = segs[segs.length - 1];
      if (last && last.kind === kind && last.to === from) last.to = to;
      else segs.push({ from, to, kind });
    };
    let cursor = start;
    let kind = "none";
    for (const [t, k] of points) {
      if (t >= end) break;
      push(cursor, t, kind);
      cursor = Math.max(cursor, t);
      kind = k;
    }
    push(cursor, end, kind);
    return this._bridgeGaps(segs);
  }

  // Neustart-Lücken überbrücken (siehe AVAIL_BRIDGE_MS): eine kurze Lücke
  // übernimmt den Zustand ihrer Nachbarn, danach werden gleiche Abschnitte
  // zusammengelegt. Nachbarn einer Lücke sind nie selbst Lücken (push legt
  // gleiche Zustände schon zusammen).
  _bridgeGaps(segs) {
    const out = [];
    segs.forEach((s, i) => {
      const prev = segs[i - 1];
      const next = segs[i + 1];
      const bridge =
        s.kind === "none" && prev && next && prev.kind === next.kind && s.to - s.from <= AVAIL_BRIDGE_MS;
      const kind = bridge ? prev.kind : s.kind;
      const last = out[out.length - 1];
      if (last && last.kind === kind) last.to = s.to;
      else out.push({ from: s.from, to: s.to, kind });
    });
    return out;
  }

  _formatDuration(ms) {
    const t = this._t.bind(this);
    const min = Math.max(1, Math.round(ms / 60000));
    if (min < 60) return t("durMin")(min);
    if (min < 1440) return t("durHour")(Math.floor(min / 60), min % 60);
    const hours = Math.round(min / 60);
    return t("durDay")(Math.floor(hours / 24), hours % 24);
  }

  // Uhrzeit, bei längeren Zeiträumen mit Wochentag und Datum.
  _formatAvailTime(ms, withDate) {
    const locale = pickLang(this._hass) === "de" ? "de-CH" : "en-US";
    const opts = withDate
      ? { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" };
    try {
      return new Date(ms).toLocaleString(locale, opts);
    } catch (err) {
      return new Date(ms).toISOString();
    }
  }

  // Beschriftete Markierungen auf ganzen Stunden bzw. Mitternacht. "minor"
  // blendet das schmale Layout aus, damit sich nichts überlappt.
  _availTicks(start, end, range) {
    const locale = pickLang(this._hass) === "de" ? "de-CH" : "en-US";
    const ticks = [];
    const d = new Date(start);
    const span = end - start;
    // Verkürzter Balken (siehe AVAIL_ZOOM_SHARE): Stunden- bzw. Tagesmarken
    // passend zur tatsächlichen Spanne.
    let mode = range;
    let step = 3;
    if (range === "zoom") {
      const hours = span / 3600000;
      if (hours <= 36) {
        mode = "24h";
        step = hours <= 4 ? 1 : hours <= 10 ? 2 : hours <= 20 ? 3 : 6;
      } else {
        mode = hours <= 8 * 24 ? "7d" : "30d";
      }
    }
    if (mode === "24h") {
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
      for (; d.getTime() < end; d.setHours(d.getHours() + 1)) {
        const h = d.getHours();
        if (h % step) continue;
        ticks.push({
          at: d.getTime(),
          label: `${String(h).padStart(2, "0")}:00`,
          minor: h % (step * 2) !== 0,
        });
      }
    } else {
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 1);
      for (let i = 0; d.getTime() < end; d.setDate(d.getDate() + 1), i++) {
        if (mode === "7d") {
          ticks.push({
            at: d.getTime(),
            label: d.toLocaleDateString(locale, { weekday: "short" }),
            minor: false,
          });
        } else if (d.getDate() % 5 === 0 && d.getDate() !== 30) {
          ticks.push({
            at: d.getTime(),
            label: d.toLocaleDateString(locale, { day: "numeric", month: "numeric" }),
            minor: d.getDate() % 10 !== 0,
          });
        }
      }
    }
    // Nicht zu nah an "jetzt" (rechter Rand) und am linken Rand (beim
    // verkürzten Balken steht dort die Startzeit).
    const minPos = range === "zoom" ? 16 : 5;
    return ticks
      .map((tk) => ({ ...tk, pos: ((tk.at - start) / span) * 100 }))
      .filter((tk) => tk.pos > minPos && tk.pos < 82);
  }

  // Zeitstrahl eines Clients (Geräteansicht) bzw. des Controllers
  // (Einstellungen, src.controller). Gleicher Zeitraum für beide.
  _availSectionHtml(c, src = null, inStat = false) {
    const t = (k) => this._t(k);
    const esc = (v) => this._escape(v);
    const range = this._availRange;
    const switchHtml = `<span class="avail-range" role="group" aria-label="${esc(t("availRangeGroup"))}">${Object.keys(
      AVAIL_RANGES
    )
      .map(
        (r) =>
          `<button type="button" data-dlg="avail-range" data-range="${r}" aria-pressed="${
            r === range
          }" class="${r === range ? "active" : ""}">${esc(t("availRanges")[r])}</button>`
      )
      .join("")}</span>`;
    const head = inStat
      ? `<div class="stat-range">${switchHtml}</div>`
      : `<h3 class="avail-h3"><span>${esc(t(src && src.controller ? "secCtlAvail" : "secAvail"))}</span>${switchHtml}</h3>`;
    const note = (text, extra = "") => `${head}<div class="avail"><p class="dlg-note">${esc(text)}${extra}</p></div>`;

    if (!src) {
      const entityId = this._onlineEntityId(c.device_id);
      if (!entityId) return note(t("availNoEntity"));
      src = { id: entityId, entryId: c.entry_id, mac: c.mac, entityId };
    }
    this._ensureHistory(src);
    const h = this._history;
    if (!h || h.key !== `${src.id}|${range}` || (!h.states && h.loading)) {
      return `${head}${this._availLoaderHtml(`${src.id}|${range}`)}`;
    }
    if (h.error) return note(`${t("availError")} ${h.error}`);

    const { start, end } = h;
    const span = end - start;
    const segs = this._availSegments(h.states, start, end);
    const sum = (kind) => segs.filter((s) => s.kind === kind).reduce((a, s) => a + s.to - s.from, 0);
    const on = sum("on");
    const off = sum("off");
    if (!on && !off) return note(t(src.controller ? "availCtlNoData" : "availNoData"));

    const withDate = range !== "24h";
    const outages = segs.filter((s) => s.kind === "off");
    const pct = (on / (on + off)) * 100;
    // Nie 100 % anzeigen, wenn es einen Unterbruch gab (Rundung).
    const pctText = (outages.length && pct > 99.9 ? 99.9 : pct).toLocaleString(
      pickLang(this._hass) === "de" ? "de-CH" : "en-US",
      { minimumFractionDigits: 1, maximumFractionDigits: 1 }
    );
    const facts = [];
    if (!on) facts.push(`<b>${esc(t("availNever"))}</b>`);
    else if (!outages.length) facts.push(esc(t("availAlways")));
    else {
      const longest = outages.reduce((a, s) => Math.max(a, s.to - s.from), 0);
      facts.push(`<b>${esc(t("availOutages")(outages.length))}</b>`);
      facts.push(esc(t("availTotal")(this._formatDuration(off))));
      facts.push(esc(t("availLongest")(this._formatDuration(longest))));
    }
    const firstData = segs.find((s) => s.kind !== "none");
    if (firstData && firstData.from > start + span * 0.01) {
      facts.push(esc(t("availSince")(this._formatAvailTime(firstData.from, true))));
    }

    // Kaum Daten im Zeitraum: Balken erst ab dem ersten Datenpunkt.
    const zoom = Boolean(firstData && end - firstData.from < span * AVAIL_ZOOM_SHARE);
    const viewStart = zoom ? firstData.from : start;
    const viewSpan = end - viewStart;
    const viewSegs = segs
      .filter((s) => s.to > viewStart)
      .map((s) => ({ ...s, from: Math.max(s.from, viewStart) }));

    const endLabel = (s) => (s.to >= end ? t("availOngoing") : this._formatAvailTime(s.to, false));
    const segHtml = viewSegs
      .map((s) => {
        const left = ((s.from - viewStart) / viewSpan) * 100;
        const width = ((s.to - s.from) / viewSpan) * 100;
        const tip =
          s.kind === "off"
            ? ` data-tip="${esc(
                `${this._formatAvailTime(s.from, withDate)}–${endLabel(s)}`
              )}" data-dur="${esc(this._formatDuration(s.to - s.from))}"`
            : "";
        return `<span class="seg ${s.kind}" style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%"${tip}></span>`;
      })
      .join("");
    const startLabel = zoom
      ? `<span class="start-label">${esc(this._formatAvailTime(viewStart, viewSpan > 20 * 3600000))}</span>`
      : "";
    const ticks = startLabel + this._availTicks(viewStart, end, zoom ? "zoom" : range)
      .map(
        (tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${esc(tk.label)}</span>`
      )
      .join("");
    const hasNone = viewSegs.some((s) => s.kind === "none");
    const legend = `<div class="avail-legend"><span><i class="on"></i>${esc(t("availOnline"))}</span><span><i class="off"></i>${esc(
      t("availOffline")
    )}</span>${hasNone ? `<span><i class="none"></i>${esc(t("availNone"))}</span>` : ""}</div>`;

    let list = "";
    if (outages.length) {
      const newest = outages.slice().reverse();
      list = `<div class="avail-list">${newest
        .slice(0, AVAIL_LIST_MAX)
        .map(
          (s) =>
            `<div><span>${esc(this._formatAvailTime(s.from, withDate))} – ${esc(endLabel(s))}</span><span class="d">${esc(
              this._formatDuration(s.to - s.from)
            )}</span></div>`
        )
        .join("")}${
        newest.length > AVAIL_LIST_MAX
          ? `<p class="avail-more">${esc(t("availMore")(newest.length - AVAIL_LIST_MAX))}</p>`
          : ""
      }</div>`;
    }

    return `${head}<div class="avail">
        <div class="avail-top"><span class="avail-pct">${esc(pctText)}<small>%</small></span><span class="avail-facts">${facts.join(
          " · "
        )}</span></div>
        <div class="avail-barwrap"><div class="avail-bar">${segHtml}<span class="avail-now"></span></div><div class="avail-tip" hidden></div></div>
        <div class="avail-ticks">${ticks}<span class="now-label">${esc(t("availNow"))}</span></div>
        ${legend}
        ${list}
      </div>`;
  }

  // Lade-Animation beim Verlauf: gewählter Loader (Benutzereinstellung),
  // wechselnde Statuswörter und Sekundenzähler (siehe _tickLoader). Nur
  // CSS-Animation; bei "Bewegung reduzieren" steht alles still. Bei "Zufall"
  // gilt die Wahl pro Ladevorgang (key), damit ein Neuaufbau des Dialogs die
  // Animation nicht wechselt.
  _loaderKind(key) {
    if (this._loader !== "random") return LOADERS.includes(this._loader) ? this._loader : "elephant";
    // Pro Ladevorgang merken (Verfügbarkeit und Ping können gleichzeitig
    // laden); ein neuer Vorgang nimmt eine andere als die zuletzt gewählte.
    const picks = (this._loaderPick = this._loaderPick || { last: null, keys: new Map() });
    if (!picks.keys.has(key)) {
      const pool = LOADERS.filter((k) => k !== picks.last);
      const kind = pool[Math.floor(Math.random() * pool.length)];
      picks.keys.set(key, kind);
      picks.last = kind;
      if (picks.keys.size > 20) picks.keys.delete(picks.keys.keys().next().value);
    }
    return picks.keys.get(key);
  }

  _availLoaderHtml(key, startedAt) {
    const esc = (v) => this._escape(v);
    const kind = this._loaderKind(key || "");
    const words = kind === "elephant" ? this._t("availLoadingWords") : this._t("loaderWords")[kind];
    const started =
      startedAt || (this._loaderStarted && this._loaderStarted.key === key ? this._loaderStarted.at : Date.now());
    return `<div class="avail avail-loading ld-${kind}" data-ld-started="${started}" role="status" aria-label="${esc(this._t("availLoading"))}">
        <div class="ele-words">${words.map((w) => `<span class="shimmer">${esc(w)}</span>`).join("")}</div>
        <div class="ele-sec"><span class="avail-sec">0</span> s</div>
        ${this._loaderTrackHtml(kind)}
      </div>`;
  }

  // Nur die Leiste mit Tier, auch für die Vorschau in den Einstellungen.
  _loaderTrackHtml(kind) {
    if (kind === "cat") {
      return `<div class="ele-track"><div class="ele-done ld-cat-done"></div>
          <div class="ld-rider ld-catr"><svg viewBox="0 0 100 54" aria-hidden="true">
            <g class="jump"><g class="crouch">
              <g class="butt"><path class="tail" d="M13 26 C 5 26, 2 20, 3 14"/>
                <rect class="sil leg l1" x="13" y="27" width="4" height="15" rx="2"/>
                <rect class="sil leg l2" x="18" y="27" width="4" height="15" rx="2"/></g>
              <rect class="sil leg l3" x="33" y="27" width="4" height="15" rx="2"/>
              <rect class="sil leg l4" x="38" y="27" width="4" height="15" rx="2"/>
              <ellipse class="sil" cx="27" cy="27" rx="16" ry="7.5"/>
              <circle class="sil" cx="46" cy="22" r="7.5"/>
              <path class="sil" d="M40 18 L40.5 9.5 L45.5 15.5 Z M46.5 15 L52 9.5 L52.5 18 Z"/>
              <circle class="eye" cx="49.5" cy="21" r="1.4"/>
              <path class="whisk" d="M52 24 l6 -1 M52 25 l6 1.5"/>
            </g></g>
            <g class="yarnball"><circle class="yarn" cx="88" cy="41" r="7"/>
              <path class="strand" d="M82 38 q6 -4 12 1 M81.5 42 q7 -5 13 2 M84 46 q5 -3 9 0 M87 34.5 q-3 6 0 13"/></g>
          </svg></div></div>`;
    }
    if (kind === "hamster") {
      return `<div class="ele-track"><div class="ele-done"></div>
          <div class="ld-rider ld-hamr"><svg viewBox="0 0 52 52" aria-hidden="true">
            <g class="wheel"><circle class="rim" cx="26" cy="26" r="23"/><path class="spoke" d="M26 3 V49 M3 26 H49 M9.7 9.7 L42.3 42.3 M42.3 9.7 L9.7 42.3"/></g>
            <g class="hbody"><rect class="sil leg l1" x="20" y="40" width="3" height="6" rx="1.5"/><rect class="sil leg l2" x="30" y="40" width="3" height="6" rx="1.5"/>
              <ellipse class="sil" cx="25" cy="37" rx="10" ry="6.5"/><circle class="sil" cx="34" cy="33" r="5.5"/><circle class="sil" cx="32.5" cy="27.5" r="2.2"/>
              <circle class="eye" cx="36" cy="32" r="1"/><circle class="nose" cx="39.3" cy="34" r="0.9"/></g>
          </svg></div></div>`;
    }
    if (kind === "runner") {
      return `<div class="ele-track ld-desert"><div class="ele-done"></div>
          <div class="ld-rr-actor ld-bird"><svg aria-hidden="true" viewBox="0 0 40 46"><g class="body">
 <g class="run"><g class="wheel"><circle class="blur" cx="18" cy="38" r="7"/></g></g>
 <g class="stand"><path d="M16 30 L14 44 M20 30 L22 44" style="stroke:#f0a030;stroke-width:1.8;fill:none"/></g>
 <path class="sil" d="M4 20 L-8 16 L-6 20 L-10 22 L4 25 Z"/>
 <ellipse class="sil" cx="16" cy="25" rx="11" ry="7"/>
 <path class="sil" d="M22 22 C26 16, 26 10, 27 6 L31 7 C30 12, 29 18, 26 26 Z"/>
 <circle class="sil" cx="29" cy="7" r="5"/>
 <path class="crest" d="M27 3 C24 -2, 21 -3, 18 -2 M28 2.5 C26 -3, 24 -5, 21 -5 M29 2 C29 -3, 27 -6, 25 -7"/>
 <path class="warm" d="M33 6 L44 9 L33 10 Z"/>
 <circle class="eye" cx="30" cy="6" r="1.4" style="fill:var(--udc-text)"/></g></svg></div>
          <div class="ld-wall"><svg aria-hidden="true" viewBox="0 0 74 72"><g class="shake"><path class="rock" d="M0 72 L2 30 L12 10 L30 2 L50 4 L66 14 L74 34 L73 72 Z"/>
 <path class="tunnel" d="M13 72 L13 44 C13 20, 61 20, 61 44 L61 72 Z"/>
 <path class="tunnel t2" d="M19 72 L19 47 C19 29, 55 29, 55 47 L55 72 Z"/>
 <path class="tunnel t3" d="M26 72 L26 51 C26 38, 48 38, 48 51 L48 72 Z"/>
 <path class="crack" d="M20 14 l6 4 l-2 5 M56 12 l5 6 M68 40 l3 4"/></g></svg></div>
          <div class="ld-rr-actor ld-coy"><svg aria-hidden="true" viewBox="0 0 70 46"><g class="fall"><g class="squash">
 <path class="tail" d="M10 20 C0 22, -4 30, -2 34 C4 32, 8 28, 12 25 Z"/>
 <rect class="sil leg l1" x="14" y="26" width="5" height="18" rx="2.5"/><rect class="sil leg l2" x="20" y="26" width="5" height="18" rx="2.5"/>
 <rect class="sil leg l3" x="38" y="26" width="5" height="18" rx="2.5"/><rect class="sil leg l4" x="44" y="26" width="5" height="18" rx="2.5"/>
 <ellipse class="sil" cx="31" cy="22" rx="21" ry="8"/><ellipse class="light" cx="33" cy="26" rx="12" ry="3"/>
 <path class="sil" d="M46 18 C50 10, 56 9, 60 12 L69 17 C70 19, 68 20, 66 20 L56 21 C52 24, 48 24, 46 22 Z"/>
 <path class="sil" d="M52 12 L50 0 L57 10 Z"/>
 <circle class="eye" cx="57" cy="13" r="1.4" style="fill:var(--udc-text)"/><circle cx="69" cy="17.5" r="1.4" fill="#111"/>
</g></g></svg></div>
          <div class="ld-stars" aria-hidden="true"><span>★</span><span>★</span><span>★</span></div>
          <div class="ld-dust a"></div><div class="ld-dust b"></div>
          <div class="ld-say" aria-hidden="true">Mip mip!</div>
        </div>`;
    }
    if (kind === "penguin") {
      return `<div class="ele-track ld-ice"><div class="ele-done ld-pen-done"></div><div class="ld-hole h1"></div><div class="ld-hole h2"></div>
          <div class="ld-stage free">
            <div class="ld-actor ld-bear"><svg viewBox="0 0 72 46" aria-hidden="true"><g class="lean">
              <rect class="fur leg l1" x="14" y="28" width="7" height="16" rx="3.5"/><rect class="fur leg l2" x="22" y="28" width="7" height="16" rx="3.5"/>
              <rect class="fur leg l3" x="40" y="28" width="7" height="16" rx="3.5"/><rect class="fur leg l4" x="48" y="28" width="7" height="16" rx="3.5"/>
              <circle class="fur" cx="12" cy="20" r="3"/><ellipse class="fur" cx="34" cy="23" rx="22" ry="12"/>
              <g class="head"><circle class="fur" cx="51" cy="10" r="3.3"/><circle class="fur" cx="57" cy="18" r="9.5"/>
                <ellipse class="fur" cx="65" cy="21" rx="6" ry="4"/><circle class="dark" cx="70" cy="20" r="1.6"/><circle class="dark" cx="60" cy="15" r="1.2"/></g>
            </g></svg></div>
            <div class="ld-q" aria-hidden="true">?</div><div class="ld-bang" aria-hidden="true">!</div>
          </div>
          <div class="ld-stage"><div class="ld-actor ld-peng"><svg viewBox="0 0 32 46" aria-hidden="true"><g class="pose"><g class="w">
            <ellipse class="warm" cx="11" cy="44" rx="4" ry="1.6"/><ellipse class="warm" cx="20" cy="44" rx="4" ry="1.6"/>
            <ellipse class="sil" cx="16" cy="26" rx="10" ry="16"/><ellipse class="belly" cx="18" cy="29" rx="6" ry="11.5"/>
            <g class="wave"><path class="sil" d="M8 20 C3 26, 3 32, 5 35 C8 30, 9 26, 9 21 Z"/></g>
            <circle class="peye" cx="20" cy="16" r="1.3"/><path class="warm" d="M24 17 L30 19 L24 21 Z"/>
          </g></g></svg></div></div>
          <div class="ld-drop d1"></div><div class="ld-drop d2"></div><div class="ld-drop d3"></div>
          <div class="ld-drop up d1"></div><div class="ld-drop up d2"></div><div class="ld-drop up d3"></div>
        </div>`;
    }
    return `<div class="ele-track">
          <div class="ele-done"></div>
          <div class="ele-rider"><svg viewBox="0 0 60 66" aria-hidden="true">
            <g class="body">
              <rect class="sil leg l1" x="13" y="26" width="5.5" height="15" rx="2.7"/>
              <rect class="sil leg l2" x="19" y="26" width="5.5" height="15" rx="2.7"/>
              <rect class="sil leg l3" x="33" y="26" width="5.5" height="15" rx="2.7"/>
              <rect class="sil leg l4" x="39" y="26" width="5.5" height="15" rx="2.7"/>
              <path class="sil" d="M8 18 C8 9, 18 6, 28 6 C38 6, 46 10, 47 18 C48 25, 44 30, 38 30 L16 30 C10 30, 8 25, 8 18 Z"/>
              <path class="tail" d="M8 15 q-5 2 -4 8"/>
              <circle class="sil" cx="50" cy="13" r="9"/>
              <path class="trunk" d="M57 17 C 62 12, 63 5, 60 1"/>
              <path class="ear" d="M47 5 C 38 3, 35 13, 38 20 C 40 25, 46 25, 48 20 C 49 15, 49 9, 47 5 Z"/>
              <circle class="eye" cx="54" cy="10" r="1.3"/>
            </g>
            <g class="roll"><circle class="ball" cx="29" cy="53" r="12"/><path class="seam" d="M18.5 50 q10.5 8 21 0"/></g>
          </svg></div>
        </div>`;
  }

  // Der Dialog wird bei jeder Änderung seines Inhalts neu aufgebaut
  // (Relativzeiten, Polling, Entitätszustände). Dabei entsteht auch der
  // Loader neu, und der Browser würde seine CSS-Animationen von vorn
  // starten. Deshalb nach jedem Neuaufbau alle Animationen auf die seit dem
  // Start verstrichene Zeit setzen: die Szene läuft nahtlos weiter.
  _syncLoaders(root) {
    if (!root) return;
    const now = Date.now();
    for (const el of root.querySelectorAll("[data-ld-started]")) {
      const started = Number(el.dataset.ldStarted) || now;
      const elapsed = Math.max(0, now - started);
      if (typeof el.getAnimations === "function") {
        for (const anim of el.getAnimations({ subtree: true })) {
          try {
            anim.currentTime = elapsed;
          } catch (err) {
            // Einzelne Animation nicht setzbar: läuft dann eben von vorn.
          }
        }
      }
      const sec = el.querySelector(".avail-sec");
      if (sec) sec.textContent = String(Math.floor(elapsed / 1000));
    }
  }

  // Sekundenzähler direkt im DOM hochzählen, ohne den Dialog neu aufzubauen.
  // Zählt bei allen sichtbaren Loadern (Verfügbarkeit, Ping) mit, jeder ab
  // seiner eigenen Startzeit; hört auf, sobald keiner mehr da ist.
  _tickLoader() {
    window.clearInterval(this._loaderTimer);
    this._loaderTimer = window.setInterval(() => {
      const loaders = this.shadowRoot ? [...this.shadowRoot.querySelectorAll(".avail-loading[data-ld-started]")] : [];
      const busy = (this._history && this._history.loading) || (this._pingHist && this._pingHist.loading);
      if (!loaders.length && !busy) {
        window.clearInterval(this._loaderTimer);
        return;
      }
      for (const el of loaders) {
        const sec = el.querySelector(".avail-sec");
        if (sec) sec.textContent = String(Math.floor((Date.now() - Number(el.dataset.ldStarted)) / 1000));
      }
    }, 1000);
  }

  // Tooltip über einem Unterbruch (Maus: beim Überfahren, Touch: Antippen).
  _showAvailTip(seg) {
    const root = this.shadowRoot;
    if (!root) return;
    root.querySelectorAll(".avail-bar .seg.hover").forEach((el) => el.classList.remove("hover"));
    if (!seg || !seg.dataset.tip) {
      root.querySelectorAll(".avail-tip").forEach((el) => (el.hidden = true));
      return;
    }
    const tip = seg.closest(".avail-barwrap").querySelector(".avail-tip");
    if (!tip) return;
    seg.classList.add("hover");
    tip.innerHTML = `${this._escape(this._t("availTip"))} <b>${this._escape(seg.dataset.tip)}</b> · ${this._escape(
      seg.dataset.dur
    )}`;
    tip.hidden = false;
    const wrap = tip.parentElement.getBoundingClientRect();
    const r = seg.getBoundingClientRect();
    const center = r.left + r.width / 2 - wrap.left;
    const half = tip.offsetWidth / 2;
    // Am Rand einklemmen, der Pfeil zeigt trotzdem auf den Abschnitt.
    const left = Math.min(Math.max(center, half), Math.max(half, wrap.width - half));
    tip.style.left = `${left}px`;
    tip.style.setProperty("--arrow", `${center - left}px`);
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
      for (const other of this._allClients) {
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
    // Offenes Unter-Fenster (Statistik) mit denselben Daten nachführen.
    this._renderStat();
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
                  bars ? ` ${wifiFanHtml(bars, !c.online)}` : ""
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
          ${this._statTilesHtml(c)}
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
    this._syncLoaders(dialog);
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
    const seg = ev.target.closest(".avail-bar .seg");
    if (seg) {
      // Maus: Tooltip folgt dem Zeiger (pointerover), Klick ändert nichts.
      if (ev.pointerType === "mouse") return;
      this._showAvailTip(seg.classList.contains("off") && !seg.classList.contains("hover") ? seg : null);
      return;
    }
    if (!ev.target.closest(".avail-tip")) this._showAvailTip(null);
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
    if (action === "stat") {
      this._openStat(btn.dataset.kind);
      return;
    }
    if (action === "avail-range") {
      if (btn.dataset.range !== this._availRange) {
        this._availRange = btn.dataset.range;
        this._savePrefs();
        this._renderDialog();
      }
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
    // Verbindung: WLAN nach Empfang (bester zuerst), dann WLAN ohne
    // Messwert, dann Kabel. Absteigend genau umgekehrt.
    if (key === "conn") {
      if (client.is_wired) return 2000;
      return typeof client.signal === "number" ? -client.signal : 1000;
    }
    if (key === "linked") return client.linked_device ? client.linked_device.name : null;
    if (key === "status") return client.online;
    if (key === "ping") return client.ping && client.ping.median != null ? client.ping.median : null;
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
    return `<th class="sortable c-${key === "seen_at" ? "seen_at" : key}" data-sort-key="${key}">${this._escape(
      label
    )}<span class="sort-arrow">${arrow}</span></th>`;
  }

  _columnLabel(key) {
    const def = HIDEABLE_COLUMNS.find(([k]) => k === key);
    return def ? this._t(def[1]) : this._t("colName");
  }

  _headerRowHtml() {
    return `${this._headerCellHtml("name", this._t("colName"))}${this._colOrder
      .map((key) => this._headerCellHtml(key, this._columnLabel(key)))
      .join("")}<th class="c-actions">${this._escape(this._t("colActions"))}</th>`;
  }

  // Filterzeile in derselben Reihenfolge wie die Titelzeile.
  _filterRowHtml() {
    const t = (k) => this._t(k);
    const cell = {
      linked: this._textFilterHtml("linked"),
      ip: this._textFilterHtml("ip", t("ipPlaceholder")),
      mac: this._textFilterHtml("mac"),
      essid: this._textFilterHtml("essid"),
      ap_name: this._textFilterHtml("ap_name"),
      conn: `<select class="col-filter filter-conn" data-col="conn" aria-label="${this._escape(
        t("colConn")
      )}">${this._connOptionsHtml()}</select>`,
      seen_at: `<select class="col-filter filter-seen" data-col="seen" aria-label="${this._escape(
        t("colSeen")
      )}">${this._seenOptionsHtml()}</select>`,
      ping: "",
      status: `<select class="col-filter filter-status" data-col="status" aria-label="${this._escape(
        t("colStatus")
      )}">${this._statusOptionsHtml()}</select>`,
    };
    return `<th class="c-name">${this._textFilterHtml("name")}</th>${this._colOrder
      .map((key) => `<th class="c-${key}">${cell[key]}</th>`)
      .join("")}<th class="c-actions"></th>`;
  }

  // Titel- und Filterzeile nach einer Änderung der Reihenfolge neu aufbauen
  // (die Filterwerte kommen aus dem Zustand), dann die Zeilen.
  _rebuildColumns() {
    const root = this.shadowRoot;
    const fr = root && root.querySelector("thead tr.filter-row");
    if (!fr) return;
    this._renderHeader();
    fr.innerHTML = this._filterRowHtml();
    this._applyColumnVisibility();
    this._renderRows();
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
    // Ping-Spalte nur, solange ein Hub misst.
    const css = HIDEABLE_KEYS.filter((key) => this._hiddenCols.has(key) || (key === "ping" && !this._pingActive()))
      .map((key) => `table .c-${key} { display: none; }`)
      .join("\n");
    if (style.textContent !== css) style.textContent = css;
    const badge = root.querySelector(".cols-btn .count-badge");
    if (badge) {
      badge.textContent = String(this._hiddenCols.size);
      badge.hidden = this._hiddenCols.size === 0;
    }
  }

  // Misst mindestens ein Hub die Antwortzeit?
  _pingActive() {
    return this._hubs.some((h) => h.ping === "ok");
  }

  _setColumnVisible(key, visible) {
    if (!HIDEABLE_KEYS.includes(key)) return;
    if (visible) this._hiddenCols.delete(key);
    else this._hiddenCols.add(key);
    this._applyColumnVisibility();
    this._savePrefs();
  }

  // Spaltenliste in aktueller Reihenfolge: Griff zum Verschieben,
  // Beschriftung, Schalter zum Ein-/Ausblenden.
  _columnTogglesHtml(attr) {
    return `<div class="col-list">${this._colOrder
      .filter((key) => key !== "ping" || this._pingActive())
      .map((key) => {
        const label = this._escape(this._columnLabel(key));
        return `<div class="col-row" data-colkey="${key}">
          <button class="col-handle" data-colmove="${key}" title="${this._escape(
            this._t("columnsDrag")(this._columnLabel(key))
          )}" aria-label="${this._escape(this._t("columnsDrag")(this._columnLabel(key)))}">${icon(
            "drag"
          )}</button>
          <label class="col-toggle">${label}
          <input type="checkbox" class="switch" ${attr}="${key}" ${
            this._hiddenCols.has(key) ? "" : "checked"
          } /></label></div>`;
      })
      .join("")}</div>`;
  }

  // Die Liste zeigt nicht immer alle Spalten (Ping nur, solange ein Hub
  // misst). Neue Reihenfolge der sichtbaren Einträge in die gesamte
  // Reihenfolge übernehmen; ausgeblendete behalten ihren Platz.
  _mergeVisibleOrder(visible) {
    const set = new Set(visible);
    const queue = [...visible];
    return this._colOrder.map((k) => (set.has(k) ? queue.shift() : k));
  }

  _setColumnOrder(order) {
    this._colOrder = order;
    this._rebuildColumns();
    this._savePrefs();
  }

  // Liste nach Verschieben neu aufbauen, Fokus auf dem Griff der bewegten
  // Spalte halten (Tastaturbedienung).
  _refreshColumnLists(focusKey) {
    if (this._colsOpen) this._renderColumnsPopover();
    const sheet = this.shadowRoot.querySelector("dialog.filters");
    if (sheet && sheet.open) {
      const box = sheet.querySelector(".sheet-cols");
      if (box) box.innerHTML = this._columnTogglesHtml("data-fcolvis");
    }
    if (focusKey) {
      const scope = this._colsOpen
        ? this.shadowRoot.querySelector(".cols-pop")
        : this.shadowRoot.querySelector("dialog.filters");
      const h = scope && scope.querySelector(`[data-colmove="${focusKey}"]`);
      if (h) h.focus();
    }
  }

  // Ziehen per Pointer-Events (Maus, Finger, Stift gleich). HTML-Drag-and-
  // Drop scheidet aus: es funktioniert auf Touch-Geräten nicht.
  _bindColumnDrag(container) {
    container.addEventListener("pointerdown", (ev) => {
      const handle = ev.target.closest(".col-handle");
      if (!handle || (ev.pointerType === "mouse" && ev.button !== 0)) return;
      const row = handle.closest(".col-row");
      const list = row.parentElement;
      const rows = [...list.querySelectorAll(".col-row")];
      const from = rows.indexOf(row);
      const rects = rows.map((r) => r.getBoundingClientRect());
      const height = rects[from].height;
      const startY = ev.clientY;
      let to = from;
      ev.preventDefault();
      handle.setPointerCapture(ev.pointerId);
      row.classList.add("dragging");
      const move = (e) => {
        const dy = e.clientY - startY;
        row.style.transform = `translateY(${dy}px)`;
        const center = rects[from].top + height / 2 + dy;
        to = from;
        rects.forEach((r, i) => {
          if (i < from && center < r.top + r.height / 2) to = Math.min(to, i);
          if (i > from && center > r.top + r.height / 2) to = Math.max(to, i);
        });
        rows.forEach((r, i) => {
          if (i === from) return;
          let shift = 0;
          if (from < to && i > from && i <= to) shift = -height;
          if (from > to && i < from && i >= to) shift = height;
          r.style.transform = shift ? `translateY(${shift}px)` : "";
        });
      };
      const end = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        rows.forEach((r) => {
          r.style.transform = "";
        });
        row.classList.remove("dragging");
        if (to !== from) {
          const visible = rows.map((r) => r.dataset.colkey);
          const [key] = visible.splice(from, 1);
          visible.splice(to, 0, key);
          this._setColumnOrder(this._mergeVisibleOrder(visible));
          this._refreshColumnLists();
        }
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    });
    // Tastatur: Pfeil hoch/runter auf dem Griff verschiebt um eine Stelle.
    container.addEventListener("keydown", (ev) => {
      const handle = ev.target.closest && ev.target.closest(".col-handle");
      if (!handle || (ev.key !== "ArrowUp" && ev.key !== "ArrowDown")) return;
      ev.preventDefault();
      const key = handle.dataset.colmove;
      const visible = [...handle.closest(".col-list").querySelectorAll(".col-row")].map((r) => r.dataset.colkey);
      const i = visible.indexOf(key);
      const j = ev.key === "ArrowUp" ? i - 1 : i + 1;
      if (j < 0 || j >= visible.length) return;
      [visible[i], visible[j]] = [visible[j], visible[i]];
      this._setColumnOrder(this._mergeVisibleOrder(visible));
      this._refreshColumnLists(key);
    });
  }

  _renderColumnsPopover() {
    const pop = this.shadowRoot.querySelector(".cols-pop");
    if (!pop) return;
    const t = (k) => this._t(k);
    pop.innerHTML = `<div class="cols-head">${this._escape(t("columnsTitle"))}
        <span><button data-cols-all>${this._escape(t("columnsAll"))}</button><button data-cols-default>${this._escape(
          t("columnsDefault")
        )}</button></span></div>
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
      <style>${PANEL_CSS}</style>

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
        <span class="hub-ctl">
          <span class="hub-select-wrap">${icon("hub")}<select class="hub-select" aria-label="${this._escape(
            t("hubSelect")
          )}" hidden></select>${icon("chevron")}</span>
          <button class="tool-btn gear-btn" disabled>${icon("gear")}</button>
        </span>
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
            <tr class="filter-row">${this._filterRowHtml()}</tr>
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
      <dialog class="settings"></dialog>
      <dialog class="conn-edit"></dialog>
      <dialog class="stat-dlg"></dialog>
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
      } else if (ev.target.closest("[data-cols-default]")) {
        // Standard: alle sichtbar, ursprüngliche Reihenfolge.
        this._hiddenCols.clear();
        this._setColumnOrder([...HIDEABLE_KEYS]);
        this._renderColumnsPopover();
      }
    });
    this._bindColumnDrag(colsPop);
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

    // Hub-Auswahl und Einstellungen.
    root.querySelector(".hub-select").addEventListener("change", (ev) => {
      this._hub = ev.target.value;
      this._openMenuKey = null;
      this._applyHub();
      this._renderRows();
      this._savePrefs();
    });
    root.querySelector(".gear-btn").addEventListener("click", () => {
      const hub = this._effectiveHub();
      const entryId = hub !== "all" ? hub : this._hubs.length === 1 ? this._hubs[0].entry_id : null;
      if (entryId) this._openSettings(entryId);
    });
    this._bindSettings(root.querySelector("dialog.settings"));
    this._bindConn(root.querySelector("dialog.conn-edit"));
    this._bindStat(root.querySelector("dialog.stat-dlg"));

    // Filter-Blatt (Handy).
    const sheet = root.querySelector("dialog.filters");
    root.querySelector(".filter-btn").addEventListener("click", () => {
      this._openMenuKey = null;
      this._renderRows();
      this._renderFilterSheet();
      if (typeof sheet.showModal === "function") sheet.showModal();
      else sheet.setAttribute("open", "");
    });
    this._bindColumnDrag(sheet);
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
    // Wechsel zwischen schmal und breit (Fenster, Tablet drehen): die
    // Spaltenauswahl des anderen Layouts anwenden.
    if (this._narrowQuery && this._narrowQuery.addEventListener) {
      this._narrowQuery.addEventListener("change", () => {
        this._rebuildColumns();
        if (this._colsOpen) this._renderColumnsPopover();
      });
    }

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
    // Zeitstrahl: Tooltip beim Überfahren eines Unterbruchs mit der Maus
    // (Touch: Antippen, siehe _handleDialogClick).
    dialog.addEventListener("pointerover", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const seg = ev.target.closest && ev.target.closest(".avail-bar .seg");
      if (seg) this._showAvailTip(seg.classList.contains("off") ? seg : null);
    });
    dialog.addEventListener("pointerout", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const bar = ev.target.closest && ev.target.closest(".avail-bar");
      if (bar && !(ev.relatedTarget && bar.contains(ev.relatedTarget))) this._showAvailTip(null);
    });
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
    setHtml(chips, chipsHtml);
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
      const widths = { name: 150, linked: 110, ip: 95, mac: 120, essid: 70, ap_name: 90, conn: 80, ping: 60, seen_at: 90, status: 60, actions: 20 };
      const keys = ["name", ...this._colOrder, "actions"];
      tbody.innerHTML = Array.from(
        { length: 8 },
        () =>
          `<tr class="skeleton-row">${keys
            .map((k) => `<td class="c-${k}"><div class="skeleton" style="width:${widths[k]}px"></div></td>`)
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
    const order = this._colOrder;

    tbody.innerHTML = rows
      .map((c) => {
        const key = `${c.entry_id}|${c.mac}`;
        const kind = c.is_wired == null ? "unknown" : c.is_wired ? "eth" : "wifi";
        const connText =
          c.is_wired == null ? t("connUnknown") : c.is_wired ? t("connWired") : t("connWireless");
        const bars = kind === "wifi" ? signalBars(c.signal) : 0;
        const barsHtml = bars
          ? `<span class="wfan-wrap" title="${esc(this._formatSignal(c) || "")}">${wifiFanHtml(bars, !c.online)}</span>`
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
        // Eine Funktion pro verschiebbarer Spalte; die Reihenfolge kommt aus
        // den Einstellungen (_colOrder).
        const cells = {
          linked: () =>
            `<td class="c-linked">${
              c.linked_device
                ? `<button class="linked-link" data-action="open-linked" data-linked-id="${esc(
                    c.linked_device.id
                  )}" title="${esc(t("linkOpen")(c.linked_device.name))}">${icon("link")}${esc(
                    c.linked_device.name
                  )}</button>`
                : dash
            }</td>`,
          ip: () => `<td class="mono c-ip">${c.ip ? esc(c.ip) : dash}</td>`,
          mac: () => `<td class="mono c-mac">${esc(c.mac)}</td>`,
          essid: () => `<td class="c-essid">${c.essid ? esc(c.essid) : dash}</td>`,
          ap_name: () => `<td class="c-ap_name">${c.ap_name ? esc(c.ap_name) : dash}</td>`,
          conn: () =>
            `<td class="c-conn"><span class="conn">${icon(kind)}${esc(connText)}${barsHtml}</span></td>`,
          ping: () => `<td class="c-ping">${this._pingCellHtml(c)}</td>`,
          seen_at: () => `<td class="c-seen_at">${seen}</td>`,
          status: () => `<td class="c-status">${status}</td>`,
        };

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
            <td class="name-cell c-name"><div class="name">
              <span class="avatar">${icon(kind)}</span>
              <span class="name-text"><span class="t"><span class="dot ${
                c.online ? "online" : "offline"
              } mob-dot"></span>${esc(c.name)}${shield}</span>${
                multiHost ? `<small>${esc(c.host || "")}</small>` : ""
              }<small class="mob-sub">${esc(mobSub)}</small></span>
            </div></td>
            ${order.map((k) => cells[k](c)).join("")}
            <td class="actions-cell c-actions">
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
