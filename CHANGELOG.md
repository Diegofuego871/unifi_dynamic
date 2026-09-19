# Changelog

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

[1.19.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.19.0
[1.18.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.18.0
[1.17.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.17.0
[1.16.1]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.16.1
[1.16.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.16.0
[1.15.0]: https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v1.15.0
