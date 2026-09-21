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
 * unifi_dynamic/remove_client und unifi_dynamic/exclude_client aus
 * __init__.py - dünne Wrapper um dieselbe Coordinator-Logik, die auch die
 * Push-Aktionen und der Service unifi_dynamic.remove_client nutzen.
 */

const STRINGS = {
  de: {
    title: "UniFi Dynamic Clients",
    searchPlaceholder: "Suche (Name, IP, MAC, SSID, AP)…",
    filterOnlineAll: "Alle",
    filterOnlineOnline: "Online",
    filterOnlineOffline: "Offline",
    filterConnAll: "Alle Verbindungen",
    filterConnWired: "Kabel",
    filterConnWireless: "WLAN",
    colName: "Alias",
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
    menuOpenDevice: "Geräteseite öffnen",
    menuExclude: "Nie entfernen",
    menuExcluded: "Bereits auf Ausnahmeliste",
    menuRemove: "Jetzt entfernen",
    confirmRemove: (name) =>
      `${name} jetzt entfernen? Ist der Client noch aktiv, wird er beim nächsten Abgleich neu angelegt.`,
    empty: "Keine Clients gefunden.",
    loading: "Lädt…",
    error: "Fehler beim Laden der Clientliste:",
    retry: "Erneut versuchen",
    multiHost: "Host",
    seenNever: "–",
  },
  en: {
    title: "UniFi Dynamic Clients",
    searchPlaceholder: "Search (name, IP, MAC, SSID, AP)…",
    filterOnlineAll: "All",
    filterOnlineOnline: "Online",
    filterOnlineOffline: "Offline",
    filterConnAll: "All connections",
    filterConnWired: "Wired",
    filterConnWireless: "Wireless",
    colName: "Alias",
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
    menuOpenDevice: "Open device page",
    menuExclude: "Never remove",
    menuExcluded: "Already on exclusion list",
    menuRemove: "Remove now",
    confirmRemove: (name) =>
      `Remove ${name} now? If the client is still active, it will be recreated on the next sync.`,
    empty: "No clients found.",
    loading: "Loading…",
    error: "Failed to load the client list:",
    retry: "Retry",
    multiHost: "Host",
    seenNever: "–",
  },
};

function pickLang(hass) {
  const lang = String((hass && hass.language) || "").toLowerCase();
  return lang === "de" || lang.startsWith("de-") ? "de" : "en";
}

const POLL_INTERVAL_MS = 10000;

class UnifiDynamicPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._clients = [];
    this._hostCount = 0;
    this._loading = true;
    this._error = null;
    this._search = "";
    this._onlineFilter = "all";
    this._connFilter = "all";
    this._sortKey = null;
    this._sortDir = "asc";
    this._openMenuKey = null;
    this._pollTimer = null;
    this._built = false;
  }

  // Wird von Home Assistant gesetzt, bei jeder State-Änderung neu.
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
  }

  disconnectedCallback() {
    this._stopPolling();
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
  }

  async _removeClient(entryId, mac) {
    await this._hass.callWS({
      type: "unifi_dynamic/remove_client",
      entry_id: entryId,
      mac,
    });
    await this._fetchClients();
  }

  async _excludeClient(entryId, mac) {
    await this._hass.callWS({
      type: "unifi_dynamic/exclude_client",
      entry_id: entryId,
      mac,
    });
    await this._fetchClients();
  }

  _openDevice(deviceId) {
    if (!deviceId) return;
    history.pushState(null, "", `/config/devices/device/${deviceId}`);
    window.dispatchEvent(
      new CustomEvent("location-changed", { bubbles: true, composed: true })
    );
  }

  _filteredClients() {
    const q = this._search.trim().toLowerCase();
    const rows = this._clients.filter((c) => {
      if (this._onlineFilter === "online" && !c.online) return false;
      if (this._onlineFilter === "offline" && c.online) return false;
      if (this._connFilter === "wired" && !c.is_wired) return false;
      if (this._connFilter === "wireless" && c.is_wired) return false;
      if (!q) return true;
      const haystack = [c.name, c.ip, c.mac, c.essid, c.ap_name]
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
  }

  // Toolbar, Tabellenkopf und Grundgerüst stehen fest; nur der <tbody>
  // wird bei jeder Aktualisierung neu gerendert. So verliert das Suchfeld
  // beim Live-Polling nie Fokus oder Cursorposition.
  _buildStaticLayout() {
    const t = (k) => this._t(k);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          background: var(--primary-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
        }
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          background: var(--card-background-color, #fff);
        }
        .toolbar h1 {
          flex: 1 1 auto;
          margin: 0;
          font-size: 20px;
          font-weight: 400;
        }
        input[type="search"] {
          flex: 1 1 260px;
          min-width: 180px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--primary-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 14px;
        }
        select {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--primary-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 14px;
        }
        .content {
          padding: 0 16px 16px;
          overflow: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        thead th {
          position: sticky;
          top: 0;
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
          position: absolute;
          right: 8px;
          top: 36px;
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
        .state-row td {
          text-align: center;
          padding: 40px 12px;
          color: var(--secondary-text-color, #727272);
        }
        .error-banner {
          margin: 16px;
          padding: 12px 16px;
          border-radius: 8px;
          background: rgba(176, 0, 32, 0.08);
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
        <h1>${this._escape(t("title"))}</h1>
        <input type="search" class="search" placeholder="${this._escape(
          t("searchPlaceholder")
        )}" />
        <select class="filter-online">
          <option value="all">${this._escape(t("filterOnlineAll"))}</option>
          <option value="online">${this._escape(t("filterOnlineOnline"))}</option>
          <option value="offline">${this._escape(t("filterOnlineOffline"))}</option>
        </select>
        <select class="filter-conn">
          <option value="all">${this._escape(t("filterConnAll"))}</option>
          <option value="wired">${this._escape(t("filterConnWired"))}</option>
          <option value="wireless">${this._escape(t("filterConnWireless"))}</option>
        </select>
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
    `;

    const search = this.shadowRoot.querySelector(".search");
    search.addEventListener("input", () => {
      this._search = search.value;
      this._openMenuKey = null;
      this._renderRows();
    });

    this.shadowRoot
      .querySelector(".filter-online")
      .addEventListener("change", (ev) => {
        this._onlineFilter = ev.target.value;
        this._renderRows();
      });

    this.shadowRoot.querySelector(".filter-conn").addEventListener("change", (ev) => {
      this._connFilter = ev.target.value;
      this._renderRows();
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
      if (action === "open-device") {
        this._openDevice(deviceId);
      } else if (action === "exclude") {
        this._excludeClient(entryId, mac);
      } else if (action === "remove") {
        if (window.confirm(this._t("confirmRemove")(name))) {
          this._removeClient(entryId, mac);
        }
      }
      this._renderRows();
      return;
    }

    // Klick auf die Zeile ausserhalb von Menü und Aktionen: bewusst ohne
    // Wirkung. Ein Klick auf die Zeile öffnete früher die Geräteseite,
    // was beim schnellen Scrollen/Klicken in der Tabelle leicht ungewollt
    // ausgelöst wurde. Die Geräteseite ist jetzt ausschliesslich über den
    // Menüpunkt "Geräteseite öffnen" erreichbar.
  }

  _renderRows() {
    if (!this.shadowRoot) return;
    const tbody = this.shadowRoot.querySelector("tbody");
    if (!tbody) return;

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
      tbody.innerHTML = `<tr class="state-row"><td colspan="9">${this._escape(
        this._t("loading")
      )}</td></tr>`;
      return;
    }

    const rows = this._filteredClients();
    if (rows.length === 0) {
      tbody.innerHTML = `<tr class="state-row"><td colspan="9">${this._escape(
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
            <button data-action="open-device" ${c.device_id ? "" : "disabled"}>
              ${this._escape(this._t("menuOpenDevice"))}
            </button>
            <button data-action="exclude" ${c.excluded ? "disabled" : ""}>
              ${this._escape(c.excluded ? this._t("menuExcluded") : this._t("menuExclude"))}
            </button>
            <button data-action="remove" class="destructive">
              ${this._escape(this._t("menuRemove"))}
            </button>
          </div>`
          : "";

        return `
          <tr data-key="${this._escape(key)}"
              data-entry-id="${this._escape(c.entry_id)}"
              data-mac="${this._escape(c.mac)}"
              data-name="${this._escape(c.name)}"
              data-device-id="${this._escape(c.device_id || "")}">
            <td class="name-cell">${nameLine}${excludedBadge}</td>
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
  }
}

customElements.define("unifi-dynamic-panel", UnifiDynamicPanel);
