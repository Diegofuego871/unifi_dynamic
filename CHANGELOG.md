# Changelog

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

[1.20.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.1
[1.20.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.20.0
[1.19.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.19.1
[1.19.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.19.0
[1.18.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.18.0
[1.17.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.17.0
[1.16.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.16.1
[1.16.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.16.0
[1.15.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.15.0
