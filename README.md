# UniFi Dynamic Clients

**English** · [Deutsch](README.de.md)

Home Assistant integration that automatically creates a device with matching
entities for every UniFi client, wired or wireless, and removes it again once
the client has not been reported by the UniFi controller for a while.

## Features

- Creates one device per client with sensors for IP, MAC, SSID, access point,
  connection type and "Last seen", plus an "Online" binary sensor.
- Persistent client cache: values of clients that went offline survive
  restarts, reloads and option changes.
- Configurable automatic removal ("purge") after X days without a sighting,
  including a daily run at a configurable time.
- Individual devices can be excluded from automatic removal.
- Action `unifi_dynamic.purge_now` to trigger the run manually, optionally as
  a dry run without deleting anything.
- Push notification for newly detected clients, with individually selectable
  content (display name, connection type, SSID, access point, IP, MAC).
- The notification image ships with the integration, nothing to configure.
- The new-device notification waits until every selected detail is actually
  available, then sends immediately. Tapping it opens that client's device
  page.
- Persistent notification in the sidebar with the report of the last purge
  run, toggled separately from the push notification.
- SSID and access point sensors only for clients that have been seen on
  wireless. Wired-only clients do not get them.

## Installation

### Via HACS (custom repository)

1. Open HACS → three-dot menu (top right) → **Custom repositories**.
2. Enter the repository URL `https://github.com/Diegofuego871/unifi_dynamic`
   and choose the category **Integration**.
3. Search for "UniFi Dynamic Clients" in HACS and install it.
4. Restart Home Assistant.

### Manually

1. Copy the folder `custom_components/unifi_dynamic` from this repository into
   the `custom_components` directory of your Home Assistant configuration.
2. Restart Home Assistant.

## Setup

**Settings → Devices & services → Add integration → "UniFi Dynamic Clients"**.

| Field | Description |
| --- | --- |
| Host or IP | Address of the UniFi controller, without `https://` |
| API key | API key of the UniFi controller |
| Verify SSL certificate | Disable for a self-signed certificate |
| Polling interval | How often the client list is fetched (seconds) |
| Remove after days without a sighting | 0 disables automatic removal |

## Options

Available afterwards via **Configure** on the integration. The dialog is
grouped into four sections, collapsed when opened.

### Polling

| Option | Meaning | Default |
| --- | --- | --- |
| Polling interval | How often the client list is fetched from the controller | 30 s |

### Automatic removal

| Option | Meaning | Default |
| --- | --- | --- |
| Remove after days without a sighting | Threshold in days, 0 disables removal | 30 |
| Time of the daily run | Local time of the cleanup run | 19:00 |
| Exclude devices from removal | Multi-select; the chosen clients are never removed automatically | empty |

### Push notification

| Option | Meaning | Default |
| --- | --- | --- |
| Push notification target | notify service or notify entity, for example a notify group | none |
| Also report when nothing was removed | Push after every daily run, even with no hits | off |
| Report new devices | Push as soon as a client appears for the first time | on |
| Content: … | Six switches for display name, connection type, SSID, access point, IP and MAC | all on except MAC |

### Persistent notification

| Option | Meaning | Default |
| --- | --- | --- |
| Create persistent notification | Report of the cleanup run in the sidebar | on |
| Also create when nothing was removed | Otherwise it only appears on actual hits | on |

## Action `unifi_dynamic.purge_now`

Triggers the cleanup run immediately instead of waiting for the configured
time.

| Field | Required | Description |
| --- | --- | --- |
| `dry_run` | No | Only determine what would be removed. Nothing is deleted. |
| `entry_id` | No | Without it, all configured UniFi hosts run. |

The action returns a structured response with the number of removed clients,
entities and devices, plus the number of excluded clients.

## How it works

The integration queries `/stat/sta`, the list of active clients. A client that
no longer appears does not vanish immediately: its last state stays in the
cache and ages. The basis for this is an own timestamp written on every
sighting, not the UniFi field `last_seen`. That removes any issue with
millisecond variants, missing values and a deviating controller clock.

If Home Assistant went more than an hour without a successful poll, the
downtime is credited to every timestamp. Otherwise a restart after a longer
standstill would classify all clients as overdue at once.

The image shown in push notifications is served by the integration itself:
the `brand/` folder is registered as a static path under `/unifi_dynamic/`,
the same mechanism behind `/local/`. The image is optional: if it is missing,
only the image is left out, the tap target and the tag stay. If a notify
target rejects the extra data as a whole, the message is sent again without
it — then without image, tap target and tag.

The tap target is sent as `url` and as `clickAction`, because iOS reads the
first key and Android only the second. On iOS the companion app asks "Open
URL?" the first time a notification with a URL is tapped. That prompt belongs
to the app, not to this integration: it is governed by "Confirm before opening
URL" in the app's general settings and can be turned off permanently with
"Always Open" in the prompt itself.

Access point names come from `/stat/device`. That list is fetched far less
often than the client list and kept in the cache. If the request fails, the
sensors show the access point's MAC instead.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

See [LICENSE](LICENSE).
