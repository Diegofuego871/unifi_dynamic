# Changelog

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
