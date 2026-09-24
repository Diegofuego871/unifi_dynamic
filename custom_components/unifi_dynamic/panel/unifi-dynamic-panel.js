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
    searchPlaceholder: "Suche (Name, IP, MAC, SSID, AP)…",
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
    searchPlaceholder: "Search (name, IP, MAC, SSID, AP)…",
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

const DEFAULT_PREFS = {
  search: "",
  onlineFilter: "all",
  connFilter: "all",
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
        return `<p class="dlg-note">${esc(t("linkedNone"))}</p>
          <button class="link-add" data-dlg="link-open">${esc(t("linkAdd"))}</button>`;
      }
      return `<div class="linked-card">
          <button class="linked-main" data-dlg="open-linked" data-linked-id="${esc(d.id)}"
            title="${esc(t("linkOpen")(d.name))}">
            <span class="ln-name">${esc(d.name)}</span>
            ${meta(d) ? `<small>${esc(meta(d))}</small>` : ""}
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
          <span class="ln-name">${esc(d.name)}${
            d.id === currentId ? ` <span class="badge excluded">${esc(t("pickerCurrent"))}</span>` : ""
          }</span>
          ${meta(d) ? `<small>${esc(meta(d))}</small>` : ""}
          ${taken ? `<small class="pick-taken">${esc(t("pickerLinkedTo")(taken.join(", ")))}</small>` : ""}
        </button>`;
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
          <input type="search" data-dlg="picker-search" placeholder="${esc(
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

  _formatRelative(epoch) {
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
        { numeric: "auto" }
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
    )}" aria-label="${esc(t("dialogClose"))}">×</button>`;
    const errorHtml = this._dialogError
      ? `<div class="dlg-error">${esc(t("actionFailed"))} ${esc(this._dialogError)}</div>`
      : "";

    let html;
    if (!c) {
      const mac = this._dialogKey.split("|")[1] || "";
      html = `
        <div class="dlg-head">
          <div class="dlg-title"><h2>${esc(mac)}</h2></div>
          ${closeBtn}
        </div>
        <div class="dlg-body"><p class="dlg-note">${esc(t("notFound"))}</p></div>`;
    } else {
      const connText =
        c.is_wired == null ? t("connUnknown") : c.is_wired ? t("connWired") : t("connWireless");
      const status = c.online
        ? `<span class="badge online">${esc(t("statusOnline"))}</span>`
        : `<span class="badge offline">${esc(t("statusOffline"))}</span>`;
      const protectedBadge = c.excluded
        ? `<span class="badge excluded">${esc(t("excludedBadge"))}</span>`
        : "";
      const timeValue = (epoch) =>
        epoch
          ? `${esc(this._formatSeen(epoch))}<small>${esc(this._formatRelative(epoch))}</small>`
          : esc(t("unknown"));

      // Wert mit Kopieren-Button; ohne Wert nur der Strich, ohne Button.
      const copyable = (label, value, cls = "") =>
        value
          ? `<span class="copy-wrap"><span class="${cls}">${esc(value)}</span>${this._copyButtonHtml(
              value,
              label
            )}</span>`
          : "–";
      const fields = [
        [t("fieldStatus"), `${status}${protectedBadge}`],
        [t("fieldConn"), esc(connText)],
        [t("fieldIp"), copyable(t("fieldIp"), c.ip)],
        [t("fieldMac"), copyable(t("fieldMac"), c.mac, "mono")],
        [t("fieldHostname"), copyable(t("fieldHostname"), c.hostname)],
      ];
      // WLAN-Felder nur, wenn der Client nicht nachweislich am Kabel hängt.
      if (!c.is_wired) {
        fields.push([t("fieldSsid"), copyable(t("fieldSsid"), c.essid)]);
        fields.push([t("fieldAp"), copyable(t("fieldAp"), c.ap_name)]);
        const signal = this._formatSignal(c);
        fields.push([t("fieldSignal"), esc(signal || "–")]);
      }
      fields.push([t("fieldFirstSeen"), timeValue(c.first_seen)]);
      fields.push([t("fieldLastSeen"), timeValue(c.seen_at)]);
      if (this._hostCount > 1) fields.push([t("fieldHost"), esc(c.host || "–")]);

      let entitiesHtml;
      if (!c.device_id) {
        entitiesHtml = `<p class="dlg-note">${esc(t("entitiesNoDevice"))}</p>`;
      } else {
        const entities = this._deviceEntities(c.device_id);
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
          <div class="dlg-title">
            <h2>${esc(c.name)}</h2>
          </div>
          ${closeBtn}
        </div>
        <div class="dlg-body">
          ${errorHtml}
          <dl class="fields">
            ${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}
          </dl>
          <h3>${esc(t("secLinked"))}</h3>
          ${this._linkedSectionHtml(c)}
          <h3>${esc(t("secEntities"))}</h3>
          ${entitiesHtml}
        </div>
        <div class="dlg-actions">
          <button data-dlg="open-device" ${c.device_id ? "" : "disabled"}>
            ${esc(t("menuOpenDevice"))}
          </button>
          <button data-dlg="${c.excluded ? "unexclude" : "exclude"}">
            ${esc(c.excluded ? t("menuUnexclude") : t("menuExclude"))}
          </button>
          <button data-dlg="remove" class="destructive">${esc(t("menuRemove"))}</button>
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
      if (!this._matchesConn(c)) return false;
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

  // Nur die Kopfzeile neu aufbauen (Pfeil-Indikator), Suchfeld und Filter
  // bleiben unberührt.
  _renderHeader() {
    const row = this.shadowRoot.querySelector("thead tr");
    if (!row) return;
    const t = (k) => this._t(k);
    row.innerHTML = `
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
        .toolbar {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          background: var(--card-background-color, #fff);
        }
        .brand-icon {
          flex: 0 0 auto;
          width: 32px;
          height: 32px;
          border-radius: 6px;
        }
        .search-wrap {
          position: relative;
          /* Kleine Basisbreite, damit das Suchfeld auf dem Handy in derselben
             Zeile wie das Icon Platz findet (eine Basis von 820px liess es
             immer in eine eigene Zeile umbrechen, das Icon stand dann allein
             da). Wachsen darf es, aber nie über 820px - sonst dominiert es
             die Werkzeugleiste und verdrängt die Filter (siehe 2.0.3/2.0.4). */
          flex: 1 1 240px;
          max-width: 820px;
          min-width: 200px;
        }
        input[type="search"] {
          width: 100%;
          box-sizing: border-box;
          padding: 14px 34px 14px 14px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--primary-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 16px;
        }
        /* Eigener "×"-Button statt der nativen, browserabhängigen
           Lösung von type="search" (Chrome zeigt eine, Firefox/Safari
           nicht zuverlässig) - hier ausgeblendet, um Doppelungen zu
           vermeiden. */
        input[type="search"]::-webkit-search-cancel-button {
          -webkit-appearance: none;
          appearance: none;
        }
        .search-clear {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 50%;
          background: none;
          color: var(--secondary-text-color, #727272);
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          display: none;
        }
        .search-clear.visible {
          display: block;
        }
        .search-clear:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.08));
          color: var(--primary-text-color, #212121);
        }
        select {
          flex: 0 0 auto;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--primary-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 14px;
        }
        /* Zähler und Online/Offline-Filter in einem: ersetzt das frühere
           Auswahlfeld "Alle/Online/Offline", damit die Werkzeugleiste mit
           dem Zähler nicht höher wird. Die Zahlen folgen dem Verbindungs-
           filter, nicht der Suche (siehe _renderStats). */
        .stats {
          flex: 0 0 auto;
          display: inline-flex;
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 8px;
          overflow: hidden;
        }
        .stat {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 12px;
          border: none;
          border-left: 1px solid var(--divider-color, #ccc);
          background: var(--primary-background-color, #fff);
          color: var(--secondary-text-color, #727272);
          font: inherit;
          font-size: 14px;
          line-height: 20px;
          cursor: pointer;
          white-space: nowrap;
        }
        .stat:first-child {
          border-left: none;
        }
        .stat:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .stat.active {
          background: var(--secondary-background-color, rgba(0,0,0,0.08));
          color: var(--primary-text-color, #212121);
          box-shadow: inset 0 -2px 0 var(--primary-color, #03a9f4);
        }
        .stat-num {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--primary-text-color, #212121);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .dot.online {
          background: var(--success-color, #43a047);
        }
        .dot.offline {
          background: var(--disabled-text-color, #9e9e9e);
        }
        /* Schmaler Bildschirm: Statusleiste über die ganze Breite, Teile
           gleich breit - wirkt als eigene Zeile ruhiger als eine halb
           gefüllte. Etwas knappere Abstände in der Werkzeugleiste lassen
           der Tabelle trotz Zähler mehr Platz als vorher. */
        @media (max-width: 600px) {
          .toolbar {
            padding: 12px 16px;
            gap: 10px;
          }
          .stats {
            flex: 1 1 100%;
          }
          .stat {
            flex: 1 1 0;
            padding: 6px;
          }
        }
        .reset-btn {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: none;
          color: var(--primary-text-color, #212121);
          font-size: 14px;
          cursor: pointer;
          white-space: nowrap;
        }
        .reset-btn:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .content {
          /* min-height: 0 ist nötig, damit sich das Flex-Kind auf den
             Restplatz begrenzen lässt statt auf die volle Tabellenhöhe
             anzuwachsen - erst dann greift overflow: auto. overscroll-
             behavior verhindert, dass iOS am Rand das ganze iframe
             mitzieht. */
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
          overscroll-behavior: contain;
          padding: 0 16px 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        thead th {
          /* sticky relativ zu .content (dem einzigen Scroll-Container):
             bleibt beim vertikalen Scrollen oben, läuft beim horizontalen
             mit seiner Spalte mit. z-index, damit Zellen mit eigener
             Positionierung (.actions-cell) beim Durchscrollen darunter und
             nicht darüber gezeichnet werden. */
          position: sticky;
          top: 0;
          z-index: 1;
          background: var(--primary-background-color, #fff);
          text-align: left;
          padding: 10px 12px;
          border-bottom: 2px solid var(--divider-color, #e0e0e0);
          color: var(--secondary-text-color, #727272);
          font-weight: 500;
          white-space: nowrap;
        }
        thead th.sortable {
          cursor: pointer;
          user-select: none;
        }
        thead th.sortable:hover {
          color: var(--primary-text-color, #212121);
        }
        thead th .sort-arrow {
          display: inline-block;
          width: 1em;
          opacity: 0.7;
        }
        tbody tr {
          border-bottom: 1px solid var(--divider-color, #eee);
        }
        tbody tr:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.03));
        }
        td {
          padding: 10px 12px;
          white-space: nowrap;
        }
        td.name-cell {
          white-space: normal;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge.online {
          background: rgba(76, 175, 80, 0.15);
          color: #2e7d32;
        }
        .badge.offline {
          background: rgba(158, 158, 158, 0.2);
          color: var(--secondary-text-color, #616161);
        }
        .badge.excluded {
          background: rgba(255, 152, 0, 0.15);
          color: #e65100;
          margin-left: 6px;
        }
        .actions-cell {
          position: relative;
          text-align: right;
        }
        .menu-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          padding: 6px 10px;
          border-radius: 50%;
          color: var(--secondary-text-color, #616161);
        }
        .menu-btn:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .menu {
          /* position: fixed statt absolute, und Position wird bei jedem
             Öffnen per JS anhand der echten Bildschirmkoordinaten des
             Buttons gesetzt (siehe _positionOpenMenu). Grund: .content
             scrollt (overflow: auto) und schneidet ein absolut
             positioniertes Menü nahe dem unteren Rand ab; fixed entkommt
             dem Scroll-Container, weil sich seine Position am Viewport
             orientiert statt an einem scrollenden Vorfahren. */
          position: fixed;
          z-index: 10;
          min-width: 220px;
          background: var(--card-background-color, #fff);
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          overflow: hidden;
        }
        .menu button {
          display: block;
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: var(--primary-text-color, #212121);
        }
        .menu button:hover:not(:disabled) {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .menu button:disabled {
          color: var(--disabled-text-color, #9e9e9e);
          cursor: default;
        }
        .menu button.destructive {
          color: var(--error-color, #b00020);
        }
        tbody tr[data-key] {
          cursor: pointer;
        }
        tbody tr[data-key]:focus-visible {
          outline: 2px solid var(--primary-color, #03a9f4);
          outline-offset: -2px;
        }
        /* Geräteansicht: natives <dialog> (showModal) - Hintergrund, Esc und
           Fokusfalle liefert der Browser. Auf dem Handy als Blatt von unten
           über die ganze Breite. Der Dialog selbst scrollt, Kopf und
           Aktionsleiste bleiben dabei per sticky sichtbar. */
        dialog.device {
          width: min(560px, calc(100vw - 32px));
          max-height: calc(100% - 48px);
          padding: 0;
          border: none;
          border-radius: 12px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          overflow: auto;
          overscroll-behavior: contain;
        }
        dialog.device::backdrop {
          background: rgba(0,0,0,0.45);
        }
        @media (max-width: 600px) {
          dialog.device {
            width: 100%;
            max-width: 100%;
            max-height: 90%;
            margin: auto 0 0;
            border-radius: 16px 16px 0 0;
          }
        }
        .dlg-head {
          position: sticky;
          top: 0;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 16px 12px 12px 20px;
          background: var(--card-background-color, #fff);
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .dlg-title {
          flex: 1 1 auto;
          min-width: 0;
        }
        .dlg-title h2 {
          margin: 4px 0 0;
          font-size: 20px;
          font-weight: 500;
          overflow-wrap: anywhere;
        }
        .dlg-close {
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 50%;
          background: none;
          color: var(--secondary-text-color, #727272);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }
        .dlg-close:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .dlg-body {
          padding: 8px 20px 16px;
        }
        .dlg-body h3 {
          margin: 20px 0 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color, #727272);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .fields {
          display: grid;
          grid-template-columns: max-content 1fr;
          gap: 10px 16px;
          margin: 8px 0 0;
          font-size: 14px;
        }
        .fields dt {
          color: var(--secondary-text-color, #727272);
        }
        .fields dd {
          margin: 0;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .fields dd small {
          display: block;
          color: var(--secondary-text-color, #727272);
        }
        .fields .badge.excluded {
          margin-left: 6px;
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .dlg-note {
          margin: 8px 0;
          color: var(--secondary-text-color, #727272);
          font-size: 14px;
        }
        .dlg-error {
          margin: 8px 0;
          padding: 10px 12px;
          border-radius: 8px;
          box-shadow: inset 0 0 0 999px rgba(176, 0, 32, 0.08);
          color: var(--error-color, #b00020);
          font-size: 14px;
        }
        .entities {
          list-style: none;
          margin: 0;
          padding: 0;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }
        .entities li + li {
          border-top: 1px solid var(--divider-color, #e0e0e0);
        }
        .entities li.entity {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-sizing: border-box;
          width: 100%;
          padding: 10px 12px;
          font-size: 14px;
          cursor: pointer;
        }
        .entities li.entity:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .ent-name {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .entities li.entity:focus-visible {
          outline: 2px solid var(--primary-color, #03a9f4);
          outline-offset: -2px;
        }
        .ent-id {
          display: flex;
          align-items: center;
          gap: 2px;
          min-width: 0;
        }
        .ent-id small {
          min-width: 0;
          color: var(--secondary-text-color, #727272);
          font-size: 12px;
          overflow-wrap: anywhere;
        }
        .copy-wrap {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          max-width: 100%;
        }
        .copy-wrap > span {
          min-width: 0;
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
          color: var(--secondary-text-color, #727272);
          cursor: pointer;
        }
        .copy-btn svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }
        .copy-btn:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.08));
          color: var(--primary-text-color, #212121);
        }
        .linked-link {
          padding: 0;
          border: none;
          background: none;
          color: var(--primary-color, #03a9f4);
          font: inherit;
          cursor: pointer;
          text-align: left;
        }
        .linked-link:hover {
          text-decoration: underline;
        }
        .linked-card {
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }
        .linked-main,
        .pick {
          display: block;
          box-sizing: border-box;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: none;
          color: inherit;
          font: inherit;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
        }
        .linked-main .ln-name {
          color: var(--primary-color, #03a9f4);
        }
        .linked-main:hover,
        .pick:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .linked-main small,
        .pick small {
          display: block;
          color: var(--secondary-text-color, #727272);
          font-size: 12px;
        }
        .linked-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0 12px 12px;
        }
        .linked-actions button,
        .link-add,
        .picker-bar button {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: none;
          color: var(--primary-text-color, #212121);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
        }
        .linked-actions button:hover,
        .link-add:hover,
        .picker-bar button:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .picker {
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }
        .picker-bar {
          display: flex;
          gap: 8px;
          padding: 8px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .picker-bar input {
          flex: 1 1 auto;
          min-width: 0;
          box-sizing: border-box;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--primary-background-color, #fff);
          color: var(--primary-text-color, #212121);
          /* 16px verhindert das automatische Hineinzoomen von iOS. */
          font-size: 16px;
        }
        /* Eigene Scrollfläche, damit die Liste den Dialog nicht endlos lang
           macht; Kopf und Aktionen des Dialogs bleiben erreichbar. */
        .picker-list {
          max-height: 320px;
          overflow: auto;
          overscroll-behavior: contain;
        }
        .picker-list .dlg-note {
          padding: 0 12px;
        }
        .pick + .pick {
          border-top: 1px solid var(--divider-color, #e0e0e0);
        }
        .pick.current {
          background: var(--secondary-background-color, rgba(0,0,0,0.04));
        }
        .picker-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          color: var(--secondary-text-color, #727272);
          font-size: 14px;
          cursor: pointer;
          user-select: none;
        }
        .picker-toggle input {
          width: 18px;
          height: 18px;
          margin: 0;
          accent-color: var(--primary-color, #03a9f4);
          cursor: pointer;
        }
        /* Bei einem anderen Client schon verknüpft: gedämpft, aber wählbar. */
        .pick.taken .ln-name {
          color: var(--secondary-text-color, #727272);
        }
        .pick small.pick-taken {
          color: var(--warning-color, #e65100);
        }
        .pick-group {
          padding: 10px 12px 4px;
          color: var(--secondary-text-color, #727272);
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .copy-btn.done {
          color: var(--success-color, #43a047);
        }
        .ent-state {
          flex: 0 0 auto;
          max-width: 50%;
          text-align: right;
          overflow-wrap: anywhere;
        }
        .dlg-actions {
          position: sticky;
          bottom: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
          background: var(--card-background-color, #fff);
          border-top: 1px solid var(--divider-color, #e0e0e0);
        }
        .dlg-actions button {
          flex: 1 1 auto;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: none;
          color: var(--primary-text-color, #212121);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
        }
        .dlg-actions button:hover:not(:disabled) {
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
        }
        .dlg-actions button:disabled {
          color: var(--disabled-text-color, #9e9e9e);
          cursor: default;
        }
        .dlg-actions button.destructive {
          color: var(--error-color, #b00020);
          border-color: currentColor;
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
          <input type="search" class="search" placeholder="${this._escape(
            t("searchPlaceholder")
          )}" value="${this._escape(this._search)}" />
          <button class="search-clear${
            this._search ? " visible" : ""
          }" title="${this._escape(t("clearSearch"))}" aria-label="${this._escape(
            t("clearSearch")
          )}">×</button>
        </div>
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
        <select class="filter-conn">
          <option value="all">${this._escape(t("filterConnAll"))}</option>
          <option value="wired">${this._escape(t("filterConnWired"))}</option>
          <option value="wireless">${this._escape(t("filterConnWireless"))}</option>
        </select>
        <button class="reset-btn">${this._escape(t("resetFilters"))}</button>
      </div>

      <div class="error-banner">
        <span class="error-text"></span>
        <button class="retry-btn">${this._escape(t("retry"))}</button>
      </div>

      <div class="content">
        <table>
          <thead>
            <tr>
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
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <dialog class="device"></dialog>
    `;

    const search = this.shadowRoot.querySelector(".search");
    const searchClear = this.shadowRoot.querySelector(".search-clear");
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
    this.shadowRoot.querySelector(".stats").addEventListener("click", (ev) => {
      const btn = ev.target.closest(".stat");
      if (!btn) return;
      const filter = btn.dataset.filter;
      this._onlineFilter =
        filter !== "all" && filter === this._onlineFilter ? "all" : filter;
      this._openMenuKey = null;
      this._renderRows();
      this._savePrefs();
    });

    // Wert aus den wiederhergestellten Einstellungen übernehmen: <select>
    // spiegelt kein JS-Feld automatisch, das Attribut im Template müsste
    // sonst das passende <option> mit "selected" markieren.
    const filterConn = this.shadowRoot.querySelector(".filter-conn");
    filterConn.value = this._connFilter;
    filterConn.addEventListener("change", (ev) => {
      this._connFilter = ev.target.value;
      this._renderRows();
      this._savePrefs();
    });

    this.shadowRoot.querySelector(".reset-btn").addEventListener("click", () => {
      this._search = DEFAULT_PREFS.search;
      this._onlineFilter = DEFAULT_PREFS.onlineFilter;
      this._connFilter = DEFAULT_PREFS.connFilter;
      this._sortKey = DEFAULT_PREFS.sortKey;
      this._sortDir = DEFAULT_PREFS.sortDir;
      search.value = this._search;
      searchClear.classList.remove("visible");
      filterConn.value = this._connFilter;
      this._openMenuKey = null;
      this._renderHeader();
      this._renderRows();
      this._savePrefs();
    });

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

  // Zählt über alle Hosts innerhalb des gewählten Verbindungsfilters
  // (Kabel/WLAN bestimmt, welche Gerätegruppe man anschaut), aber bewusst
  // ohne Suche und ohne Online/Offline-Filter: sonst stünde beim Tipp auf
  // "offline" bei "online" immer 0. Vor dem ersten Laden und wenn es noch
  // nie geklappt hat ein Strich statt einer falschen 0.
  _renderStats() {
    const root = this.shadowRoot;
    const stats = root && root.querySelector(".stats");
    if (!stats) return;
    const base = this._clients.filter((c) => this._matchesConn(c));
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
    const tbody = this.shadowRoot.querySelector("tbody");
    if (!tbody) return;

    this._renderStats();
    // Vor den frühen Rückgaben unten (Laden, leere Tabelle): der Dialog
    // hängt nicht davon ab, ob der Client gerade in der Tabelle sichtbar ist.
    this._renderDialog();

    const errorBanner = this.shadowRoot.querySelector(".error-banner");
    if (this._error) {
      errorBanner.style.display = "flex";
      errorBanner.style.alignItems = "center";
      this.shadowRoot.querySelector(".error-text").textContent =
        `${this._t("error")} ${this._error}`;
    } else {
      errorBanner.style.display = "none";
    }

    if (this._loading) {
      tbody.innerHTML = `<tr class="state-row"><td colspan="10">${this._escape(
        this._t("loading")
      )}</td></tr>`;
      return;
    }

    const rows = this._filteredClients();
    if (rows.length === 0) {
      tbody.innerHTML = `<tr class="state-row"><td colspan="10">${this._escape(
        this._t("empty")
      )}</td></tr>`;
      return;
    }

    const multiHost = this._hostCount > 1;

    tbody.innerHTML = rows
      .map((c) => {
        const key = `${c.entry_id}|${c.mac}`;
        const connText = c.is_wired == null
          ? this._t("connUnknown")
          : c.is_wired
          ? this._t("connWired")
          : this._t("connWireless");
        const statusBadge = c.online
          ? `<span class="badge online">${this._escape(this._t("statusOnline"))}</span>`
          : `<span class="badge offline">${this._escape(this._t("statusOffline"))}</span>`;
        const excludedBadge = c.excluded
          ? `<span class="badge excluded">${this._escape(this._t("excludedBadge"))}</span>`
          : "";
        const nameLine = multiHost
          ? `${this._escape(c.name)}<br><small style="color:var(--secondary-text-color)">${this._escape(
              c.host || ""
            )}</small>`
          : this._escape(c.name);

        const menuOpen = this._openMenuKey === key;
        const menu = menuOpen
          ? `
          <div class="menu">
            <button data-action="details">
              ${this._escape(this._t("menuDetails"))}
            </button>
            <button data-action="open-device" ${c.device_id ? "" : "disabled"}>
              ${this._escape(this._t("menuOpenDevice"))}
            </button>
            <button data-action="${c.excluded ? "unexclude" : "exclude"}">
              ${this._escape(c.excluded ? this._t("menuUnexclude") : this._t("menuExclude"))}
            </button>
            <button data-action="remove" class="destructive">
              ${this._escape(this._t("menuRemove"))}
            </button>
          </div>`
          : "";

        return `
          <tr data-key="${this._escape(key)}" tabindex="0"
              data-entry-id="${this._escape(c.entry_id)}"
              data-mac="${this._escape(c.mac)}"
              data-name="${this._escape(c.name)}"
              data-device-id="${this._escape(c.device_id || "")}">
            <td class="name-cell">${nameLine}${excludedBadge}</td>
            <td>${
              c.linked_device
                ? `<button class="linked-link" data-action="open-linked" data-linked-id="${this._escape(
                    c.linked_device.id
                  )}" title="${this._escape(
                    this._t("linkOpen")(c.linked_device.name)
                  )}">${this._escape(c.linked_device.name)}</button>`
                : "–"
            }</td>
            <td>${this._escape(c.ip || "–")}</td>
            <td>${this._escape(c.mac)}</td>
            <td>${this._escape(c.essid || "–")}</td>
            <td>${this._escape(c.ap_name || "–")}</td>
            <td>${this._escape(connText)}</td>
            <td>${this._escape(this._formatSeen(c.seen_at))}</td>
            <td>${statusBadge}</td>
            <td class="actions-cell">
              <button class="menu-btn" title="⋮">⋮</button>
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
