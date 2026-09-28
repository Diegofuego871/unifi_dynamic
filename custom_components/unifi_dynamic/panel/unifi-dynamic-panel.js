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
    columnsDefault: "Standard",
    columnsDrag: (label) => `${label} verschieben (ziehen oder Pfeiltasten)`,
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
    hubAll: "Alle Hubs",
    hubSelect: "Hub wählen",
    hubClients: (n) => (n === 1 ? "1 Client" : `${n} Clients`),
    settingsBtn: "Einstellungen",
    settingsNeedHub: "Einstellungen gelten pro Hub – zuerst einen Hub wählen",
    settingsTitle: "Einstellungen",
    settingsLoading: "Einstellungen werden geladen…",
    settingsLoadError: "Einstellungen konnten nicht geladen werden:",
    settingsSaveError: "Speichern fehlgeschlagen:",
    settingsChanged: "geändert",
    settingsChanges: (n) => (n === 1 ? "1 Änderung" : `${n} Änderungen`),
    settingsReloadNote:
      "Beim Speichern lädt die Integration kurz neu (Abfrageintervall oder Uhrzeit geändert). Die Entitäten sind 1–2 Sekunden nicht verfügbar.",
    settingsCancel: "Abbrechen",
    settingsSave: "Speichern",
    settingsSaving: "Speichert…",
    settingsSaved: "Einstellungen gespeichert.",
    settingsSavedReload: "Einstellungen gespeichert – die Integration lädt kurz neu.",
    settingsInfo: "Mehr erfahren",
    settingsRange: (min, max) => `Erlaubt: ${min}–${max}`,
    settingsTimeError: "Uhrzeit im Format HH:MM",
    secPolling: "Abfrage",
    secCleanup: "Automatisches Entfernen",
    secPush: "Push-Benachrichtigung",
    secPersistent: "Anhaltende Benachrichtigung",
    sumPolling: (i, n) => `Alle ${i} s · ausgefallen nach ${n} Abfragen`,
    sumCleanup: (d, time) => (d ? `Nach ${d} Tagen ohne Sichtung · täglich ${time}` : "Ausgeschaltet"),
    sumPushOff: "Keine Push-Benachrichtigung",
    sumPersistentOff: "Ausgeschaltet",
    sumNew: "neue Geräte",
    sumController: "Controller-Ausfall",
    sumEmpty: "auch ohne Treffer",
    sumReport: "Bericht des Aufräumlaufs",
    unitSeconds: "s",
    unitPolls: "Abfragen",
    unitDays: "Tagen",
    optScanInterval: "Abfrageintervall",
    optScanIntervalShort: "Wie oft die Clientliste geholt wird (10–3600 s).",
    optScanIntervalInfo:
      "Kürzere Intervalle erkennen Wechsel schneller, belasten den Controller aber stärker. Änderungen laden die Integration kurz neu.",
    optOfflineAfter: "Als ausgefallen nach",
    optOfflineAfterLive: (i, dur) => `Bei ${i} s Intervall: nach ${dur}`,
    optOfflineAfterInfo:
      "Zählt fehlgeschlagene Abfragen in Folge. Niedrige Werte melden schneller, reagieren aber auch auf einzelne Aussetzer. Die Entwarnung kommt mit der ersten erfolgreichen Abfrage.",
    optPurgeDays: "Entfernen nach",
    optPurgeDaysShort: "Tage ohne Sichtung, 0 schaltet es aus.",
    optPurgeDaysInfo:
      "Wer länger nicht gesehen wurde, verliert beim täglichen Lauf seine Entitäten und sein Gerät in Home Assistant. Geschützte Clients sind ausgenommen.",
    optPurgeTime: "Uhrzeit des täglichen Laufs",
    optPurgeTimeShort: "Lokale Zeit.",
    optPurgeTimeInfo:
      "Zusätzlich läuft eine Prüfung 60 Sekunden nach jedem Start von Home Assistant; sie meldet nur, wenn etwas entfernt wurde. Manuell auslösbar über die Aktion unifi_dynamic.purge_now, auch als Testlauf. Änderungen laden die Integration kurz neu.",
    optProtected: "Geschützte Clients",
    optProtectedShort: "Werden nie automatisch entfernt.",
    optProtectedInfo: "Hinzufügen über \"Schützen\" in der Tabelle oder in der Geräteansicht.",
    optProtectedNone: "Keine geschützten Clients.",
    optProtectedUnknown: "nicht mehr bekannt",
    optUnprotect: (name) => `Schutz für ${name} aufheben`,
    optNotifyService: "Ziel",
    optNotifyServiceShort: "notify-Dienst oder -Entität.",
    optNotifyServiceInfo: "Zum Beispiel eine notify-Gruppe, um mehrere Handys zu erreichen.",
    optNotifyNone: "Keine Push-Benachrichtigung",
    optNotifyMissing: "nicht gefunden",
    optClickTarget: "Tipp auf Gerätemeldung öffnet",
    optClickTargetShort: "Wohin die Meldung zu einem Client führt.",
    optClickTargetInfo:
      "\"Geräteansicht im Panel\" zeigt Details und Aktionen, auch ohne HA-Gerät. \"HA-Geräteseite\" ist für alle ohne Panel gedacht. Sammel- und Controller-Meldungen öffnen immer die Integrationsseite.",
    optClickPanel: "Geräteansicht im Panel",
    optClickDevice: "HA-Geräteseite",
    optNotifyNew: "Neue Geräte melden",
    optNotifyNewShort: "Sobald ein Client zum ersten Mal auftaucht.",
    optNotifyNewInfo:
      "Wartet bis zu 120 Sekunden, bis IP, SSID und Access Point bekannt sind. Ab 6 Clients gleichzeitig kommt eine Sammelmeldung. Nach der Installation wird bewusst nichts gemeldet.",
    optNotifyController: "Controller-Ausfall melden",
    optNotifyControllerShort: "Einmal je Störung, mit Entwarnung.",
    optNotifyControllerInfo:
      "Ab wann der Controller als ausgefallen gilt, legt \"Als ausgefallen nach\" fest. Während der Störung werden keine Clients aktualisiert.",
    optNotifyEmpty: "Auch ohne Treffer melden",
    optNotifyEmptyShort: "Push nach jedem täglichen Lauf.",
    optContent: "Inhalt der Meldung",
    optContentShort: "Welche Angaben in der Meldung über neue Geräte stehen.",
    optContentInfo:
      "Ist alles aus, wird der Anzeigename gemeldet. SSID und Access Point gibt es nur bei WLAN-Clients. Die MAC wird weggelassen, wenn sie schon der Name ist.",
    msgName: "Anzeigename",
    msgConnection: "Verbindungsart",
    msgSsid: "SSID",
    msgAp: "Access Point",
    msgIp: "IP-Adresse",
    msgMac: "MAC-Adresse",
    optPersistent: "Anhaltende Benachrichtigung",
    optPersistentShort: "Bericht des Aufräumlaufs in der Seitenleiste.",
    optPersistentInfo: "Neu erkannte Geräte erzeugen nie eine anhaltende Benachrichtigung.",
    optPersistentEmpty: "Auch ohne Treffer",
    optPersistentEmptyShort: "Sonst nur, wenn etwas entfernt wurde.",
    optPersistentEmptyInfo: "Aus heisst: Die letzte Meldung bleibt stehen und zeigt den letzten echten Lauf.",
    optPersistentController: "Controller-Ausfall",
    optPersistentControllerShort: "Solange der Controller nicht antwortet.",
    optPersistentControllerInfo: "Verschwindet automatisch, sobald er wieder erreichbar ist.",
    secAvail: "Verfügbarkeit",
    secCtlAvail: "Controller-Verfügbarkeit",
    verName: (v) => `UniFi Dynamic Clients ${v}`,
    verCurrent: "Aktuell",
    verChecked: (rel) => `zuletzt geprüft ${rel}`,
    verCheck: "Nach Updates suchen",
    verChecking: "Prüft…",
    verCheckingSub: "Suche nach Updates…",
    verCheckError: "Prüfung fehlgeschlagen:",
    verAvailable: (v) => `Version ${v} verfügbar`,
    verInstalledVia: (v, hacs) => `Installiert: ${v}${hacs ? " · über HACS" : ""}`,
    verNoHacs: "Installation über HACS oder manuell (siehe Release Notes).",
    verReleaseNotes: "Release Notes",
    verUpdate: "Aktualisieren",
    verInstalling: (v) => `Wird aktualisiert auf ${v}…`,
    verInstallingSub: "HACS lädt die neue Version herunter",
    verInstallError: "Aktualisieren fehlgeschlagen:",
    verRestartNeeded: (v) => `${v} installiert – Neustart nötig`,
    verRestartSub: "Aktiv wird die neue Version erst nach einem Neustart von Home Assistant.",
    verRestart: "Jetzt neu starten",
    verRestartConfirm: "Home Assistant jetzt neu starten? Alle Integrationen sind dabei kurz nicht verfügbar.",
    verRestarting: "Home Assistant startet neu…",
    availCtlNoData: "Noch keine Daten – die Aufzeichnung läuft seit dem Update auf 2.9.0.",
    availRanges: { "24h": "24 Std.", "7d": "7 Tage", "30d": "30 Tage" },
    availRangeGroup: "Zeitraum",
    availLoading: "Verlauf wird geladen…",
    availLoadingWords: [
      "Balanciert durch den Verlauf…",
      "Wackelt. Fällt nicht. Wie der Controller.",
      "Ein Elefant vergisst nichts, er rollt nur langsam.",
      "Gleich drüben…",
    ],
    availError: "Verlauf nicht verfügbar:",
    availNoEntity: "Keine Online-Entität gefunden - ohne HA-Gerät gibt es keinen Verlauf.",
    availNoData: "Keine Verlaufsdaten im Recorder für diesen Zeitraum.",
    availAlways: "Durchgehend erreichbar",
    availNever: "Im ganzen Zeitraum nicht erreichbar",
    availOutages: (n) => (n === 1 ? "1 Unterbruch" : `${n} Unterbrüche`),
    availTotal: (d) => `zusammen ${d}`,
    availLongest: (d) => `längster ${d}`,
    availSince: (time) => `erst seit ${time} Daten`,
    availOnline: "Erreichbar",
    availOffline: "Unterbruch",
    availNone: "Keine Daten",
    availNow: "jetzt",
    availOngoing: "läuft",
    availMore: (n) => `${n} ältere Unterbrüche nicht aufgelistet.`,
    availTip: "Offline",
    durMin: (n) => `${n} Min.`,
    durHour: (h, m) => (m ? `${h} Std. ${m} Min.` : `${h} Std.`),
    durDay: (d, h) => (h ? `${d} T. ${h} Std.` : `${d} T.`),
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
    columnsDefault: "Default",
    columnsDrag: (label) => `Move ${label} (drag or arrow keys)`,
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
    hubAll: "All hubs",
    hubSelect: "Choose hub",
    hubClients: (n) => (n === 1 ? "1 client" : `${n} clients`),
    settingsBtn: "Settings",
    settingsNeedHub: "Settings apply per hub – choose a hub first",
    settingsTitle: "Settings",
    settingsLoading: "Loading settings…",
    settingsLoadError: "Could not load the settings:",
    settingsSaveError: "Saving failed:",
    settingsChanged: "changed",
    settingsChanges: (n) => (n === 1 ? "1 change" : `${n} changes`),
    settingsReloadNote:
      "Saving briefly reloads the integration (update interval or time changed). The entities are unavailable for 1–2 seconds.",
    settingsCancel: "Cancel",
    settingsSave: "Save",
    settingsSaving: "Saving…",
    settingsSaved: "Settings saved.",
    settingsSavedReload: "Settings saved – the integration is reloading.",
    settingsInfo: "Learn more",
    settingsRange: (min, max) => `Allowed: ${min}–${max}`,
    settingsTimeError: "Time as HH:MM",
    secPolling: "Polling",
    secCleanup: "Automatic removal",
    secPush: "Push notification",
    secPersistent: "Persistent notification",
    sumPolling: (i, n) => `Every ${i} s · offline after ${n} polls`,
    sumCleanup: (d, time) => (d ? `After ${d} days unseen · daily at ${time}` : "Off"),
    sumPushOff: "No push notification",
    sumPersistentOff: "Off",
    sumNew: "new devices",
    sumController: "controller outage",
    sumEmpty: "also without hits",
    sumReport: "Cleanup report",
    unitSeconds: "s",
    unitPolls: "polls",
    unitDays: "days",
    optScanInterval: "Update interval",
    optScanIntervalShort: "How often the client list is fetched (10–3600 s).",
    optScanIntervalInfo:
      "Shorter intervals detect changes faster but put more load on the controller. Changes briefly reload the integration.",
    optOfflineAfter: "Offline after",
    optOfflineAfterLive: (i, dur) => `At a ${i} s interval: after ${dur}`,
    optOfflineAfterInfo:
      "Counts failed polls in a row. Low values report faster but also react to single hiccups. The all-clear comes with the first successful poll.",
    optPurgeDays: "Remove after",
    optPurgeDaysShort: "Days unseen, 0 turns it off.",
    optPurgeDaysInfo:
      "Clients unseen for longer lose their entities and device in Home Assistant during the daily run. Protected clients are exempt.",
    optPurgeTime: "Time of the daily run",
    optPurgeTimeShort: "Local time.",
    optPurgeTimeInfo:
      "In addition, a check runs 60 seconds after every Home Assistant start; it only reports when something was removed. Can be triggered manually with the unifi_dynamic.purge_now action, also as a dry run. Changes briefly reload the integration.",
    optProtected: "Protected clients",
    optProtectedShort: "Never removed automatically.",
    optProtectedInfo: "Add clients with \"Protect\" in the table or in the device view.",
    optProtectedNone: "No protected clients.",
    optProtectedUnknown: "no longer known",
    optUnprotect: (name) => `Stop protecting ${name}`,
    optNotifyService: "Target",
    optNotifyServiceShort: "notify service or entity.",
    optNotifyServiceInfo: "For example a notify group to reach several phones.",
    optNotifyNone: "No push notification",
    optNotifyMissing: "not found",
    optClickTarget: "Tapping a device notification opens",
    optClickTargetShort: "Where the notification about a client leads.",
    optClickTargetInfo:
      "\"Device view in the panel\" shows details and actions, even without a HA device. \"HA device page\" is for anyone not using the panel. Summary and controller notifications always open the integration page.",
    optClickPanel: "Device view in the panel",
    optClickDevice: "HA device page",
    optNotifyNew: "Report new devices",
    optNotifyNewShort: "As soon as a client appears for the first time.",
    optNotifyNewInfo:
      "Waits up to 120 seconds until IP, SSID and access point are known. From 6 clients at once a summary is sent. Nothing is reported right after installation.",
    optNotifyController: "Report controller outage",
    optNotifyControllerShort: "Once per outage, with all-clear.",
    optNotifyControllerInfo:
      "When the controller counts as down is set by \"Offline after\". During the outage no clients are updated.",
    optNotifyEmpty: "Also report without hits",
    optNotifyEmptyShort: "Push after every daily run.",
    optContent: "Notification content",
    optContentShort: "Which details the notification about new devices contains.",
    optContentInfo:
      "If everything is off, the display name is sent. SSID and access point only exist for wireless clients. The MAC is left out when it already is the name.",
    msgName: "Display name",
    msgConnection: "Connection type",
    msgSsid: "SSID",
    msgAp: "Access point",
    msgIp: "IP address",
    msgMac: "MAC address",
    optPersistent: "Persistent notification",
    optPersistentShort: "Cleanup report in the sidebar.",
    optPersistentInfo: "Newly detected devices never create a persistent notification.",
    optPersistentEmpty: "Also without hits",
    optPersistentEmptyShort: "Otherwise only when something was removed.",
    optPersistentEmptyInfo: "Off means: the last notification stays and shows the last real run.",
    optPersistentController: "Controller outage",
    optPersistentControllerShort: "While the controller doesn't respond.",
    optPersistentControllerInfo: "Disappears automatically once it is reachable again.",
    secAvail: "Availability",
    secCtlAvail: "Controller availability",
    verName: (v) => `UniFi Dynamic Clients ${v}`,
    verCurrent: "Up to date",
    verChecked: (rel) => `last checked ${rel}`,
    verCheck: "Check for updates",
    verChecking: "Checking…",
    verCheckingSub: "Looking for updates…",
    verCheckError: "Check failed:",
    verAvailable: (v) => `Version ${v} available`,
    verInstalledVia: (v, hacs) => `Installed: ${v}${hacs ? " · via HACS" : ""}`,
    verNoHacs: "Install via HACS or manually (see release notes).",
    verReleaseNotes: "Release notes",
    verUpdate: "Update",
    verInstalling: (v) => `Updating to ${v}…`,
    verInstallingSub: "HACS is downloading the new version",
    verInstallError: "Update failed:",
    verRestartNeeded: (v) => `${v} installed – restart required`,
    verRestartSub: "The new version only becomes active after restarting Home Assistant.",
    verRestart: "Restart now",
    verRestartConfirm: "Restart Home Assistant now? All integrations are briefly unavailable.",
    verRestarting: "Home Assistant is restarting…",
    availCtlNoData: "No data yet – recording started with the update to 2.9.0.",
    availRanges: { "24h": "24 h", "7d": "7 days", "30d": "30 days" },
    availRangeGroup: "Time range",
    availLoading: "Loading history…",
    availLoadingWords: [
      "Balancing through the history…",
      "Wobbles. Doesn't fall. Like the controller.",
      "An elephant never forgets, it just rolls slowly.",
      "Almost there…",
    ],
    availError: "History not available:",
    availNoEntity: "No online entity found - without a HA device there is no history.",
    availNoData: "No history data in the recorder for this time range.",
    availAlways: "Reachable the whole time",
    availNever: "Not reachable during the whole time range",
    availOutages: (n) => (n === 1 ? "1 outage" : `${n} outages`),
    availTotal: (d) => `${d} in total`,
    availLongest: (d) => `longest ${d}`,
    availSince: (time) => `data only since ${time}`,
    availOnline: "Reachable",
    availOffline: "Outage",
    availNone: "No data",
    availNow: "now",
    availOngoing: "ongoing",
    availMore: (n) => `${n} older outages not listed.`,
    availTip: "Offline",
    durMin: (n) => `${n} min`,
    durHour: (h, m) => (m ? `${h} h ${m} min` : `${h} h`),
    durDay: (d, h) => (h ? `${d} d ${h} h` : `${d} d`),
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
const SORT_KEYS = ["name", "linked", "ip", "mac", "essid", "ap_name", "conn", "seen_at", "status"];
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
  gear: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  hub: "M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z",
  verOk: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z",
  verUp: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 7L17 12H14V16H10V12H7L12 7Z",
  verCheck: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  verDownload: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  chevron: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  drag: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
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
};

// Zeitraum -> Dauer in Sekunden.
const AVAIL_RANGES = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400 };
// Verlauf höchstens so lange aus dem Zwischenspeicher zeigen, dann neu holen.
const AVAIL_MAX_AGE_MS = 60000;
// Kurze Lücken ohne Daten zwischen zwei gleichen Zuständen gelten als
// durchgehend: typisch ein Neustart von Home Assistant, während dem weder
// das eigene Protokoll noch der Recorder etwas aufzeichnen. Betrifft nur
// "keine Daten", nie echte Unterbrüche; längere Lücken bleiben sichtbar.
const AVAIL_BRIDGE_MS = 5 * 60 * 1000;
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
    }
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
      this._lastFetchAt = new Date();
      this._error = null;
    } catch (err) {
      this._error = (err && err.message) || String(err);
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
    if (select.innerHTML !== html) select.innerHTML = html;
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
    } catch (err) {
      if (!this._settings) return;
      this._settings.error = (err && err.message) || String(err);
    }
    this._settings.loading = false;
    this._renderSettings();
  }

  _closeSettings() {
    const dialog = this.shadowRoot.querySelector("dialog.settings");
    this._settings = null;
    if (dialog && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }

  // Geänderte Schlüssel gegenüber dem geladenen Stand.
  _settingsChanges() {
    const st = this._settings;
    if (!st || !st.draft) return [];
    return Object.keys(st.draft).filter(
      (k) => JSON.stringify(st.draft[k]) !== JSON.stringify(st.data.values[k])
    );
  }

  // Fehlermeldung je Feld, leer wenn gültig.
  _settingsErrors() {
    const st = this._settings;
    const errors = {};
    if (!st || !st.draft) return errors;
    const limits = st.data.limits || {};
    for (const key of ["scan_interval", "offline_after_failures", "purge_days"]) {
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
    ];
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
        <button class="dlg-btn primary" data-set="save" ${canSave ? "" : "disabled"}>${esc(
          st.saving ? t("settingsSaving") : t("settingsSave")
        )}</button>
      </div>`;
    const scroll = dialog.scrollTop;
    const active = this.shadowRoot.activeElement;
    const focusKey = active && active.dataset ? active.dataset.opt || active.dataset.set : null;
    dialog.innerHTML = `${head}<div class="dlg-body">${body}</div>${actions}`;
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
    };
    const titles = { polling: "secPolling", cleanup: "secCleanup", push: "secPush", persistent: "secPersistent" };
    const reload = changes.has("scan_interval") || changes.has("purge_time");
    return (
      `<div class="ver-slot">${this._versionHtml()}</div>` +
      `<div class="avail-slot">${this._settingsAvailHtml()}</div>` +
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
      (reload ? `<div class="set-note">${esc(t("settingsReloadNote"))}</div>` : "") +
      (st.saveError ? `<div class="dlg-error">${esc(t("settingsSaveError"))} ${esc(st.saveError)}</div>` : "")
    );
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

  // Einfacher Versionsvergleich (1.2.10 > 1.2.9, führendes v egal).
  _cmpVersion(a, b) {
    const parts = (v) => String(v || "").replace(/^v/i, "").split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
    const x = parts(a);
    const y = parts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  async _loadVersion(force = false) {
    this._version = this._version || {};
    const v = this._version;
    if (force) v.checking = true;
    v.error = null;
    this._renderSettingsVersion();
    const hacs = this._hacsUpdateEntity();
    const jobs = [
      this._hass.callWS({ type: "unifi_dynamic/version", force }).then(
        (r) => (v.data = r),
        (err) => (v.error = (err && err.message) || String(err))
      ),
    ];
    // HACS prüft sonst nur periodisch: auf Knopfdruck sofort neu abfragen.
    if (force && hacs && typeof this._hass.callService === "function") {
      jobs.push(
        this._hass
          .callService("homeassistant", "update_entity", { entity_id: hacs.entity_id })
          .catch(() => null)
      );
    }
    await Promise.all(jobs);
    v.checking = false;
    if (v.data && v.data.error && !v.data.latest) v.error = v.data.error;
    this._renderSettingsVersion();
  }

  _versionState() {
    const v = this._version || {};
    const d = v.data || {};
    const hacs = this._hacsUpdateEntity();
    const a = (hacs && hacs.attributes) || {};
    const installed = d.installed || a.installed_version || null;
    let latest = d.latest || null;
    let url = d.release_url || null;
    if (a.latest_version && (!latest || this._cmpVersion(a.latest_version, latest) >= 0)) {
      latest = a.latest_version;
      url = a.release_url || url;
    }
    const inProgress = Boolean(hacs && (a.in_progress === true || typeof a.in_progress === "number"));
    // HACS hat eine neuere Version auf die Platte gelegt, als gerade läuft.
    const restart = Boolean(hacs && a.installed_version && installed && this._cmpVersion(a.installed_version, installed) > 0);
    return { v, d, hacs, a, installed, latest, url, inProgress, restart };
  }

  _versionHtml() {
    const t = (k) => this._t(k);
    const esc = (x) => this._escape(x);
    const { v, d, hacs, a, installed, latest, url, inProgress, restart } = this._versionState();
    if (!installed && !v.data && !v.error) return "";
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
        : hacs
        ? t("verInstalledVia")(installed, true)
        : `${t("verInstalledVia")(installed, false)} · ${t("verNoHacs")}`;
      return row(
        "upd",
        "verUp",
        t("verAvailable")(latest),
        sub,
        `${notes}${
          hacs ? `<button type="button" class="ver-btn primary" data-ver="install">${icon("verDownload")}${esc(t("verUpdate"))}</button>` : ""
        }`
      );
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
      `<button type="button" class="ver-btn" data-ver="check" ${v.checking ? "disabled" : ""}>${
        v.checking ? `<span class="ver-spin"></span>${esc(t("verChecking"))}` : `${icon("verCheck")}${esc(t("verCheck"))}`
      }</button>`
    );
  }

  _renderSettingsVersion() {
    const slot = this.shadowRoot && this.shadowRoot.querySelector("dialog.settings .ver-slot");
    if (!slot) return;
    const html = this._versionHtml();
    if (slot.innerHTML !== html) slot.innerHTML = html;
  }

  async _versionAction(action) {
    const v = (this._version = this._version || {});
    if (action === "check") {
      await this._loadVersion(true);
    } else if (action === "install") {
      const { hacs, a, latest } = this._versionState();
      if (!hacs) return;
      const data = { entity_id: hacs.entity_id };
      // Kennt HACS die neueste Version noch nicht (GitHub war schneller),
      // gezielt diese installieren - sofern die Entität das unterstützt.
      if (latest && a.latest_version && this._cmpVersion(latest, a.latest_version) > 0 && (a.supported_features & 2)) {
        data.version = latest;
      }
      v.installing = latest;
      v.installError = null;
      this._renderSettingsVersion();
      try {
        await this._hass.callService("update", "install", data);
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
        await this._hass.callService("homeassistant", "restart", {});
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

  _settingsAvailHtml() {
    const src = this._settingsAvailSrc();
    return src ? this._availSectionHtml(null, src) : "";
  }

  // Nur den Zeitstrahl ersetzen (Verlauf nachgeladen, Zeitraum gewechselt):
  // Eingaben und Aufklappzustand im Rest des Dialogs bleiben unberührt.
  _renderSettingsAvail() {
    const slot = this.shadowRoot && this.shadowRoot.querySelector("dialog.settings .avail-slot");
    if (!slot) return;
    const html = this._settingsAvailHtml();
    if (slot.innerHTML !== html) slot.innerHTML = html;
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
    for (const key of ["scan_interval", "offline_after_failures", "purge_days", "purge_time"]) {
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
    const reload = changes.includes("scan_interval") || changes.includes("purge_time");
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
    };
    return map[key] ? this._t(map[key]) : "";
  }

  async _saveSettings() {
    const st = this._settings;
    if (!st) return;
    const changes = this._settingsChanges();
    if (!changes.length || Object.keys(this._settingsErrors()).length) return;
    const values = {};
    for (const key of changes) values[key] = st.draft[key];
    st.saving = true;
    st.saveError = null;
    this._renderSettings();
    try {
      const result = await this._hass.callWS({
        type: "unifi_dynamic/set_options",
        entry_id: st.entryId,
        values,
      });
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
    this._tickLoader(end);
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
    if (range === "24h") {
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
      for (; d.getTime() < end; d.setHours(d.getHours() + 1)) {
        const h = d.getHours();
        if (h % 3) continue;
        ticks.push({
          at: d.getTime(),
          label: `${String(h).padStart(2, "0")}:00`,
          minor: h % 6 !== 0,
        });
      }
    } else {
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 1);
      for (let i = 0; d.getTime() < end; d.setDate(d.getDate() + 1), i++) {
        if (range === "7d") {
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
    const span = end - start;
    // Nicht zu nah an "jetzt" (rechter Rand) und am linken Rand.
    return ticks
      .map((tk) => ({ ...tk, pos: ((tk.at - start) / span) * 100 }))
      .filter((tk) => tk.pos > 5 && tk.pos < 82);
  }

  // Zeitstrahl eines Clients (Geräteansicht) bzw. des Controllers
  // (Einstellungen, src.controller). Gleicher Zeitraum für beide.
  _availSectionHtml(c, src = null) {
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
    const head = `<h3 class="avail-h3"><span>${esc(t(src && src.controller ? "secCtlAvail" : "secAvail"))}</span>${switchHtml}</h3>`;
    const note = (text, extra = "") => `${head}<div class="avail"><p class="dlg-note">${esc(text)}${extra}</p></div>`;

    if (!src) {
      const entityId = this._onlineEntityId(c.device_id);
      if (!entityId) return note(t("availNoEntity"));
      src = { id: entityId, entryId: c.entry_id, mac: c.mac, entityId };
    }
    this._ensureHistory(src);
    const h = this._history;
    if (!h || h.key !== `${src.id}|${range}` || (!h.states && h.loading)) {
      return `${head}${this._availLoaderHtml()}`;
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

    const endLabel = (s) => (s.to >= end ? t("availOngoing") : this._formatAvailTime(s.to, false));
    const segHtml = segs
      .map((s) => {
        const left = ((s.from - start) / span) * 100;
        const width = ((s.to - s.from) / span) * 100;
        const tip =
          s.kind === "off"
            ? ` data-tip="${esc(
                `${this._formatAvailTime(s.from, withDate)}–${endLabel(s)}`
              )}" data-dur="${esc(this._formatDuration(s.to - s.from))}"`
            : "";
        return `<span class="seg ${s.kind}" style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%"${tip}></span>`;
      })
      .join("");
    const ticks = this._availTicks(start, end, range)
      .map(
        (tk) => `<span class="${tk.minor ? "minor" : ""}" style="left:${tk.pos.toFixed(2)}%">${esc(tk.label)}</span>`
      )
      .join("");
    const hasNone = segs.some((s) => s.kind === "none");
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

  // Lade-Animation: Elefant balanciert auf einem Ball über die Leiste,
  // wechselnde Statuswörter und Sekundenzähler (siehe _tickLoader). Nur
  // CSS-Animation; bei "Bewegung reduzieren" steht alles still.
  _availLoaderHtml() {
    const esc = (v) => this._escape(v);
    const words = this._t("availLoadingWords");
    return `<div class="avail avail-loading" role="status" aria-label="${esc(this._t("availLoading"))}">
        <div class="ele-words">${words.map((w) => `<span class="shimmer">${esc(w)}</span>`).join("")}</div>
        <div class="ele-sec"><span class="avail-sec">0</span> s</div>
        <div class="ele-track">
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
        </div>
      </div>`;
  }

  // Sekundenzähler direkt im DOM hochzählen, ohne den Dialog neu aufzubauen.
  _tickLoader(startedAt) {
    window.clearInterval(this._loaderTimer);
    this._loaderTimer = window.setInterval(() => {
      const el = this.shadowRoot && this.shadowRoot.querySelector(".avail-sec");
      if (!this._history || !this._history.loading) {
        window.clearInterval(this._loaderTimer);
        return;
      }
      if (el) el.textContent = String(Math.floor((Date.now() - startedAt) / 1000));
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
          ${this._availSectionHtml(c)}
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
    const css = HIDEABLE_KEYS.filter((key) => this._hiddenCols.has(key))
      .map((key) => `table .c-${key} { display: none; }`)
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

  // Spaltenliste in aktueller Reihenfolge: Griff zum Verschieben,
  // Beschriftung, Schalter zum Ein-/Ausblenden.
  _columnTogglesHtml(attr) {
    return `<div class="col-list">${this._colOrder
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
          const order = [...this._colOrder];
          const [key] = order.splice(from, 1);
          order.splice(to, 0, key);
          this._setColumnOrder(order);
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
      const order = [...this._colOrder];
      const i = order.indexOf(key);
      const j = ev.key === "ArrowUp" ? i - 1 : i + 1;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      this._setColumnOrder(order);
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
        /* Hub-Auswahl und Zahnrad: bei einem Hub nur das Zahnrad, bei
           mehreren beide als zusammenhängende Gruppe. */
        .hub-ctl {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: stretch;
        }
        .hub-select-wrap {
          display: none;
          position: relative;
          align-items: center;
          border: 1px solid var(--udc-divider);
          border-right: none;
          border-radius: 10px 0 0 10px;
          background: var(--udc-card);
          color: var(--udc-text2);
        }
        .hub-ctl.multi .hub-select-wrap {
          display: inline-flex;
        }
        .hub-select-wrap > svg {
          position: absolute;
          width: 18px;
          height: 18px;
          pointer-events: none;
        }
        .hub-select-wrap > svg:first-child {
          left: 11px;
        }
        .hub-select-wrap > svg:last-child {
          right: 8px;
        }
        .hub-select {
          height: 100%;
          max-width: 220px;
          padding: 0 32px 0 38px;
          border: none;
          border-radius: 10px 0 0 10px;
          background: none;
          color: var(--udc-text);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          text-overflow: ellipsis;
        }
        .hub-select:hover {
          background: var(--udc-hover);
        }
        .gear-btn {
          width: 40px;
          padding: 0;
          justify-content: center;
        }
        .hub-ctl.multi .gear-btn {
          border-radius: 0 10px 10px 0;
        }
        .gear-btn:disabled {
          color: var(--udc-text3);
          cursor: not-allowed;
          opacity: 0.6;
        }
        .gear-btn:disabled:hover {
          background: var(--udc-card);
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
          /* Handy: ein Hub - Zahnrad neben dem Filter-Button; mehrere -
             eigene Zeile unter den Zahlen. */
          .gear-btn {
            width: 42px;
            height: 42px;
            border-radius: 12px;
          }
          .hub-ctl.multi {
            order: 6;
            flex: 1 1 100%;
          }
          .hub-ctl.multi .hub-select-wrap {
            flex: 1 1 auto;
          }
          .hub-ctl.multi .hub-select {
            width: 100%;
            max-width: none;
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
        .cols-head span {
          display: flex;
          gap: 4px;
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
        .col-list {
          position: relative;
        }
        .col-row {
          display: flex;
          align-items: center;
          gap: 2px;
          border-radius: 8px;
          background: var(--udc-card);
          transition: transform 0.12s ease;
        }
        .col-row.dragging {
          position: relative;
          z-index: 1;
          transition: none;
          box-shadow: var(--udc-shadow);
        }
        .col-handle {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 30px;
          height: 36px;
          padding: 0;
          border: none;
          border-radius: 8px;
          background: none;
          color: var(--udc-text3);
          cursor: grab;
          /* Sonst scrollt der Finger das Blatt statt die Zeile zu ziehen. */
          touch-action: none;
        }
        .col-row.dragging .col-handle {
          cursor: grabbing;
        }
        .col-handle svg {
          width: 18px;
          height: 18px;
        }
        .col-handle:hover,
        .col-handle:focus-visible {
          color: var(--udc-text);
          background: var(--udc-hover);
          outline: none;
        }
        .col-row .col-toggle {
          flex: 1 1 auto;
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
        .sheet-cols .col-row {
          background: var(--udc-card);
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
        dialog.device,
        dialog.settings {
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
        dialog.device::backdrop,
        dialog.settings::backdrop {
          background: rgba(0,0,0,0.5);
        }
        @media (max-width: 600px) {
          dialog.device,
          dialog.settings {
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
        /* Verfügbarkeit (Zeitstrahl) */
        .dlg-body h3.avail-h3 {
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .avail-range {
          display: inline-flex;
          padding: 2px;
          border-radius: 99px;
          background: var(--udc-subtle);
          text-transform: none;
          letter-spacing: 0;
        }
        .avail-range button {
          height: 26px;
          padding: 0 11px;
          border: none;
          border-radius: 99px;
          background: none;
          color: var(--udc-text2);
          font: inherit;
          font-size: 12px;
          white-space: nowrap;
          cursor: pointer;
        }
        .avail-range button.active {
          background: var(--udc-card);
          color: var(--udc-text);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .avail {
          padding: 12px 14px 10px;
          border-radius: 14px;
          background: var(--udc-subtle);
        }
        .avail .dlg-note {
          margin: 0;
        }
        .avail-top {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 4px 10px;
          margin-bottom: 12px;
        }
        .avail-pct {
          font-size: 22px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }
        .avail-pct small {
          margin-left: 2px;
          color: var(--udc-text2);
          font-size: 14px;
          font-weight: 400;
        }
        .avail-facts {
          color: var(--udc-text2);
          font-size: 13px;
        }
        .avail-facts b {
          color: color-mix(in srgb, var(--udc-warning) 85%, var(--udc-text));
          font-weight: 500;
        }
        .avail-barwrap {
          position: relative;
        }
        .avail-bar {
          position: relative;
          height: 22px;
          border-radius: 6px;
          overflow: hidden;
          background: color-mix(in srgb, var(--udc-text) 12%, var(--udc-card));
        }
        .avail-bar .seg {
          position: absolute;
          top: 0;
          bottom: 0;
        }
        /* Getönt wie die Online-Pille statt voller Signalfarben. */
        .avail-bar .seg.on,
        .avail-legend i.on {
          background: color-mix(in srgb, var(--udc-success) 22%, var(--udc-card));
        }
        .avail-bar .seg.off {
          /* Über den Nachbarn, auch wenn die Mindestbreite überlappt. */
          z-index: 1;
          min-width: 3px;
          background: color-mix(in srgb, var(--udc-warning) 40%, var(--udc-card));
          /* Feine Kante: kurze Unterbrüche bleiben auch getönt erkennbar. */
          box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--udc-warning) 80%, var(--udc-card));
          cursor: pointer;
        }
        .avail-bar .seg.none,
        .avail-legend i.none {
          background: repeating-linear-gradient(
            45deg,
            color-mix(in srgb, var(--udc-text) 18%, var(--udc-card)) 0 4px,
            transparent 4px 8px
          );
        }
        .avail-bar .seg.hover {
          background: color-mix(in srgb, var(--udc-warning) 60%, var(--udc-card));
        }
        .avail-now {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 2px;
          background: var(--udc-text);
        }
        .avail-tip {
          position: absolute;
          bottom: calc(100% + 8px);
          z-index: 2;
          transform: translateX(-50%);
          padding: 7px 10px;
          border-radius: 8px;
          background: #323232;
          color: #fff;
          font-size: 12px;
          white-space: nowrap;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          pointer-events: none;
        }
        .avail-tip[hidden] {
          display: none;
        }
        .avail-tip b {
          color: #ffb74d;
          font-weight: 500;
        }
        .avail-tip::after {
          content: "";
          position: absolute;
          left: calc(50% + var(--arrow, 0px));
          bottom: -5px;
          width: 10px;
          height: 10px;
          background: #323232;
          transform: translateX(-50%) rotate(45deg);
        }
        .avail-ticks {
          position: relative;
          height: 16px;
          margin-top: 4px;
          color: var(--udc-text3);
          font-size: 11px;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .avail-ticks span {
          position: absolute;
          transform: translateX(-50%);
        }
        .avail-ticks .now-label {
          right: 0;
          transform: none;
        }
        @media (max-width: 600px) {
          .avail-ticks .minor {
            display: none;
          }
        }
        .avail-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 14px;
          margin-top: 6px;
          color: var(--udc-text2);
          font-size: 12px;
        }
        .avail-legend i {
          display: inline-block;
          width: 10px;
          height: 10px;
          margin-right: 5px;
          border-radius: 3px;
          vertical-align: -1px;
        }
        .avail-legend i.off {
          background: color-mix(in srgb, var(--udc-warning) 40%, var(--udc-card));
          box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--udc-warning) 80%, var(--udc-card));
        }
        /* Lade-Animation: Elefant balanciert auf einem Ball über die Leiste */
        .avail-loading {
          position: relative;
          overflow: hidden;
        }
        .ele-words {
          position: relative;
          height: 20px;
          overflow: hidden;
        }
        .ele-words span {
          position: absolute;
          top: 0;
          left: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          opacity: 0;
          animation: ele-words 12s infinite, ele-sweep 1.8s linear infinite;
        }
        .ele-words span:nth-child(2) { animation-delay: 3s, 0s; }
        .ele-words span:nth-child(3) { animation-delay: 6s, 0s; }
        .ele-words span:nth-child(4) { animation-delay: 9s, 0s; }
        .shimmer {
          font-size: 13px;
          font-weight: 500;
          background: linear-gradient(90deg, var(--udc-text3) 0%, var(--udc-text3) 40%, var(--udc-text) 50%, var(--udc-text3) 60%, var(--udc-text3) 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        @keyframes ele-sweep {
          from { background-position: 100% 0; }
          to { background-position: -150% 0; }
        }
        @keyframes ele-words {
          0% { opacity: 0; transform: translateY(10px); }
          3%, 22% { opacity: 1; transform: none; }
          25%, 100% { opacity: 0; transform: translateY(-10px); }
        }
        .ele-sec {
          margin-top: 2px;
          color: var(--udc-text3);
          font-size: 12px;
          font-variant-numeric: tabular-nums;
        }
        .ele-track {
          position: relative;
          height: 22px;
          margin-top: 64px;
          border-radius: 6px;
          background: color-mix(in srgb, var(--udc-text) 8%, var(--udc-card));
        }
        /* Die Spur hinter dem Elefanten. Nur gespielt: die echte Ladezeit
           ist unbekannt, darum läuft alles in einer Schleife. */
        .ele-done {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          border-radius: 6px;
          background: color-mix(in srgb, var(--udc-success) 22%, var(--udc-card));
          animation: ele-fill 7s linear infinite;
        }
        .ele-rider {
          position: absolute;
          bottom: 20px;
          width: 60px;
          height: 66px;
          animation: ele-ride 7s linear infinite;
        }
        .ele-rider svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .ele-rider .sil {
          fill: var(--udc-text2);
        }
        .ele-rider .tail {
          fill: none;
          stroke: var(--udc-text2);
          stroke-width: 1.6;
          stroke-linecap: round;
        }
        .ele-rider .eye {
          fill: var(--udc-subtle);
        }
        .ele-rider .body {
          transform-origin: 29px 41px;
          animation: ele-wobble 1.3s ease-in-out infinite alternate;
        }
        .ele-rider .ear {
          fill: color-mix(in srgb, var(--udc-text2) 72%, var(--udc-card));
          stroke: color-mix(in srgb, var(--udc-text2) 55%, var(--udc-card));
          stroke-width: 1;
          transform-origin: 47px 8px;
          animation: ele-flap 0.65s ease-in-out infinite alternate;
        }
        .ele-rider .trunk {
          fill: none;
          stroke: var(--udc-text2);
          stroke-width: 4.5;
          stroke-linecap: round;
          transform-origin: 57px 17px;
          animation: ele-trunk 1.3s ease-in-out infinite alternate;
        }
        /* Trippeln: diagonal versetzt wie beim Gehen, das Bein hebt sich
           dabei leicht an. */
        .ele-rider .leg {
          transform-box: fill-box;
          transform-origin: 50% 8%;
          animation: ele-tread 0.5s ease-in-out infinite;
        }
        .ele-rider .l2,
        .ele-rider .l3 {
          animation-delay: -0.25s;
        }
        .ele-rider .ball {
          fill: color-mix(in srgb, var(--udc-success) 35%, var(--udc-card));
          stroke: color-mix(in srgb, var(--udc-success) 70%, var(--udc-card));
          stroke-width: 1.5;
        }
        .ele-rider .seam {
          fill: none;
          stroke: color-mix(in srgb, var(--udc-success) 70%, var(--udc-card));
          stroke-width: 1.3;
        }
        .ele-rider .roll {
          transform-origin: 29px 53px;
          animation: ele-roll 1s linear infinite;
        }
        @keyframes ele-ride {
          from { left: -60px; }
          to { left: 100%; }
        }
        @keyframes ele-fill {
          from { width: 0; }
          to { width: calc(100% + 30px); }
        }
        @keyframes ele-wobble {
          from { transform: rotate(-5deg); }
          to { transform: rotate(4deg); }
        }
        @keyframes ele-trunk {
          from { transform: rotate(-22deg); }
          to { transform: rotate(12deg); }
        }
        @keyframes ele-flap {
          from { transform: rotate(0); }
          to { transform: rotate(-10deg); }
        }
        @keyframes ele-tread {
          0% { transform: rotate(16deg); }
          25% { transform: rotate(0) scaleY(0.88); }
          50% { transform: rotate(-16deg); }
          75% { transform: rotate(0); }
          100% { transform: rotate(16deg); }
        }
        @keyframes ele-roll {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ele-rider,
          .ele-rider *,
          .ele-done,
          .ele-words span {
            animation: none !important;
          }
          .ele-rider {
            left: 40%;
          }
          .ele-done {
            width: 42%;
          }
          .ele-words span:first-child {
            opacity: 1;
          }
        }
        .avail-list {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid var(--udc-divider);
          font-size: 13px;
        }
        .avail-list div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 3px 0;
          font-variant-numeric: tabular-nums;
        }
        .avail-list .d {
          color: var(--udc-warning);
          white-space: nowrap;
        }
        .avail-more {
          margin: 4px 0 0;
          color: var(--udc-text3);
          font-size: 12px;
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
        .dlg-btn.primary {
          flex: 1 1 auto;
          border-color: var(--udc-primary);
          background: var(--udc-primary);
          color: #fff;
          font-weight: 500;
        }
        .dlg-btn.primary:hover {
          background: color-mix(in srgb, var(--udc-primary) 88%, #000);
        }
        .dlg-btn:disabled {
          opacity: 0.45;
          cursor: default;
        }
        dialog.settings .dlg-btn[data-set="close"] {
          flex: 1 1 auto;
        }
        .set-count {
          align-self: center;
          color: var(--udc-text2);
          font-size: 12px;
          white-space: nowrap;
        }
        .set-count:empty {
          display: none;
        }
        /* Einstellungen: aufklappbare Abschnitte */
        .set-sec {
          margin-top: 10px;
          border: 1px solid var(--udc-divider);
          border-radius: 14px;
          overflow: hidden;
        }
        .set-sec-head {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
          border: none;
          background: none;
          color: var(--udc-text);
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .set-sec-head > span {
          flex: 1 1 auto;
          min-width: 0;
        }
        .set-sec-head:hover {
          background: var(--udc-hover);
        }
        .set-sec-head > svg {
          flex: 0 0 auto;
          width: 20px;
          height: 20px;
          color: var(--udc-text2);
          transition: transform 0.15s;
        }
        .set-sec.open .set-sec-head > svg {
          transform: rotate(180deg);
        }
        .set-sec-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }
        .set-sec-sum {
          display: block;
          margin-top: 1px;
          overflow: hidden;
          color: var(--udc-text2);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .set-badge {
          padding: 0 8px;
          border-radius: 99px;
          background: var(--udc-primary-soft);
          color: var(--udc-primary);
          font-size: 11px;
          font-weight: 400;
        }
        .set-sec-body {
          padding: 2px 14px 10px;
          border-top: 1px solid var(--udc-divider);
        }
        .opt {
          padding: 10px 0;
          border-bottom: 1px solid var(--udc-divider);
        }
        .opt:last-child {
          border-bottom: none;
        }
        .opt-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 36px;
        }
        .opt-label {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          min-width: 0;
        }
        .opt-short,
        .opt-error {
          margin-top: 3px;
          color: var(--udc-text2);
          font-size: 12px;
          line-height: 1.35;
        }
        .opt-error {
          color: var(--udc-error);
        }
        .opt-info {
          margin-top: 6px;
          padding: 8px 10px;
          border-radius: 8px;
          background: var(--udc-subtle);
          color: var(--udc-text2);
          font-size: 12px;
          line-height: 1.45;
        }
        .info-btn {
          display: inline-grid;
          place-items: center;
          width: 26px;
          height: 26px;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: none;
          color: var(--udc-text3);
          cursor: pointer;
        }
        .info-btn svg {
          width: 16px;
          height: 16px;
        }
        .info-btn:hover,
        .info-btn.on {
          color: var(--udc-primary);
        }
        .opt-input {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 10px;
          border: 1px solid var(--udc-divider);
          border-radius: 9px;
          background: var(--udc-input);
        }
        .opt-input input {
          width: 70px;
          border: none;
          outline: none;
          background: none;
          color: var(--udc-text);
          font: inherit;
          font-size: 14px;
          font-variant-numeric: tabular-nums;
        }
        .opt-input input[type="time"] {
          width: 96px;
          color-scheme: light dark;
        }
        .opt-input .unit {
          color: var(--udc-text3);
          font-size: 12px;
        }
        .opt.changed > .opt-line .opt-input,
        .opt.changed > .opt-line .opt-select select {
          border-color: var(--udc-primary);
          box-shadow: inset 0 0 0 1px var(--udc-primary);
        }
        .opt.invalid > .opt-line .opt-input {
          border-color: var(--udc-error);
          box-shadow: inset 0 0 0 1px var(--udc-error);
        }
        .opt-select {
          position: relative;
          flex: 0 1 260px;
          min-width: 0;
        }
        .opt-select select {
          width: 100%;
          height: 36px;
          padding: 0 30px 0 10px;
          border: 1px solid var(--udc-divider);
          border-radius: 9px;
          background: var(--udc-input);
          color: var(--udc-text);
          font: inherit;
          font-size: 14px;
          appearance: none;
          -webkit-appearance: none;
          text-overflow: ellipsis;
        }
        .opt-select svg {
          position: absolute;
          top: 8px;
          right: 6px;
          width: 20px;
          height: 20px;
          color: var(--udc-text2);
          pointer-events: none;
        }
        .switch {
          position: relative;
          flex: 0 0 auto;
          width: 36px;
          height: 20px;
        }
        .switch input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          opacity: 0;
          cursor: pointer;
        }
        .switch span {
          position: absolute;
          inset: 0;
          border-radius: 99px;
          background: color-mix(in srgb, var(--udc-text) 25%, transparent);
          pointer-events: none;
          transition: background 0.15s;
        }
        .switch span::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: left 0.15s;
        }
        .switch input:checked + span {
          background: var(--udc-primary);
        }
        .switch input:checked + span::after {
          left: 18px;
        }
        .switch input:focus-visible + span {
          outline: 2px solid var(--udc-primary);
          outline-offset: 2px;
        }
        .opt-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 18px;
          margin-top: 4px;
        }
        @media (max-width: 600px) {
          .opt-grid {
            grid-template-columns: 1fr;
          }
        }
        .opt-line.sub {
          min-height: 34px;
          font-size: 13px;
        }
        .opt-line.sub.changed span:first-child {
          color: var(--udc-primary);
        }
        .opt-count {
          color: var(--udc-text2);
          font-size: 13px;
        }
        .opt-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .opt-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 100%;
          padding: 3px 4px 3px 10px;
          border-radius: 99px;
          background: var(--udc-subtle);
          font-size: 13px;
        }
        .opt-chip small {
          color: var(--udc-text3);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
        }
        .opt-chip button {
          display: grid;
          place-items: center;
          width: 22px;
          height: 22px;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: none;
          color: var(--udc-text2);
          cursor: pointer;
        }
        .opt-chip button:hover {
          background: var(--udc-hover);
          color: var(--udc-error);
        }
        .opt-chip button svg {
          width: 14px;
          height: 14px;
        }
        /* Version und Update */
        .ver {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px 12px;
          padding: 11px 12px 11px 14px;
          border-radius: 14px;
          background: var(--udc-subtle);
        }
        .ver-ic {
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--udc-success) 18%, transparent);
          color: var(--udc-success);
        }
        .ver-ic svg {
          width: 20px;
          height: 20px;
        }
        .ver-t {
          flex: 1 1 200px;
          min-width: 0;
        }
        .ver-t b {
          font-weight: 500;
        }
        .ver-t small {
          display: block;
          margin-top: 1px;
          color: var(--udc-text2);
          font-size: 12px;
        }
        .ver-btns {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .ver-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 34px;
          padding: 0 13px;
          border: 1px solid var(--udc-divider);
          border-radius: 99px;
          background: var(--udc-card);
          color: var(--udc-text);
          font: inherit;
          font-size: 13px;
          white-space: nowrap;
          cursor: pointer;
        }
        .ver-btn svg {
          width: 16px;
          height: 16px;
        }
        .ver-btn:hover:not(:disabled) {
          background: var(--udc-hover);
        }
        .ver-btn:disabled {
          cursor: default;
        }
        .ver-btn.primary {
          border-color: var(--udc-primary);
          background: var(--udc-primary);
          color: #fff;
          font-weight: 500;
        }
        .ver-btn.warn {
          border-color: var(--udc-warning);
          background: var(--udc-warning);
          color: #fff;
          font-weight: 500;
        }
        .ver-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 6px;
          color: var(--udc-primary);
          font-size: 13px;
          text-decoration: none;
          white-space: nowrap;
        }
        .ver-link svg {
          width: 15px;
          height: 15px;
        }
        .ver.upd {
          background: color-mix(in srgb, var(--udc-primary) 10%, var(--udc-subtle));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--udc-primary) 35%, transparent);
        }
        .ver.upd .ver-ic {
          background: color-mix(in srgb, var(--udc-primary) 18%, transparent);
          color: var(--udc-primary);
        }
        .ver.rst {
          background: color-mix(in srgb, var(--udc-warning) 12%, var(--udc-subtle));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--udc-warning) 35%, transparent);
        }
        .ver.rst .ver-ic {
          background: color-mix(in srgb, var(--udc-warning) 20%, transparent);
          color: var(--udc-warning);
        }
        .ver-spin {
          width: 14px;
          height: 14px;
          border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: ver-spin 0.8s linear infinite;
        }
        @keyframes ver-spin {
          to { transform: rotate(360deg); }
        }
        .ver-prog {
          flex: 1 1 100%;
          height: 4px;
          overflow: hidden;
          border-radius: 99px;
          background: color-mix(in srgb, var(--udc-primary) 18%, transparent);
        }
        .ver-prog i {
          display: block;
          width: 35%;
          height: 100%;
          border-radius: 99px;
          background: var(--udc-primary);
          animation: ver-prog 1.4s ease-in-out infinite;
        }
        @keyframes ver-prog {
          from { transform: translateX(-100%); }
          to { transform: translateX(300%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ver-spin,
          .ver-prog i {
            animation: none;
          }
        }
        .ver-slot:empty {
          display: none;
        }
        .set-note {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--udc-warning-soft);
          color: color-mix(in srgb, var(--udc-warning) 85%, var(--udc-text));
          font-size: 13px;
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
      const widths = { name: 150, linked: 110, ip: 95, mac: 120, essid: 70, ap_name: 90, conn: 80, seen_at: 90, status: 60, actions: 20 };
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
