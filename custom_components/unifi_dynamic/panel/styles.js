/**
 * Styles des Panels (Shadow DOM). Farben kommen über CSS-Variablen aus Home
 * Assistant (siehe panel.html); eigene Variablen beginnen mit --udc-.
 */

export const PANEL_CSS = `
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
          /* Ping-Stufen (blasse Töne, auf hell und dunkel lesbar) */
          --udc-ping5: #4caf50;
          --udc-ping4: #8bc34a;
          --udc-ping3: #eba43f;
          --udc-ping2: #a37fe0;
          --udc-ping1: #e5625f;
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
          /* Einstellungen: feste Höhe statt Höhe nach Inhalt. Sonst springt
             das unten verankerte Blatt bei jeder Änderung des Inhalts
             (Prüfung, Abschnitt auf/zu) und gibt kurz den Hintergrund frei. */
          dialog.settings {
            height: 92%;
          }
          dialog.settings[open] {
            display: flex;
            flex-direction: column;
          }
          dialog.settings[open] > * {
            flex-shrink: 0;
          }
          dialog.settings[open] > .dlg-body {
            flex-grow: 1;
          }
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
        .avail-ticks .start-label {
          left: 0;
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
        /* Weitere Loader (Einstellungen -> Loader). Gemeinsam mit dem
           Elefanten: Wörter, Sekunden, Leiste und Spur (.ele-*). */
        .ld-rider,
        .ld-actor {
          position: absolute;
        }
        .ld-rider svg,
        .ld-actor svg {
          display: block;
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .avail-loading .sil,
        .ld-mini .sil {
          fill: var(--udc-text2);
        }
        .avail-loading .eye,
        .ld-mini .eye {
          fill: var(--udc-subtle);
        }
        .ld-catr .tail {
          fill: none;
          stroke: var(--udc-text2);
          stroke-width: 3.6;
          stroke-linecap: round;
        }
        .ld-catr .whisk {
          stroke: var(--udc-text3);
          stroke-width: 0.7;
          stroke-linecap: round;
        }
        .ld-catr .yarn {
          fill: color-mix(in srgb, #d9738f 55%, var(--udc-card));
          stroke: #d9738f;
          stroke-width: 1.3;
        }
        .ld-catr .strand {
          fill: none;
          stroke: #d9738f;
          stroke-width: 1.2;
          stroke-linecap: round;
        }
        /* Katze: anschleichen, Hintern wackeln, Sprung; die Spur wächst in
           Schüben. */
        .ld-catr {
          bottom: 10px;
          width: 100px;
          height: 54px;
          animation: ld-cat-ride 7s linear infinite;
        }
        .ld-cat-done {
          animation: ld-cat-fill 7s linear infinite;
        }
        .ld-catr .leg {
          transform-box: fill-box;
          transform-origin: 50% 10%;
          animation: ld-creep 0.8s ease-in-out infinite alternate;
        }
        .ld-catr .l2,
        .ld-catr .l4 {
          animation-direction: alternate-reverse;
        }
        .ld-catr .jump {
          animation: ld-cat-jump 7s ease-in-out infinite;
        }
        .ld-catr .crouch {
          transform-origin: 26px 30px;
          animation: ld-cat-crouch 7s ease-in-out infinite;
        }
        .ld-catr .butt {
          transform-origin: 14px 28px;
          animation: ld-cat-wiggle 7s ease-in-out infinite;
        }
        .ld-catr .yarnball {
          transform-origin: 88px 41px;
          animation: ld-cat-ball 7s ease-in-out infinite;
        }
        @keyframes ld-cat-ride {
          0% { left: -100px; } 28% { left: 12%; } 40% { left: 14%; } 50% { left: 44%; }
          76% { left: 56%; } 86% { left: 58%; } 96% { left: 92%; } 100% { left: 100%; }
        }
        @keyframes ld-cat-fill {
          0% { width: 0; } 28% { width: calc(12% + 50px); } 40% { width: calc(14% + 50px); } 50% { width: calc(44% + 50px); }
          76% { width: calc(56% + 50px); } 86% { width: calc(58% + 50px); } 96% { width: calc(92% + 50px); } 100% { width: calc(100% + 50px); }
        }
        @keyframes ld-cat-jump {
          0%, 40% { transform: none; } 45% { transform: translateY(-20px) rotate(-10deg); } 50%, 86% { transform: none; }
          91% { transform: translateY(-20px) rotate(-10deg); } 96%, 100% { transform: none; }
        }
        @keyframes ld-cat-crouch {
          0%, 28% { transform: scaleY(0.8) translateY(6px); } 40% { transform: scaleY(0.72) translateY(8px); } 44%, 52% { transform: none; }
          56%, 76% { transform: scaleY(0.8) translateY(6px); } 86% { transform: scaleY(0.72) translateY(8px); } 90%, 98% { transform: none; }
          100% { transform: scaleY(0.8) translateY(6px); }
        }
        @keyframes ld-cat-wiggle {
          0%, 29% { transform: none; } 31% { transform: rotate(-7deg); } 33% { transform: rotate(7deg); } 35% { transform: rotate(-7deg); } 37% { transform: rotate(7deg); }
          39%, 77% { transform: none; } 79% { transform: rotate(-7deg); } 81% { transform: rotate(7deg); } 83% { transform: rotate(-7deg); } 85% { transform: rotate(7deg); }
          87%, 100% { transform: none; }
        }
        @keyframes ld-cat-ball {
          0%, 44% { transform: none; } 48% { transform: translate(6px, -6px) rotate(200deg); } 52%, 90% { transform: rotate(360deg); }
          94% { transform: translate(6px, -6px) rotate(560deg); } 98%, 100% { transform: rotate(720deg); }
        }
        @keyframes ld-creep {
          from { transform: rotate(14deg); }
          to { transform: rotate(-14deg); }
        }
        /* Hamster im Laufrad */
        .ld-hamr {
          bottom: 19px;
          width: 52px;
          height: 52px;
          animation: ele-ride 7s linear infinite;
        }
        .ld-hamr .wheel {
          transform-origin: 26px 26px;
          animation: ele-roll 1s linear infinite;
        }
        .ld-hamr .rim {
          fill: none;
          stroke: var(--udc-text3);
          stroke-width: 2.2;
        }
        .ld-hamr .spoke {
          stroke: var(--udc-text3);
          stroke-width: 1;
        }
        .ld-hamr .nose {
          fill: #f0a030;
        }
        .ld-hamr .hbody {
          animation: ld-bob 0.22s ease-in-out infinite alternate;
        }
        .ld-hamr .leg {
          transform-box: fill-box;
          transform-origin: 50% 0;
          animation: ld-gallop 0.22s ease-in-out infinite alternate;
        }
        .ld-hamr .l2 {
          animation-direction: alternate-reverse;
        }
        @keyframes ld-bob {
          from { transform: translateY(0); }
          to { transform: translateY(-2px); }
        }
        @keyframes ld-gallop {
          from { transform: rotate(28deg); }
          to { transform: rotate(-28deg); }
        }
        /* Pinguin und Eisbär: Pinguin watschelt, Bär rennt heran, Pinguin
           rutscht davon und taucht im Eisloch ab, der Bär wundert sich, der
           Pinguin taucht weiter vorne wieder auf. */
        .ld-ice {
          background: color-mix(in srgb, #7fc8f0 14%, var(--udc-card));
        }
        .ld-pen-done {
          animation: ld-pen-fill 9s linear infinite;
        }
        .ld-stage {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 11px;
          height: 90px;
          overflow: hidden;
          pointer-events: none;
        }
        .ld-stage.free {
          overflow: visible;
        }
        .ld-actor {
          bottom: 11px;
        }
        .ld-hole {
          position: absolute;
          top: -3px;
          width: 36px;
          height: 9px;
          margin-left: -4px;
          border-radius: 50%;
          background: color-mix(in srgb, #0b3a57 80%, var(--udc-card));
          box-shadow: 0 0 0 2px color-mix(in srgb, #7fc8f0 55%, var(--udc-card));
        }
        .ld-hole.h1 { left: 64%; }
        .ld-hole.h2 { left: 88%; }
        .ld-peng .warm { fill: #f0a030; }
        .ld-peng .belly { fill: color-mix(in srgb, var(--udc-text) 78%, var(--udc-card)); }
        .ld-peng .peye { fill: var(--udc-text); }
        .ld-bear .fur {
          fill: color-mix(in srgb, #fff 88%, var(--udc-card));
          stroke: color-mix(in srgb, var(--udc-text2) 70%, var(--udc-card));
          stroke-width: 1;
        }
        .ld-bear .dark { fill: #222; }
        .ld-peng {
          width: 32px;
          height: 46px;
          animation: ld-pen-ride 9s linear infinite;
        }
        .ld-peng .pose {
          transform-origin: 16px 44px;
          animation: ld-pen-pose 9s ease-in-out infinite;
        }
        .ld-peng .w {
          transform-origin: 16px 44px;
          animation: ld-pen-waddle 9s linear infinite;
        }
        .ld-peng .wave {
          transform-origin: 8px 20px;
          animation: ld-pen-wave 9s ease-in-out infinite;
        }
        .ld-bang,
        .ld-q {
          position: absolute;
          bottom: 58px;
          font-weight: 700;
        }
        .ld-bang {
          color: #f0a030;
          font-size: 18px;
          animation: ld-bang 9s linear infinite;
        }
        .ld-q {
          color: var(--udc-text2);
          font-size: 20px;
          animation: ld-q 9s ease-in-out infinite;
        }
        .ld-bear {
          width: 72px;
          height: 46px;
          animation: ld-bear-ride 9s linear infinite;
        }
        .ld-bear .lean {
          transform-origin: 36px 44px;
          animation: ld-bear-lean 9s ease-out infinite;
        }
        .ld-bear .leg {
          transform-box: fill-box;
          transform-origin: 50% 10%;
          animation: ld-bear-legs 9s linear infinite;
        }
        .ld-bear .l2,
        .ld-bear .l3 {
          animation-name: ld-bear-legs2;
        }
        .ld-bear .head {
          transform-origin: 56px 20px;
          animation: ld-bear-look 9s ease-in-out infinite;
        }
        .ld-drop {
          position: absolute;
          bottom: 12px;
          left: calc(64% + 14px);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #7fc8f0;
          opacity: 0;
          animation: ld-drop 9s ease-out infinite;
        }
        .ld-drop.d1 { --dx: 12px; }
        .ld-drop.d2 { --dx: -12px; }
        .ld-drop.d3 { --dx: 2px; }
        .ld-drop.up {
          left: calc(88% + 14px);
          animation-name: ld-drop2;
        }
        @keyframes ld-pen-ride {
          0% { left: 2%; opacity: 0; } 3% { opacity: 1; } 30% { left: 30%; } 36% { left: 32%; }
          46% { left: 62%; } 50% { left: 64%; opacity: 1; } 51% { left: 64%; opacity: 0; }
          83% { left: 88%; opacity: 0; } 84% { left: 88%; opacity: 1; } 96% { left: 88%; opacity: 1; } 100% { left: 88%; opacity: 0; }
        }
        @keyframes ld-pen-fill {
          0% { width: 2%; } 30% { width: calc(30% + 16px); } 36% { width: calc(32% + 16px); } 46% { width: calc(62% + 16px); }
          50%, 83% { width: calc(64% + 16px); } 90%, 100% { width: calc(88% + 16px); }
        }
        @keyframes ld-pen-pose {
          0%, 30% { transform: none; } 32% { transform: translateY(-10px); } 34% { transform: none; }
          37%, 46% { transform: translateY(8px) rotate(90deg); }
          50% { transform: translate(4px, 50px) rotate(150deg); }
          83% { transform: translateY(50px); } 87% { transform: translateY(-4px); } 89%, 100% { transform: none; }
        }
        @keyframes ld-pen-waddle { 0%, 3% { transform: rotate(0); } 5.5% { transform: rotate(9deg); } 8.0% { transform: rotate(-9deg); } 10.5% { transform: rotate(9deg); } 13.0% { transform: rotate(-9deg); } 15.5% { transform: rotate(9deg); } 18.0% { transform: rotate(-9deg); } 20.5% { transform: rotate(9deg); } 23.0% { transform: rotate(-9deg); } 25.5% { transform: rotate(9deg); } 28.0% { transform: rotate(-9deg); } 31%, 100% { transform: rotate(0); } }
        @keyframes ld-pen-wave {
          0%, 88% { transform: none; } 90% { transform: rotate(-70deg); } 92% { transform: rotate(-40deg); } 94% { transform: rotate(-70deg); } 96%, 100% { transform: none; }
        }
        @keyframes ld-bang {
          0%, 29% { opacity: 0; left: 30%; } 30%, 35% { opacity: 1; left: calc(30% + 10px); } 36%, 100% { opacity: 0; left: calc(32% + 10px); }
        }
        @keyframes ld-bear-ride {
          0%, 11% { left: -80px; opacity: 0; } 12% { left: -80px; opacity: 1; }
          52% { left: calc(64% - 84px); } 56% { left: calc(64% - 76px); }
          94% { left: calc(64% - 76px); opacity: 1; } 100% { left: calc(64% - 76px); opacity: 0; }
        }
        @keyframes ld-bear-lean {
          0%, 51% { transform: none; } 54% { transform: rotate(-10deg); } 58%, 100% { transform: none; }
        }
        @keyframes ld-bear-legs { 0%, 12% { transform: rotate(0); } 13.6% { transform: rotate(30deg); } 15.2% { transform: rotate(-30deg); } 16.8% { transform: rotate(30deg); } 18.4% { transform: rotate(-30deg); } 20.0% { transform: rotate(30deg); } 21.6% { transform: rotate(-30deg); } 23.2% { transform: rotate(30deg); } 24.8% { transform: rotate(-30deg); } 26.4% { transform: rotate(30deg); } 28.0% { transform: rotate(-30deg); } 29.6% { transform: rotate(30deg); } 31.2% { transform: rotate(-30deg); } 32.8% { transform: rotate(30deg); } 34.4% { transform: rotate(-30deg); } 36.0% { transform: rotate(30deg); } 37.6% { transform: rotate(-30deg); } 39.2% { transform: rotate(30deg); } 40.8% { transform: rotate(-30deg); } 42.4% { transform: rotate(30deg); } 44.0% { transform: rotate(-30deg); } 45.6% { transform: rotate(30deg); } 47.2% { transform: rotate(-30deg); } 48.8% { transform: rotate(30deg); } 50.4% { transform: rotate(-30deg); } 52.0% { transform: rotate(30deg); } 53%, 100% { transform: rotate(0); } }
        @keyframes ld-bear-legs2 { 0%, 12.8% { transform: rotate(0); } 14.4% { transform: rotate(-30deg); } 16.0% { transform: rotate(30deg); } 17.6% { transform: rotate(-30deg); } 19.2% { transform: rotate(30deg); } 20.8% { transform: rotate(-30deg); } 22.4% { transform: rotate(30deg); } 24.0% { transform: rotate(-30deg); } 25.6% { transform: rotate(30deg); } 27.2% { transform: rotate(-30deg); } 28.8% { transform: rotate(30deg); } 30.4% { transform: rotate(-30deg); } 32.0% { transform: rotate(30deg); } 33.6% { transform: rotate(-30deg); } 35.2% { transform: rotate(30deg); } 36.8% { transform: rotate(-30deg); } 38.4% { transform: rotate(30deg); } 40.0% { transform: rotate(-30deg); } 41.6% { transform: rotate(30deg); } 43.2% { transform: rotate(-30deg); } 44.8% { transform: rotate(30deg); } 46.4% { transform: rotate(-30deg); } 48.0% { transform: rotate(30deg); } 49.6% { transform: rotate(-30deg); } 51.2% { transform: rotate(30deg); } 53%, 100% { transform: rotate(0); } }
        @keyframes ld-bear-look {
          0%, 60% { transform: none; } 63%, 68% { transform: rotate(18deg); } 70%, 75% { transform: scaleX(-1); }
          78%, 84% { transform: rotate(-8deg); } 88%, 100% { transform: rotate(22deg); }
        }
        @keyframes ld-q {
          0%, 60% { opacity: 0; left: calc(64% - 30px); transform: translateY(6px); }
          63% { opacity: 1; transform: none; } 70% { transform: rotate(-12deg); } 78% { transform: rotate(12deg); }
          86% { opacity: 1; left: calc(64% - 30px); transform: none; } 90%, 100% { opacity: 0; left: calc(64% - 30px); }
        }
        @keyframes ld-drop {
          0%, 48% { opacity: 0; transform: none; } 50% { opacity: 1; } 55% { opacity: 0; transform: translate(var(--dx), -16px); } 100% { opacity: 0; }
        }
        @keyframes ld-drop2 {
          0%, 83% { opacity: 0; transform: none; } 85% { opacity: 1; } 90% { opacity: 0; transform: translate(var(--dx), -16px); } 100% { opacity: 0; }
        }
        /* Laufvogel und Kojote: der Vogel rennt durch den aufgemalten
           Tunnel, der Kojote prallt an die Wand. */
        .ele-track.ld-desert { margin-top: 80px; background: color-mix(in srgb, #e0a060 16%, var(--udc-card)); }
        .ld-desert .ele-done { animation: ld-rr-rrfill 9s linear infinite; background: color-mix(in srgb, #e0a060 38%, var(--udc-card)); }
        .ld-rr-actor { position: absolute; bottom: 20px; }
        .ld-rr-actor svg { width: 100%; height: 100%; overflow: visible; display: block; }
        .ld-desert .sil { fill: var(--udc-text2); }
        .ld-desert .warm { fill: #f0a030; }
        .ld-desert .light { fill: color-mix(in srgb, var(--udc-text) 75%, var(--udc-card)); }
        /* Felswand mit Tunnel-Portal von vorne. Das Portal ist so gross wie
           der Vogel, die Stufen im Innern geben Tiefe. */
        .ld-wall { position: absolute; left: 72%; bottom: 20px; width: 74px; height: 72px; z-index: 2; }
        .ld-wall .rock { fill: color-mix(in srgb, #b07040 55%, var(--udc-card)); stroke: color-mix(in srgb, #b07040 80%, var(--udc-card)); stroke-width: 1.2; }
        .ld-wall .crack { fill: none; stroke: color-mix(in srgb, #b07040 85%, var(--udc-card)); stroke-width: 1; }
        .ld-wall .tunnel { fill: #181818; }
        .ld-wall .t2 { fill: #0e0e0e; }
        .ld-wall .t3 { fill: #050505; }
        .ld-wall .shake { transform-origin: 2px 72px; animation: ld-rr-wallshake 9s linear infinite; }
        /* Vogel: rennt vor der Wand ins Portal, wird kleiner und verschwindet
           im Dunkeln (Fluchtpunkt in der Mitte des Portals). */
        .ld-bird { width: 40px; height: 46px; z-index: 3; transform-origin: 20px 30px; animation: ld-rr-birdride 9s linear infinite; }
        .ld-bird .wheel { transform-origin: 18px 38px; animation: ele-roll .25s linear infinite; }
        .ld-bird .blur { fill: none; stroke: var(--udc-text2); stroke-width: 2.2; stroke-dasharray: 5 3; }
        .ld-bird .stand { opacity: 0; }
        .ld-bird .body { transform-origin: 18px 30px; transform: rotate(14deg); }
        .ld-bird .crest { fill: none; stroke: var(--udc-text2); stroke-width: 1.6; stroke-linecap: round; }
        .ld-say { position: absolute; bottom: 82px; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 700; white-space: nowrap;
          background: var(--udc-text); color: var(--udc-card); opacity: 0; animation: ld-rr-say 9s ease-in-out infinite; z-index: 3; }
        /* Kojote: prallt an die Wand */
        .ld-coy { width: 70px; height: 46px; z-index: 3; animation: ld-rr-coyride 9s linear infinite; }
        .ld-coy .squash { transform-origin: 70px 44px; animation: ld-rr-coysquash 9s ease-out infinite; }
        .ld-coy .fall { transform-origin: 35px 22px; animation: ld-rr-coyfall 9s ease-in infinite; }
        .ld-coy .leg { transform-box: fill-box; transform-origin: 50% 10%; animation: ld-rr-coylegs 9s linear infinite; }
        .ld-coy .l2, .ld-coy .l3 { animation-name: ld-rr-coylegs2; }
        .ld-coy .tail { fill: var(--udc-text2); }
        .ld-stars { position: absolute; bottom: 30px; width: 34px; height: 14px; opacity: 0; z-index: 3; animation: ld-rr-stars 9s linear infinite; }
        .ld-stars span { position: absolute; top: 0; font-size: 11px; color: #f0c030; animation: ld-rr-orbit 1s linear infinite; }
        .ld-stars span:nth-child(2) { animation-delay: -.33s; } .stars span:nth-child(3) { animation-delay: -.66s; }
        .ld-dust { position: absolute; bottom: 20px; width: 8px; height: 8px; border-radius: 50%; background: color-mix(in srgb, #e0a060 45%, var(--udc-card)); opacity: 0; left: calc(72% - 6px); animation: ld-rr-dust 9s ease-out infinite; z-index: 3; }
        .ld-dust.b { --dx: -14px; } .dust.a { --dx: -4px; }
        @keyframes ld-rr-rrfill { 0% { width: 0; } 28% { width: calc(72% + 30px); } 36% { width: calc(72% + 37px); } 90%, 100% { width: 100%; } }
        /* Bis 28 % vor dem Portal, dann in die Mitte (Vogelmitte = Portalmitte
           bei 72% + 37px), dabei kleiner, etwas höher und dunkler. */
        @keyframes ld-rr-birdride {
          0% { left: -40px; transform: none; opacity: 1; filter: none; }
          28% { left: calc(72% - 6px); transform: none; opacity: 1; filter: none; }
          36% { left: calc(72% + 17px); transform: translateY(-10px) scale(.25); opacity: 0; filter: brightness(.3); }
          100% { left: calc(72% + 17px); transform: translateY(-10px) scale(.25); opacity: 0; filter: brightness(.3); }
        }
        /* "Mip mip!" hallt aus dem Tunnel, während der Kojote heranrennt. */
        @keyframes ld-rr-say { 0%, 36% { opacity: 0; left: calc(72% + 6px); transform: translateY(6px) scale(.8); } 39%, 52% { opacity: .9; left: calc(72% + 6px); transform: none; } 56%, 100% { opacity: 0; left: calc(72% + 6px); transform: translateY(-4px); } }
        @keyframes ld-rr-coyride { 0%, 6% { left: -80px; opacity: 1; } 42% { left: calc(72% - 70px); } 52% { left: calc(72% - 70px); } 60% { left: calc(72% - 78px); } 94% { left: calc(72% - 78px); opacity: 1; } 100% { left: calc(72% - 78px); opacity: 0; } }
        @keyframes ld-rr-coysquash { 0%, 41.5% { transform: none; } 42.5% { transform: scaleX(.55); } 50% { transform: scaleX(.6); } 53%, 100% { transform: none; } }
        @keyframes ld-rr-coyfall { 0%, 52% { transform: none; } 58%, 100% { transform: translateY(14px) rotate(-180deg); } }
        @keyframes ld-rr-coylegs { 0%, 6% { transform: rotate(0); } 7.4% { transform: rotate(30deg); } 8.8% { transform: rotate(-30deg); } 10.2% { transform: rotate(30deg); } 11.6% { transform: rotate(-30deg); } 13.0% { transform: rotate(30deg); } 14.4% { transform: rotate(-30deg); } 15.8% { transform: rotate(30deg); } 17.2% { transform: rotate(-30deg); } 18.6% { transform: rotate(30deg); } 20.0% { transform: rotate(-30deg); } 21.4% { transform: rotate(30deg); } 22.8% { transform: rotate(-30deg); } 24.2% { transform: rotate(30deg); } 25.6% { transform: rotate(-30deg); } 27.0% { transform: rotate(30deg); } 28.4% { transform: rotate(-30deg); } 29.8% { transform: rotate(30deg); } 31.2% { transform: rotate(-30deg); } 32.6% { transform: rotate(30deg); } 34.0% { transform: rotate(-30deg); } 35.4% { transform: rotate(30deg); } 36.8% { transform: rotate(-30deg); } 38.2% { transform: rotate(30deg); } 39.6% { transform: rotate(-30deg); } 41.0% { transform: rotate(30deg); } 43%, 100% { transform: rotate(0); } }
        @keyframes ld-rr-coylegs2 { 0%, 6.7% { transform: rotate(0); } 8.1% { transform: rotate(-30deg); } 9.5% { transform: rotate(30deg); } 10.9% { transform: rotate(-30deg); } 12.3% { transform: rotate(30deg); } 13.7% { transform: rotate(-30deg); } 15.1% { transform: rotate(30deg); } 16.5% { transform: rotate(-30deg); } 17.9% { transform: rotate(30deg); } 19.3% { transform: rotate(-30deg); } 20.7% { transform: rotate(30deg); } 22.1% { transform: rotate(-30deg); } 23.5% { transform: rotate(30deg); } 24.9% { transform: rotate(-30deg); } 26.3% { transform: rotate(30deg); } 27.7% { transform: rotate(-30deg); } 29.1% { transform: rotate(30deg); } 30.5% { transform: rotate(-30deg); } 31.9% { transform: rotate(30deg); } 33.3% { transform: rotate(-30deg); } 34.7% { transform: rotate(30deg); } 36.1% { transform: rotate(-30deg); } 37.5% { transform: rotate(30deg); } 38.9% { transform: rotate(-30deg); } 40.3% { transform: rotate(30deg); } 41.7% { transform: rotate(-30deg); } 43%, 100% { transform: rotate(0); } }
        @keyframes ld-rr-wallshake { 0%, 42% { transform: none; } 43% { transform: rotate(3deg); } 44% { transform: rotate(-2deg); } 45%, 100% { transform: none; } }
        @keyframes ld-rr-stars { 0%, 57% { opacity: 0; left: calc(72% - 74px); } 60%, 92% { opacity: 1; left: calc(72% - 74px); } 96%, 100% { opacity: 0; left: calc(72% - 74px); } }
        @keyframes ld-rr-orbit { from { transform: rotate(0) translateX(12px) rotate(0); } to { transform: rotate(360deg) translateX(12px) rotate(-360deg); } }
        @keyframes ld-rr-dust { 0%, 42% { opacity: 0; transform: none; } 43% { opacity: .9; } 50% { opacity: 0; transform: translate(var(--dx), -14px) scale(1.8); } 100% { opacity: 0; } }
        /* Auswahl in den Einstellungen mit Mini-Vorschau */
        .ld-intro {
          margin: 0 0 10px;
        }
        .ld-choices {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
          gap: 10px;
        }
        .ld-choice {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
          min-width: 0;
          padding: 8px 10px 10px;
          border: 1px solid var(--udc-divider);
          border-radius: 12px;
          background: none;
          color: var(--udc-text);
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .ld-choice:hover {
          background: var(--udc-hover);
        }
        .ld-choice.on {
          border-color: var(--udc-primary);
          box-shadow: inset 0 0 0 1px var(--udc-primary);
        }
        .ld-name {
          font-size: 13px;
          font-weight: 500;
        }
        .ld-desc {
          color: var(--udc-text2);
          font-size: 11px;
        }
        .ld-mini {
          position: relative;
          width: 100%;
          height: 58px;
          margin-bottom: 6px;
          overflow: hidden;
          pointer-events: none;
        }
        .ld-mini-in {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 180%;
          transform: scale(0.55);
          transform-origin: left bottom;
        }
        .ld-mini .ele-track {
          margin-top: 0;
        }
        .ld-dice {
          display: grid;
          place-items: center;
          color: var(--udc-text2);
        }
        .ld-dice svg {
          width: 30px;
          height: 30px;
        }
        @media (prefers-reduced-motion: reduce) {
          .ele-rider,
          .ele-rider *,
          .ele-done,
          .ele-words span,
          .ld-rider,
          .ld-rider *,
          .ld-actor,
          .ld-actor *,
          .ld-q,
          .ld-bang,
          .ld-drop,
          .ld-rr-actor,
          .ld-rr-actor *,
          .ld-desert .ele-done,
          .ld-wall *,
          .ld-stars,
          .ld-stars *,
          .ld-dust,
          .ld-say {
            animation: none !important;
          }
          .ld-bird {
            left: 40%;
          }
          .ld-coy {
            left: 10%;
          }
          .ld-stars,
          .ld-dust,
          .ld-say {
            opacity: 0;
          }
          .ld-rider,
          .ld-peng {
            left: 40%;
          }
          .ld-bear {
            left: 10%;
          }
          .ld-q,
          .ld-bang,
          .ld-drop {
            opacity: 0;
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
        .ver-btn.icon {
          justify-content: center;
          width: 34px;
          padding: 0;
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
        .ver.beta {
          background: color-mix(in srgb, var(--udc-ping2) 10%, var(--udc-subtle));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--udc-ping2) 40%, transparent);
        }
        .ver.beta .ver-ic {
          background: color-mix(in srgb, var(--udc-ping2) 20%, transparent);
          color: var(--udc-ping2);
        }
        .ver.beta .ver-btn.primary {
          border-color: var(--udc-ping2);
          background: var(--udc-ping2);
        }
        .ver.beta .ver-btn.primary:disabled {
          opacity: 0.45;
        }
        .ver-tag {
          display: inline-block;
          margin-left: 4px;
          padding: 0 7px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--udc-ping2) 20%, transparent);
          color: var(--udc-ping2);
          font-size: 11px;
          font-weight: 500;
          vertical-align: 1px;
        }
        .ver-hint {
          flex: 1 1 100%;
          padding: 9px 11px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--udc-warning) 14%, transparent);
          color: color-mix(in srgb, var(--udc-warning) 80%, var(--udc-text));
          font-size: 12.5px;
          line-height: 1.4;
        }
        .ver-hint-acts {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 14px;
          margin-top: 8px;
        }
        .ver-hint-acts .ver-btn {
          color: var(--udc-text);
        }
        .ver-hint-err {
          margin-top: 6px;
          color: var(--udc-error);
        }
        .ver-hint-link {
          padding: 0;
          border: none;
          background: none;
          color: inherit;
          font: inherit;
          font-weight: 500;
          text-decoration: underline;
          cursor: pointer;
        }
        .ver-opt {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 8px;
          padding: 2px 4px 0 14px;
        }
        .ver-opt-l {
          font-size: 14px;
        }
        .ver-opt-d {
          color: var(--udc-text2);
          font-size: 12px;
        }
        .sw-btn.beta.on {
          background: var(--udc-ping2);
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
          flex: 0 0 auto;
          box-sizing: border-box;
          width: 16px;
          height: 16px;
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
        dialog.conn-edit {
          width: min(440px, calc(100vw - 32px));
          max-height: calc(100% - 48px);
          padding: 0;
          border: none;
          border-radius: 22px;
          background: var(--udc-card);
          color: var(--udc-text);
          box-shadow: var(--udc-shadow);
          overflow: auto;
        }
        dialog.conn-edit::backdrop {
          background: rgba(0,0,0,0.5);
        }
        dialog.conn-edit .dlg-btn {
          flex: 1 1 auto;
        }
        .conn-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 14px;
          font-size: 14px;
        }
        .conn-field input {
          box-sizing: border-box;
          width: 100%;
          height: 42px;
          padding: 0 12px;
          border: 1px solid var(--udc-divider);
          border-radius: 10px;
          background: var(--udc-input);
          color: var(--udc-text);
          font: inherit;
          font-size: 16px;
        }
        .conn-field input:focus {
          outline: 2px solid var(--udc-primary);
          outline-offset: -1px;
        }
        .conn-field small,
        .conn-hint {
          color: var(--udc-text2);
          font-size: 12px;
          line-height: 1.4;
        }
        .conn-ssl {
          font-size: 14px;
        }
        .conn-hint {
          margin: 10px 0 0;
        }
        .conn-val {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--udc-text2);
        }
        .conn-status {
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 13px;
          white-space: nowrap;
          background: color-mix(in srgb, var(--udc-success) 14%, transparent);
          color: var(--udc-success);
        }
        .conn-status.auth_failed,
        .conn-status.offline {
          background: color-mix(in srgb, var(--udc-error) 12%, transparent);
          color: var(--udc-error);
        }
        .conn-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 10px;
        }
        .conn-banner {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 0 0 12px;
          padding: 12px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--udc-error) 12%, transparent);
          color: var(--udc-error);
          font-size: 14px;
        }
        .conn-banner > span {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex: 1 1 220px;
        }
        .conn-banner svg {
          flex: 0 0 auto;
          width: 20px;
          height: 20px;
        }
        .conn-banner .dlg-btn {
          border-color: var(--udc-error);
          background: var(--udc-error);
        }
        /* Statistik-Kacheln und Unter-Fenster */
        .st-tiles {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .st-tiles.n2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .st-tiles.n1 {
          grid-template-columns: minmax(0, 1fr);
        }
        .st-tile {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
          min-width: 0;
          padding: 10px 11px;
          border: 1px solid var(--udc-divider);
          border-radius: 14px;
          background: var(--udc-subtle);
          color: var(--udc-text);
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .st-tile:hover {
          border-color: color-mix(in srgb, var(--udc-primary) 50%, transparent);
        }
        .st-tile.static {
          cursor: default;
        }
        .st-tile.static:hover {
          border-color: var(--udc-divider);
        }
        /* Pfeil unten rechts: der Titel hat so die volle Breite. */
        .st-tile > svg {
          position: absolute;
          right: 6px;
          bottom: 7px;
          width: 16px;
          height: 16px;
          fill: var(--udc-text3);
        }
        /* Titel und Zusatzzeile dürfen auf schmalen Kacheln umbrechen
           (Handy, drei Kacheln nebeneinander), statt abgeschnitten zu werden. */
        .st-k {
          max-width: 100%;
          overflow: hidden;
          color: var(--udc-text2);
          font-size: 12px;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .st-v {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 18px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .st-v small {
          color: var(--udc-text2);
          font-size: 12px;
          font-weight: 400;
        }
        .st-v .st-small {
          font-size: 14px;
          font-weight: 400;
        }
        .st-sub {
          max-width: calc(100% - 12px);
          color: var(--udc-text3);
          font-size: 11.5px;
          line-height: 1.3;
        }
        dialog.stat-dlg {
          width: min(560px, calc(100vw - 32px));
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
        /* Dialog dahinter stark gedimmt und unscharf, sein X ausgeblendet:
           so ist klar, welches Fenster gerade gilt. */
        dialog.stat-dlg::backdrop {
          background: rgba(0,0,0,0.7);
          -webkit-backdrop-filter: blur(3px);
          backdrop-filter: blur(3px);
        }
        :host([stat-open]) dialog.device .dlg-head .dlg-close,
        :host([stat-open]) dialog.settings .dlg-head .dlg-close {
          visibility: hidden;
        }
        @media (max-width: 600px) {
          dialog.stat-dlg {
            width: 100%;
            max-width: 100%;
            height: 86%;
            max-height: 86%;
            margin: auto 0 0;
            border-radius: 22px 22px 0 0;
          }
        }
        .stat-head {
          align-items: center;
        }
        /* Tabs: Segment über die volle Breite, gleiche Form wie der
           Zeitraum-Schalter, aber grösser und mit Symbolen. */
        .stat-tabs {
          display: flex;
          gap: 2px;
          padding: 3px;
          margin: 0 0 12px;
          border-radius: 12px;
          background: var(--udc-subtle);
        }
        .stat-tab {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 6px;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: var(--udc-text2);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        .stat-tab svg {
          flex: 0 0 auto;
          width: 16px;
          height: 16px;
          fill: currentColor;
        }
        .stat-tab.on {
          background: var(--udc-card);
          color: var(--udc-text);
          font-weight: 500;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .stat-tab.on svg {
          fill: var(--udc-primary);
        }
        .stat-tab .sh {
          display: none;
        }
        @media (max-width: 600px) {
          .stat-tab .lg {
            display: none;
          }
          .stat-tab .sh {
            display: inline;
          }
        }
        .stat-avatar {
          width: 44px;
          height: 44px;
          border-radius: 13px;
        }
        .stat-avatar svg {
          width: 24px;
          height: 24px;
        }
        .stat-range {
          display: flex;
          margin: 0 0 12px;
        }
        dialog.stat-dlg section.ping {
          margin-top: 0;
        }
        .stat-list {
          margin-top: 12px;
          padding-top: 6px;
          border-top: 1px solid var(--udc-divider);
          font-size: 13px;
        }
        .stat-list div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 0;
        }
        .stat-list div span:last-child {
          text-align: right;
        }
        /* WLAN-Fächer (4 Stufen) */
        .wfan {
          width: 18px;
          height: 14px;
          flex: 0 0 auto;
          vertical-align: -2px;
        }
        .wfan .s {
          fill: none;
          stroke: color-mix(in srgb, var(--udc-text) 16%, transparent);
          stroke-width: 2.2;
          stroke-linecap: round;
        }
        .wfan .d {
          fill: color-mix(in srgb, var(--udc-text) 16%, transparent);
        }
        .wfan.w4 .s { stroke: var(--udc-ping5); }
        .wfan.w4 .d { fill: var(--udc-ping5); }
        .wfan.w3 .s.a1,
        .wfan.w3 .s.a2 { stroke: var(--udc-ping3); }
        .wfan.w3 .d { fill: var(--udc-ping3); }
        .wfan.w2 .s.a1 { stroke: var(--udc-ping2); }
        .wfan.w2 .d { fill: var(--udc-ping2); }
        .wfan.w1 .d { fill: var(--udc-ping1); }
        .wfan.stale {
          opacity: 0.5;
        }
        .wfan.stale .s {
          stroke: color-mix(in srgb, var(--udc-text3) 60%, transparent) !important;
        }
        .wfan.stale .d {
          fill: var(--udc-text3) !important;
        }
        .wfan-wrap {
          display: inline-flex;
          margin-left: 4px;
        }
        .sig-chart .pb.w4 { background: var(--udc-ping5); }
        .sig-chart .pb.w3 { background: var(--udc-ping3); }
        .sig-chart .pb.w2 { background: var(--udc-ping2); }
        .sig-chart .pb.w1 { background: var(--udc-ping1); }
        .sig-legend i.w4 { background: var(--udc-ping5); }
        .sig-legend i.w3 { background: var(--udc-ping3); }
        .sig-legend i.w2 { background: var(--udc-ping2); }
        .sig-legend i.w1 { background: var(--udc-ping1); }
        /* Ping: Tabellenzelle, Geräteansicht, Schalter */
        .ping-val {
          display: inline-flex;
          flex-direction: column;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .ping-loss {
          color: var(--udc-ping1);
          font-size: 11px;
        }
        .ping-line {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        /* 5 Balken wie die Signalstärke, Farbe je Stufe */
        .pbars {
          display: inline-flex;
          align-items: flex-end;
          gap: 2px;
          height: 14px;
          flex: 0 0 auto;
        }
        .pbars u {
          width: 3px;
          border-radius: 1px;
          background: color-mix(in srgb, var(--udc-text) 14%, transparent);
        }
        .pbars u:nth-child(1) { height: 3px; }
        .pbars u:nth-child(2) { height: 5.5px; }
        .pbars u:nth-child(3) { height: 8px; }
        .pbars u:nth-child(4) { height: 11px; }
        .pbars u:nth-child(5) { height: 14px; }
        .pbars.t5 u { background: var(--udc-ping5); }
        .pbars.t4 u:nth-child(-n+4) { background: var(--udc-ping4); }
        .pbars.t3 u:nth-child(-n+3) { background: var(--udc-ping3); }
        .pbars.t2 u:nth-child(-n+2) { background: var(--udc-ping2); }
        .pbars.t1 u:nth-child(1) { background: var(--udc-ping1); }
        .ping-stat b .pbars {
          margin-right: 7px;
          vertical-align: -1px;
        }
        section.ping {
          margin-top: 18px;
        }
        .ping-range {
          color: var(--udc-text3);
          font-size: 12px;
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
        }
        .ping-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .ping-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px 12px;
          border-radius: 12px;
          background: var(--udc-subtle);
          min-width: 0;
        }
        .ping-stat span {
          color: var(--udc-text2);
          font-size: 12px;
        }
        .ping-stat b {
          font-size: 16px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .ping-stat.warn b {
          color: var(--udc-ping1);
        }
        .ping-chart {
          position: relative;
          height: 56px;
          margin-top: 12px;
          border-radius: 8px;
          background: var(--udc-subtle);
          overflow: hidden;
        }
        .ping-chart .pb {
          position: absolute;
          bottom: 0;
          width: max(1px, calc(100% / var(--n) - 0.5px));
          border-radius: 1px 1px 0 0;
          background: var(--udc-ping5);
        }
        .ping-chart .pb.t4 { background: var(--udc-ping4); }
        .ping-chart .pb.t3 { background: var(--udc-ping3); }
        .ping-chart .pb.t2 { background: var(--udc-ping2); }
        .ping-chart .pb.t1 { background: var(--udc-ping1); }
        /* Paketverlust: roter Deckel auf der Säule */
        .ping-chart .pb.lossy {
          box-shadow: inset 0 3px 0 var(--udc-ping1);
        }
        .ping-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 12px;
          margin-top: 6px;
          color: var(--udc-text2);
          font-size: 11px;
        }
        .ping-legend span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .ping-legend i {
          width: 9px;
          height: 9px;
          border-radius: 2px;
        }
        .ping-legend i.t5 { background: var(--udc-ping5); }
        .ping-legend i.t4 { background: var(--udc-ping4); }
        .ping-legend i.t3 { background: var(--udc-ping3); }
        .ping-legend i.t2 { background: var(--udc-ping2); }
        .ping-legend i.t1 { background: var(--udc-ping1); }
        .ping-legend i.lossmark {
          background: var(--udc-subtle);
          box-shadow: inset 0 3px 0 var(--udc-ping1);
        }
        .ping-chart .pb.none {
          height: 4px;
          background: var(--udc-error);
        }
        .ping-scale {
          position: absolute;
          top: 3px;
          left: 6px;
          color: var(--udc-text3);
          font-size: 11px;
          pointer-events: none;
        }
        .ping-axis {
          display: flex;
          justify-content: space-between;
          margin-top: 3px;
          color: var(--udc-text3);
          font-size: 11px;
        }
        .ping-entity-note {
          margin: 12px 0 0;
        }
        .ping-entity {
          margin-top: 8px;
          border-bottom: none;
        }
        .sw-btn {
          position: relative;
          flex: 0 0 auto;
          width: 36px;
          height: 20px;
          padding: 0;
          border: none;
          border-radius: 99px;
          background: color-mix(in srgb, var(--udc-text) 25%, transparent);
          cursor: pointer;
          transition: background 0.15s;
        }
        .sw-btn span {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: left 0.15s;
        }
        .sw-btn.on {
          background: var(--udc-primary);
        }
        .sw-btn.on span {
          left: 18px;
        }
        .sw-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .sw-btn:focus-visible {
          outline: 2px solid var(--udc-primary);
          outline-offset: 2px;
        }
        .ping-note {
          margin: 6px 0 4px;
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
`;
