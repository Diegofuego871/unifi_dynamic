# Changelog

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.2.0] - 2026-09-24

### Added

- Link a client to any Home Assistant device. The device view has a new
  "Linked device" section: "Link a device…" opens a searchable list of all
  Home Assistant devices (name, area, manufacturer, model), with devices
  that report the client's MAC address suggested at the top. A linked
  device shows with its area and model, can be changed or unlinked, and a
  click on it opens its device page.
- New "HA device" table column with the linked device's name; one click
  opens its device page. The column is sortable, and the search also finds
  clients by the linked device's name and area.
- The link is stored by this integration only and never changes the linked
  device; devices of this integration can't be linked. Removing a client —
  by hand or by the purge — also removes its link, and a link to a device
  that was deleted in Home Assistant is dropped automatically. There is
  deliberately no automatic merging by MAC address, so removing a client can
  never affect the other integration's device.
- WebSocket commands `unifi_dynamic/list_devices` and
  `unifi_dynamic/link_device` (admin only, like the others).

### Changed

- README screenshots re-rendered with the new column and section, again
  with entirely made-up data.

## [2.1.1] - 2026-09-23

### Added

- Copy buttons in the device view: IP, MAC, hostname, SSID and access point
  each get a small button that copies just that value, and every entity gets
  one next to its entity ID that copies only the ID. The icon briefly turns
  into a check mark and Home Assistant shows a short "Copied: …" toast.
  Works on plain `http://` too, where browsers don't provide the clipboard
  API, by falling back to the browser's legacy copy command.

### Changed

- An entity row in the device view still opens Home Assistant's entity
  dialog on click, and now also with Enter or Space when focused via
  keyboard.
- README device-view screenshots re-rendered with the copy buttons.

## [2.1.0] - 2026-09-23

### Added

- Device view in the panel: tapping a row (or "Details" in its ⋮ menu)
  opens a dialog with everything known about the client — status,
  protection, connection type, IP, MAC, hostname, SSID, access point,
  signal (dBm and RSSI), first seen and last seen with relative times — plus
  its Home Assistant entities with their current state (tapping one opens
  Home Assistant's entity dialog) and the actions "Open HA device page",
  protect / stop protecting and "Remove". It closes by itself after a
  successful removal; a failed action shows its error inside the dialog. On
  a phone it slides up from the bottom as a sheet.
- Row taps are guarded against accidental opening: swipes never count, and
  neither does a tap within 300 ms of scrolling, a tap while a row menu is
  open, or selecting text.
- New option "Tapping a device notification opens" in the push section:
  "Device view in the panel" (default) or "Home Assistant device page" for
  anyone who doesn't use the panel. The panel link
  (`/unifi-dynamic?entry=…&mac=…`) opens the client's device view, also when
  the panel is already open, and then clears itself from the address; a
  client that no longer exists shows a notice.
- The integration now also stores the controller's `first_seen` and
  `signal` per client. If the controller doesn't provide `first_seen`, the
  integration records when it first saw the client itself; clients known
  before this version show "unknown" rather than a made-up date.

### Changed

- The ⋮ menu's "Open device page" is now labeled "Open HA device page", to
  tell it apart from the panel's own device view.

## [2.0.14] - 2026-09-22

### Changed

- The status bar's counts now follow the wired/wireless filter: with
  "Wired" selected it shows how many wired devices there are and how many
  of them are online and offline, likewise for "Wireless". The search and
  the online/offline choice still don't affect the numbers — otherwise
  "online" would read 0 while showing only offline devices. Table and
  counter share the same filter rule, so they can't drift apart.

## [2.0.13] - 2026-09-22

### Added

- The panel's toolbar shows a status bar counting all devices and how many
  of them are online and offline ("40 devices · ● 34 online · ○ 6
  offline"), across all hosts and regardless of the search or the other
  filter. It doubles as the online/offline filter: tapping "online" or
  "offline" shows only those devices, tapping the active part again goes
  back to all, and the active part is highlighted in the theme's accent
  color. The choice is remembered like the other filters.

### Changed

- The status bar replaces the former "All/Online/Offline" dropdown, so the
  counter takes no extra room. On a phone it gets its own full-width row,
  the connection filter and the reset button share the next one, and the
  toolbar's spacing is a little tighter — 12px less height than before
  despite the counter, leaving that much more room for the table.
- README screenshots re-rendered with the status bar, again with entirely
  made-up data.

## [2.0.12] - 2026-09-22

### Fixed

- The panel's own menu (☰) button, added in 2.0.9, never opened the
  sidebar: it fired Home Assistant's `hass-toggle-menu` event on `window`,
  but Home Assistant listens for it on its `home-assistant-main` element,
  and an event fired on `window` never reaches any element. The panel is
  now registered as one of Home Assistant's built-in iframe panels (the
  same approach Orphan Cleaner uses), so the header bar with the title and
  the menu button — including its dot for pending notifications — is Home
  Assistant's own, exactly as on its built-in panels. The panel's own
  button and title are gone.
- The toolbar still slid away sideways and the header ended up under the
  iPhone's status bar in 2.0.11 while scrolling on a phone. As an iframe
  panel, the page gets a fixed height from Home Assistant, which is what
  the earlier attempts (2.0.7–2.0.11) never reliably had: search and
  filters now stay put, and only the table scrolls — up/down, and sideways
  where not all columns fit. Column headers stay at the top when scrolling
  down and move with their columns when scrolling sideways. Verified with
  real touch-drag gestures in a mobile browser emulation, checking that the
  table actually scrolled — the tests behind 2.0.9 through 2.0.11 did not
  check that, which is how both problems slipped through.
- The README screenshots showed real MAC and IP addresses from a real
  network, only with the device names changed, despite being described as
  fabricated. Both screenshots are re-rendered with entirely made-up data
  (locally administered MAC addresses, which are never assigned to any
  manufacturer) and the current menu labels.

### Changed

- The page inside the panel uses Home Assistant's existing, already
  signed-in connection from the surrounding window (no separate login or
  token) and takes over the active theme's colors, so it follows light and
  dark mode like before. The WebSocket commands are unchanged.
- On a phone, the integration's icon now sits in the same row as the
  search box instead of taking up a row of its own, leaving more room for
  the table.
- Dependency `panel_custom` replaced by `frontend` in `manifest.json`.

## [2.0.11] - 2026-09-22

### Fixed

- 2.0.10 replaced the sticky toolbar/header with a single scroll container
  (`.content`, sized from JavaScript) to fix the column headers ending up
  mid-list instead of at the top. On a real phone this traded one bug for
  another: without a `<meta name="viewport">` tag of its own — which this
  panel never had and doesn't need, since the surrounding Home Assistant
  document already provides one — a page with any element wider than the
  screen falls back to a browser's default 980px layout viewport and
  render everything zoomed out to fit, which is what made the whole panel
  render tiny. Reproducing that behavior needs actual mobile emulation
  (a touch-enabled, non-desktop browser context); the desktop-sized
  headless window used for testing 2.0.7 through 2.0.10 never exercised
  this path, which is how it went unnoticed until now.
  2.0.11 goes back to the 2.0.9 approach (`position: sticky` on the
  toolbar, error banner and column headers, the whole page scrolling
  underneath) — this renders at the expected size, and the underlying
  table still scrolls sideways on a phone exactly as before, which is
  expected given how many columns it has. The one real defect in that
  approach is fixed directly instead: `position: sticky` only pins the
  axis it's given a value for, and without `left`/`right` the toolbar and
  error banner had no horizontal anchor, so they slid off screen along
  with the page during horizontal scrolling instead of spanning the full
  width. They now pin `left: 0; right: 0` too. The column headers are left
  exactly as they were — they're meant to move sideways with their column,
  just not vertically.

## [2.0.10] - 2026-09-22

### Fixed

- The 2.0.8/2.0.9 approach (`position: sticky` on the toolbar, error banner
  and column headers, with the whole page scrolling underneath) held up
  fine for pure vertical scrolling, but the table has more columns than
  fit on a phone screen, and nothing constrained that horizontal overflow
  either — so the whole page became scrollable sideways too. `position:
  sticky` only pins the axis it's given a value for; with no `left`, the
  toolbar and column headers slid off screen horizontally along with
  everything else once the page scrolled sideways, which is what showed as
  the toolbar not spanning the full width and the column headers ending up
  in the middle of the row list instead of staying at the top.
  `.content` (the table's wrapper) is now the sole scroll container again,
  in both directions at once, with its height set from JavaScript
  (`window.innerHeight` minus the toolbar's and error banner's real
  rendered height) rather than relying on a CSS percentage-height chain
  through Home Assistant's panel host, which is what made the original
  2.0.6-and-earlier version of this same approach unreliable in the first
  place. The toolbar and error banner are back in normal document flow,
  outside that scroll container, so they can no longer be affected by the
  table's horizontal scrolling — one self-contained scroll area for the
  table, nothing scrolls outside it.

## [2.0.9] - 2026-09-22

### Fixed

- On a narrow screen — the iOS/Android companion apps, or a phone browser —
  there was no way back from the panel to Home Assistant's sidebar: a
  custom panel receives no menu button from Home Assistant itself, and
  swiping only scrolled the table horizontally instead of navigating away.
  The toolbar now shows a menu (☰) button on the left, dispatching the
  same `hass-toggle-menu` event the built-in panels use to open the
  sidebar. It stays hidden on wider screens where the sidebar is already
  visible, tracking the `narrow` property Home Assistant already passes to
  the panel, live, so it reacts to rotating the device or resizing the
  window without a reload.

## [2.0.8] - 2026-09-22

### Fixed

- The 2.0.7 fix for the scrolling toolbar didn't hold up in the real
  frontend: it relied on an unbroken chain of definite heights from
  `ha-panel-custom` down to the panel's own host element so that the table
  area alone could scroll internally, but `ha-panel-custom` doesn't set a
  definite height on itself, so that chain never resolves and the whole
  panel — including the column headers, which the 2.0.7 notes didn't call
  out — kept scrolling away with the page. Replaced with `position: sticky`
  directly on the toolbar, the error banner and the column headers instead,
  which doesn't depend on any ancestor's height being definite — it simply
  sticks to whichever ancestor actually ends up scrolling. The offset the
  column headers and error banner stick below is measured from the
  toolbar's real rendered height via `ResizeObserver`, so it stays correct
  when the toolbar wraps onto two lines on narrow windows or its text
  changes with the interface language.

### Added

- The panel's row menu has a new "Stop protecting" action, shown instead of
  "Protect from automatic removal" once a client is already on the
  exclusion list, to take it back off — until now that list could only be
  edited from the integration's options dialog. New WebSocket command
  `unifi_dynamic/unexclude_client` backing it.

### Changed

- Renamed two of the panel's row-menu actions for clarity: "Never remove"
  is now "Protect from automatic removal" (matching the "protected" badge
  already used for excluded clients elsewhere in the table), and
  "Remove now" is now just "Remove". Push/persistent notification button
  text is unchanged.

## [2.0.7] - 2026-09-21

### Fixed

- The panel's toolbar (title, search box, filters, reset button) used to
  scroll away with the page instead of staying in view, because the panel's
  host element only had a fixed height without an actual layout to enforce
  it — its content area had no bounded height to scroll within, so the
  whole panel grew past the viewport and the outer page scrolled instead.
  The toolbar (and the error banner) now stay fixed at the top; only the
  client table underneath scrolls.

### Changed

- README.md and README.de.md no longer show the caption paragraph under
  the panel screenshot explaining that the data is fabricated — the
  screenshots already read as clearly illustrative without it.

## [2.0.6] - 2026-09-21

### Changed

- README.md and README.de.md now show a screenshot of the panel, one per
  language. Both are genuine renders of the current panel code with
  fabricated data (device names, IPs and MAC addresses — not a real
  network), produced with a headless browser rather than edited image text
  — so the interface language shown is real behavior, not a mockup. Since
  none of the data is real, no redaction was needed on either image.

## [2.0.5] - 2026-09-21

### Fixed

- The search box's fixed width from 2.0.4 turned out too narrow once seen
  live. Widened it roughly threefold; it still cannot grow past that width
  and crowd out the filters and reset button the way it did in 2.0.3.

## [2.0.4] - 2026-09-21

### Fixed

- The row menu (⋮) in the panel table could be cut off by the table's own
  scroll area when opened from one of the last visible rows, because it was
  positioned relative to the scrolling table itself. It now uses the
  button's actual on-screen position and opens upward automatically when
  there is not enough room below — a fixed "always upward" would have
  caused the identical problem for the topmost rows instead. The menu also
  closes on scroll so it cannot drift away from its row.
- The search box became too wide in 2.0.3 — it grew to dominate the
  toolbar and crowd out the filters and the reset button. Width is back to
  a fixed, reasonable size; the box is taller and its text larger instead,
  which was the actual request.

### Added

- The integration's icon now appears in the panel's toolbar next to the
  title, reusing the same image already served for push notifications. If
  it fails to load for any reason, it is hidden rather than showing a
  broken-image icon.

## [2.0.3] - 2026-09-21

### Changed

- The search box in the panel is noticeably larger: it now takes up more of
  the toolbar's width, and both the padding and font size are bigger.

### Added

- A "×" button appears inside the search box, right-aligned, once there is
  text in it. Clicking it clears the search and refocuses the box. This is
  a custom button rather than the native clear icon `type="search"` inputs
  sometimes show, because that native icon's appearance is inconsistent
  across browsers (Chrome shows one, Firefox and Safari do not reliably).

## [2.0.2] - 2026-09-21

### Added

- The panel's search text, both filter dropdowns, and the sort column and
  direction are now remembered across reloads — including a full Home
  Assistant restart, since this is stored in the browser's `localStorage`,
  which has nothing to do with the HA process and survives regardless. It
  is per browser/device, not synced across them.
- A "Reset filters" button in the toolbar clears the search box, resets
  both dropdowns to "All", and turns off sorting, in one click — the
  counterpart to state that now persists silently and might otherwise be
  hard to notice or undo.

### Notes

- Malformed or unrecognized stored values (an old format, a value that no
  longer matches a real column) are rejected individually and fall back to
  their default rather than discarding the whole saved state or breaking
  the panel.

## [2.0.1] - 2026-09-21

### Added

- Column headers in the panel table are now sortable: click once to sort
  ascending, click the same header again to reverse to descending, click a
  different header to sort by that column instead (starting ascending). A
  small arrow next to the header name shows the active column and
  direction. Missing values (no IP, never seen) always sort to the end,
  regardless of direction.

### Changed

- Clicking a table row no longer opens that client's device page. It was
  too easy to trigger by accident while scanning or scrolling the table.
  The device page is now reachable only through the row's ⋮ menu ("Open
  device page").

### Fixed

- The panel's remove and exclude actions called the backend without error
  handling. A failure (for example, a permission error) vanished as an
  unhandled promise rejection in the browser console with nothing shown in
  the table. Both actions now surface a failure through the same error
  banner already used for a failed client-list load.

## [2.0.0] - 2026-09-21

### Added

- A new panel, pinned in the sidebar ("UniFi Dynamic Clients"), shows a
  searchable, filterable table of every client across all configured UniFi
  hosts: alias, IP, MAC, SSID, access point, connection type, last seen and
  online status. The search box matches across all of those fields at once;
  two dropdowns additionally filter by online/offline and wired/wireless.
- Each row has a ⋮ menu with "Never remove" (adds to the exclusion list,
  disabled if already on it) and "Remove now" (asks for confirmation first).
  Both call the same coordinator logic as the notification actions and the
  `unifi_dynamic.remove_client` service — no new removal or exclusion logic,
  just a third way to trigger it. Clicking a row (outside the menu) opens
  that client's device page, the same one linked from notifications.
- Three new WebSocket commands back the panel: `unifi_dynamic/list_clients`,
  `unifi_dynamic/remove_client`, `unifi_dynamic/exclude_client`. All three
  require administrator rights, consistent with the panel itself
  (`require_admin=True`) — viewing the table is gated the same as the
  destructive actions in it, so a non-admin user never sees a menu item they
  cannot actually use.
- With more than one UniFi host configured, the table shows all of them at
  once (one shared panel, not one per host) with a host column, since a
  device page and the exclusion list are per-entry but the overview is
  naturally a single list.

### Notes

- The panel is a hand-written vanilla Web Component with no external
  library and no build step: HACS installs this integration as a plain file
  copy, so there is no bundler to produce a dist file from, and Lit is not
  available to a registered panel as a global import the way some Lovelace
  card tricks can reach it. A CDN import was ruled out too — it would make
  the panel depend on the browser having internet access, on top of the
  local Home Assistant connection it already needs.
- The table refreshes by polling every 10 seconds while the panel is open,
  not by push. A WebSocket subscription that pushes changes immediately was
  considered and deliberately deferred: more server and client code, more
  failure modes, for a table a person is actively looking at rather than a
  notification that has to arrive unprompted.
- Panel UI text is bilingual too, chosen from `hass.language` — the signed-in
  user's own frontend language, not `hass.config.language` like the
  notifications. This is deliberate: a panel renders per browser session for
  whoever is looking at it, unlike a push notification the integration sends
  without knowing who reads it.
- This has been verified with a simulated WebSocket payload and the table's
  own filter/search/date-formatting logic run directly in Node — not against
  a live Home Assistant instance or a real browser. Sidebar registration,
  actual rendering, and the row menu have not been visually confirmed.

## [1.21.0] - 2026-09-20

### Added

- Push notifications and persistent notifications are now bilingual (German
  and English), chosen at send time from `hass.config.language` (the
  instance's configured language) — German for `de`/`de-*`, English as the
  fallback for everything else, including a language Home Assistant is not
  configured for at all. This covers every title and body text: the purge
  report, the new-device notification, the action-button labels ("Nie
  entfernen"/"Jetzt entfernen" become "Never remove"/"Remove now" and vice
  versa), the exclusion and removal confirmations, and the controller
  offline/recovered notifications.

### Changed

- All message text moved out of `notification.py` and `const.py` into a new
  module, `msg.py`, that holds both language versions side by side per
  message. Message text is no longer a Python string constant or an inline
  f-string; every future change to wording needs both languages updated in
  the same place, the same way `strings.json`/`translations/en.json` already
  had to stay in sync for the options dialog.

### Notes

- `hass.config.language` is the Home Assistant instance's configured
  language, not necessarily the language of the phone or app the
  notification arrives on. For most single-household setups these match; a
  setup where they do not will see notifications in the instance's language,
  not the viewer's.
- Untranslated: log messages (`_LOGGER.*` calls, meant for the add-on's own
  maintainer, not the end user) and the options dialog, which already has
  its own translation mechanism through `strings.json`/`translations/*.json`
  and was unaffected by this change.

## [1.20.6] - 2026-09-20

### Changed

- The confirmation after a notification action ("Nie entfernen" / "Jetzt
  entfernen") now gets its own notification tag instead of reusing the tag
  of the original new-device notification. iOS removes a notification from
  Notification Center as soon as an action on it is tapped; a confirmation
  arriving right after with the same tag was, depending on timing,
  effectively replacing one that had already been dismissed by the system,
  and would then sometimes not show as a new banner at all. The confirmation
  no longer replaces the original notification (both can briefly coexist,
  though the original is usually gone already from the tap that triggered
  the confirmation) — reliability of the confirmation was judged more
  important than that visual tidiness.
- The action buttons now set `"behavior": "background"` explicitly instead
  of relying on it being the default with no `uri` set on the button. This
  targets a case that could not be fully explained from the integration's
  own code: a report of the app navigating to the (by then already deleted)
  device page after tapping "Jetzt entfernen", although the documented
  default for a button without its own `uri` is to not navigate at all.

### Fixed

- `device_registry.async_get_device(identifiers=...)` is deprecated as of
  Home Assistant's move to per-config-entry-unique device identifiers and
  logs a warning on every call; it will stop working in Home Assistant
  2027.8.0. All six call sites now go through a single helper,
  `get_client_device()`, that uses the replacement
  `async_get_device_by_identifier()` when it is available.

### Notes

- `async_get_device_by_identifier()` only exists from Home Assistant
  2026.8.0 onward, while `hacs.json` declares 2024.1.0 as the minimum
  supported version. Switching outright would have traded one deprecation
  warning for a hard `AttributeError` on every older, still-supported core.
  `get_client_device()` checks `hasattr(...)` once at import time and falls
  back to the old, still-working `async_get_device()` on cores that lack the
  new method — no support for pre-2026.8.0 was given up for this fix.

## [1.20.4] - 2026-09-20

### Fixed

- A failure while handling the "Jetzt entfernen" (or "Nie entfernen") action
  from a push notification occurred outside the handler's error handling. The
  removal itself, the exclusion-list update and the confirmation push all sat
  in a single unprotected block; the actual `try`/`except` only wrapped the
  confirmation call. An exception during removal propagated out of the event
  handler uncaught, so the tap produced no confirmation and no clearly
  attributable log entry — indistinguishable from the tap never reaching Home
  Assistant at all. The whole action is now inside the `try` block, and a
  failure is always logged with the action kind, MAC and entry ID.

### Notes

- A new debug log line ("Meldungsaktion ... empfangen") fires as soon as a
  matching action reaches the handler, before anything else runs. With debug
  logging enabled for `custom_components.unifi_dynamic`, its absence after a
  button tap now points at the phone/companion-app side (the event never
  reaching Home Assistant) rather than at this integration; its presence
  followed by an error traceback points at a real failure in the removal or
  exclusion-list logic.
- This closes a genuine gap in the error handling, found by static review.
  It has **not** been confirmed against a live report of "Jetzt entfernen"
  doing nothing — no Home Assistant log from the failing run was available.
  If the button still produces no reaction after this update, the debug log
  line above is the next diagnostic step.

## [1.20.3] - 2026-09-20

### Removed

- The 15-minute hold on new-device notifications after a manual removal is
  gone. It was meant to prevent a loop between removing a client and being told
  about it again, but it silently swallowed the notification for a client that
  was still active: the device came back on the next poll with no word about
  it, which looks like a defect rather than a feature. Removing a client that
  is still on the network now reports it as new again, which is what it is as
  far as the cache is concerned.

### Changed

- The confirmation after a manual removal says so: "Ist der Client noch aktiv,
  legt ihn der nächste Abgleich wieder an und meldet ihn erneut."

### Fixed

- The description of the outage notification option still described the
  behavior of 1.20.0: an hour of silence, checked every 15 minutes, purge
  suspended. Since 1.20.1 the threshold is the configured number of failed
  polls, the check is event-driven, and the purge keeps its own separate
  threshold — so the text promised something the integration no longer did.

## [1.20.2] - 2026-09-20

### Added

- New action `unifi_dynamic.remove_client` removes individual clients on
  demand, without waiting for the threshold and without regard for the
  exclusion list. Until now that was only possible from a notification, which
  is no help for a client whose notification is long gone or that was never
  reported in the first place.
- Targets can be picked as devices, so the UI offers the integration's devices
  directly, or given as MAC addresses for clients that no longer exist in Home
  Assistant. Both accept multiple values and can be combined in one call.
- MAC addresses are accepted with colons, hyphens, dots or as a bare hex
  string, so a value copied from a log or from the UniFi interface works as-is.
- The action returns what it did per client: entry, MAC, name, number of
  removed entities and devices, and whether the client was online at the time
  — in which case the next poll will recreate it. Unknown addresses come back
  with `removed: false` instead of failing the call.
- With several UniFi hosts configured, a MAC without an explicit config entry
  is looked up on all of them; the same address can legitimately exist in
  separate networks.

### Notes

- Removal by action is subject to the same 15-minute hold on new-device
  notifications as the notification button, so a returning client does not
  immediately produce a fresh report.
- Unlike the notification button, the action sends no confirmation push. The
  caller sees the response, and an automation that removes clients in bulk
  should not produce a notification per client.

## [1.20.1] - 2026-09-20

### Changed

- Controller outages are now detected by counting consecutive failed polls
  instead of waiting for an hour of silence. The fixed hour ignored the polling
  interval: at 15 seconds it meant 240 wasted attempts before anyone was told.
  The new option "Als ausgefallen nach (Abfragen)" sits in the polling section,
  right below the interval it depends on, and defaults to 30 — 7.5 minutes at a
  15-second interval, half an hour at 60 seconds.
- Detection is now event-driven rather than scheduled. The 15-minute check is
  gone: the outage is reported the moment the configured number of attempts has
  failed, and the all-clear goes out with the first poll that succeeds, so both
  arrive within one polling interval instead of up to 15 minutes late.
- The outage message names the number of failed polls alongside the elapsed
  time, and durations are now given in whatever unit fits — seconds, minutes,
  hours or days — instead of always in hours.

### Notes

- The counter resets on every successful poll, so isolated hiccups never add
  up to an outage.
- Low values report faster but also react to single failures. At 1 the very
  first timeout is an outage; the practical floor depends on how reliably the
  controller answers.
- The purge protection is deliberately left on its own one-hour threshold. It
  guards against deleting an inventory the integration cannot see, which a
  short outage does not endanger, and a sensitive reporting threshold should
  not start suspending the daily run.
- Both switches from 1.20.0 still decide whether anything is sent at all; the
  new option only decides when an outage is considered one.

## [1.20.0] - 2026-09-20

### Fixed

- The purge no longer deletes the inventory while the controller is
  unreachable. Ages were measured against the wall clock, so a controller that
  stayed away — replaced hardware, changed address, rotated API key — let every
  timestamp age on although not a single client had actually disappeared. After
  `purge_days` the daily run removed all of them, devices and entities
  included. Both the staleness check and the reported age are now measured
  against the last successful poll, the same reference `is_client_online()`
  already used.
- If that poll is more than an hour old, or if there has not been one at all,
  the run is skipped entirely instead of working from timestamps it cannot
  trust.

### Added

- A skipped run of that kind is reported rather than passing unnoticed. The
  message states how long the controller has been silent and how many clients
  stay untouched, and it carries the title suffix "(ausgesetzt)". It is sent
  even when "Also report when nothing was removed" is off, because a skipped
  run is a fault, not an empty result. A run skipped because `purge_days` is 0
  stays silent as before, and so does a skipped run with an empty cache.
- New-device notifications now offer two buttons. "Nie entfernen" adds the
  client to the exclusion list; it writes to the same `purge_exclude` option
  the dialog edits, so the entry shows up there as selected and can be removed
  again. "Jetzt entfernen" deletes the client immediately, regardless of the
  threshold and of the exclusion list — a direct instruction outweighs an
  earlier setting. A confirmation replaces the original notification in both
  cases, since the tap happens outside Home Assistant and would otherwise have
  no visible effect.
- "Nie entfernen" is left out where it would be pointless: on the summary
  message for more than five new clients, and for clients already on the list.
- A client removed by hand is not reported as new again for 15 minutes. If it
  is still active, the next poll recreates it within seconds, and without that
  hold the pair of removal and new-device notification would loop. The
  confirmation says so, so the return does not look like a fault.
- The integration now watches whether the controller still answers, on its own
  15-minute schedule. A poll failure deliberately does not count as a
  coordinator error — the cache is passed on so short outages do not turn every
  entity unavailable — which used to mean a real outage surfaced only at the
  next purge run, up to a day later. It is now reported once per outage, with
  an all-clear including the duration once the controller answers again.
- Two new options, both on by default: "Melden, wenn der Controller ausfällt"
  in the push section and "Auch erstellen, wenn der Controller ausfällt" in the
  persistent section. The persistent notification stays in the sidebar for as
  long as the outage lasts and is dismissed automatically on recovery.

### Changed

- An options change only reloads the integration when the polling interval or
  the daily purge time changed. Those two are the only values frozen at setup
  time; the threshold, the exclusion list, the notification target and the
  message contents are read fresh on every use. Without this, every tap on the
  new button would have rebuilt every entity.

### Notes

- Entry id and MAC travel inside the action key, not in `action_data`: iOS
  reads that field from the payload key `homeassistant` and Android from
  `action_data`, so the key is the only platform-independent carrier.
- While the controller stays unreachable, the skipped-run message arrives once
  a day until it answers again. Each one replaces the previous, since they
  share a tag.
- Action buttons only work with companion app targets. Telegram, email and
  notify entities discard the data block anyway.
- If the options dialog is open while someone taps "Nie entfernen", saving the
  dialog overwrites that addition. The dialog always writes the list it loaded
  when it was opened.
- "Jetzt entfernen" is not permanent for an active client: it deletes the
  device and its entities, and the next poll creates them again with fresh
  entity ids. For a client that should stay away, the exclusion list is the
  wrong tool as well — it only prevents removal. The button is meant for
  clients that have already left the network.
- The outage watchdog checks every 15 minutes, so the first notification
  arrives at most 15 minutes after the hour-long threshold is crossed, and the
  all-clear at most 15 minutes after recovery.

## [1.19.1] - 2026-09-19

### Fixed

- Notifications now carry the tap target twice: as `url` for iOS and as
  `clickAction` for Android. Only `url` was sent before, which Android does not
  read at all — the app evaluates `clickAction` exclusively, and the push
  bridge does not even forward `url` to Android. Tapping a notification on
  Android therefore opened the default page instead of the device page.
- The extra data block no longer depends on the notification image. Whenever
  the image was unavailable, the whole block was dropped and the tap target and
  the tag went with it, which silently disabled both the device link and the
  replace-by-tag behavior. Only `icon_url` is omitted now.

### Notes

- On iOS the companion app asks "Open URL?" the first time a notification with
  a URL is tapped. That prompt belongs to the app, not to this integration: it
  is governed by "Confirm before opening URL" in the app's general settings and
  can be turned off permanently with "Always Open" in the prompt itself. No
  payload option influences it.
- If a notify target rejects the data block, the message is still sent again
  without it. That fallback now costs the tap target and the tag as well, not
  just the image.

## [1.19.0] - 2026-09-16

### Added

- Tapping a new-device notification now opens that client's device page in
  Home Assistant instead of the integration overview.

### Changed

- The notification additionally waits until the device exists in the device
  registry, so the deep link always has a target. In the rare case where
  everything else is already available this can delay the message by up to
  five seconds.
- If the device still does not exist when the wait limit is reached, the
  notification falls back to the integration page. Purge reports and the
  summary for more than five new clients keep pointing there as well.

## [1.18.0] - 2026-09-15

### Changed

- The new-device notification now waits for **every** detail selected under
  "Content", not just for the display name. If the display name, IP, SSID or
  access point name is still missing, the message is held back and sent as
  soon as everything is there.
- SSID and access point are only waited for on wireless clients. The MAC is
  always available and never delays anything. Unselected details never delay
  anything either.
- The wait limit went from 60 to 120 seconds, and completeness is now checked
  every 5 seconds instead of waiting the full period. In practice the message
  therefore arrives earlier than before.
- Clients that appear together wait as a group, which keeps the summary
  message for more than five new clients intact.
- When a newly seen client is connected to an unknown access point MAC, the
  UniFi device list is fetched immediately instead of waiting for the rate
  limit, so the access point name is available within the wait window.

### Notes

- The message never fails to arrive: once the limit is reached it is sent with
  whatever is available.

## [1.17.0] - 2026-09-14

### Changed

- Different defaults for new installations. Existing installations keep their
  stored settings and are not touched.

  | Setting | Old | New |
  | --- | --- | --- |
  | Polling interval | 60 s | 30 s |
  | Time of the daily run | 03:30 | 19:00 |
  | Also report when nothing was removed (push) | on | off |
  | Remove after days without a sighting | 30 | 30 (unchanged) |

- The image in push notifications is now shipped with the integration. The
  `brand/` folder is registered as a static path at `/unifi_dynamic/`, so the
  companion app can load `icon.png` without any setup.
- The **Image URL** option has been removed. There is nothing left to
  configure; the image is always included. Any previously stored value is
  discarded the next time the options are saved.
- If a notify target rejects the extra data, for example Telegram or email
  with "extra keys not allowed", the same message is sent again without the
  data block. The notification always arrives, just without the image.
- Notify calls are now blocking, which is what makes the fallback above
  possible.

### Fixed

- `strings.json` was out of sync with `translations/en.json` and missed the
  two `purge_exclude` entries added in 1.16.0.

### Notes

- `http` was added to the manifest dependencies because the integration now
  registers a static path.
- The push section of the options dialog is down from ten fields to nine.

## [1.16.1] - 2026-09-14

### Fixed

- `manifest.json`: added the required `issue_tracker` key, which made the HACS
  validation workflow fail.
- `manifest.json`: replaced the placeholder `documentation` URL with the
  actual repository URL.
- `manifest.json`: sorted the keys as hassfest requires (`domain`, `name`,
  then alphabetical).
- `manifest.json`: corrected `codeowners` to the actual GitHub handle.

No functional changes; this release only fixes repository metadata.

## [1.16.0] - 2026-09-11

### Added

- New option **"Exclude devices from removal"** in the *Automatic removal*
  section. Multi-select across every client the integration knows, shown as
  `Name (MAC)`. Selected clients are never removed automatically, regardless
  of the configured threshold.
- The purge report states the number of excluded clients, both in the
  persistent notification and in the log.
- The response of the `unifi_dynamic.purge_now` action contains an additional
  `protected` field.

### Changed

- Devices of excluded clients are no longer removed as empty devices, even if
  their entities were deleted outside the integration.
- MACs that are on the exclusion list but no longer present in the client
  cache stay visible in the selection and are not lost on save.

## [1.15.0] - 2026-09-10

First version published on GitHub.

### Included

- One device per UniFi client with sensors for IP, MAC, SSID, access point,
  connection type and "Last seen", plus an "Online" binary sensor.
- Persistent client cache in `.storage`, using an own `_seen_at` timestamp
  instead of the UniFi field `last_seen`. Survives restarts and reloads.
- Downtime crediting: if Home Assistant went more than an hour without a
  successful poll, the gap is credited to every timestamp so that a restart
  after a longer standstill does not delete all clients at once.
- Automatic removal after X days without a sighting, daily at a configurable
  time plus once 60 seconds after each start.
- Action `unifi_dynamic.purge_now`, optionally as a dry run without deleting,
  with a structured response.
- Push notification about newly detected clients with individually selectable
  content. Clients without a name are held back for up to 60 seconds so the
  DHCP hostname appears instead of the MAC.
- Persistent notification with the purge report, toggled separately from the
  push notification.
- Options dialog in four sections, collapsed by default.
- SSID and access point sensors only for clients ever seen on wireless.
  Existing entities of wired-only clients are cleaned up at startup.

[2.2.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.2.0
[2.1.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.1.1
[2.1.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.1.0
[2.0.14]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.14
[2.0.13]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.13
[2.0.12]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.12
[2.0.11]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.11
[2.0.10]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.10
[2.0.9]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.9
[2.0.8]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.8
[2.0.7]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.7
[2.0.6]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.6
[2.0.5]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.5
[2.0.4]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.4
[2.0.3]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.3
[2.0.2]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.2
[2.0.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.1
[2.0.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v2.0.0
[1.21.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.21.0
[1.20.6]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.6
[1.20.5]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.5
[1.20.4]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.4
[1.20.3]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.3
[1.20.2]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.2
[1.20.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.1
[1.20.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.0
[1.19.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.19.1
[1.19.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.19.0
[1.18.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.18.0
[1.17.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.17.0
[1.16.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.16.1
[1.16.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.16.0
[1.15.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.15.0
