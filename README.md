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
- Action `unifi_dynamic.remove_client` to remove individual clients on demand,
  by device or by MAC address.
- Action `unifi_dynamic.purge_now` to trigger the run manually, optionally as
  a dry run without deleting anything.
- Push notification for newly detected clients, with individually selectable
  content (display name, connection type, SSID, access point, IP, MAC).
- The notification image ships with the integration, nothing to configure.
- The new-device notification waits until every selected detail is actually
  available, then sends immediately. Tapping it opens that client's device
  page. Two buttons act right from the notification: "Nie entfernen" adds the
  client to the exclusion list, "Jetzt entfernen" deletes it immediately.
- The purge is skipped while the controller is unreachable, so an outage can
  never delete the inventory. A skipped run is reported.
- The controller's reachability is judged by consecutive failed polls, with
  the threshold configurable, and reported once per outage. The all-clear goes
  out with the first successful poll. Push and persistent notification can be
  switched off separately.
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
| Considered down after (polls) | Consecutive failed polls before the controller counts as down | 30 |

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
| Report when the controller goes down | Push after an hour without a successful poll, plus an all-clear | on |
| Content: … | Six switches for display name, connection type, SSID, access point, IP and MAC | all on except MAC |

### Persistent notification

| Option | Meaning | Default |
| --- | --- | --- |
| Create persistent notification | Report of the cleanup run in the sidebar | on |
| Also create when nothing was removed | Otherwise it only appears on actual hits | on |
| Also create when the controller goes down | Stays in the sidebar until the controller answers again | on |

## Action `unifi_dynamic.purge_now`

Triggers the cleanup run immediately instead of waiting for the configured
time.

| Field | Required | Description |
| --- | --- | --- |
| `dry_run` | No | Only determine what would be removed. Nothing is deleted. |
| `entry_id` | No | Without it, all configured UniFi hosts run. |

The action returns a structured response with the number of removed clients,
entities and devices, plus the number of excluded clients.

## Action `unifi_dynamic.remove_client`

Removes individual clients immediately, regardless of the threshold and of the
exclusion list.

| Field | Required | Description |
| --- | --- | --- |
| `device_id` | One of the two | Devices to remove, multiple allowed. |
| `mac` | One of the two | MAC addresses, multiple allowed. Colons, hyphens, dots or a bare hex string. |
| `entry_id` | No | Only relevant for MAC addresses. Without it, all configured UniFi hosts are searched. |

The response lists per client the entry, MAC, name, the number of removed
entities and devices, and whether it was online at the time — in which case the
next poll recreates it with fresh entity ids. Unknown addresses come back with
`removed: false` rather than failing the call. A client that is still active
reappears on the next poll and is reported as new again, because from the
cache's point of view it is. No confirmation push is sent; the response is the
feedback.

## How it works

The integration queries `/stat/sta`, the list of active clients. A client that
no longer appears does not vanish immediately: its last state stays in the
cache and ages. The basis for this is an own timestamp written on every
sighting, not the UniFi field `last_seen`. That removes any issue with
millisecond variants, missing values and a deviating controller clock.

If Home Assistant went more than an hour without a successful poll, the
downtime is credited to every timestamp. Otherwise a restart after a longer
standstill would classify all clients as overdue at once.

The purge measures ages against the last successful poll, not against the wall
clock, and is skipped entirely when that poll is more than an hour old. A
controller that is unreachable would otherwise let every timestamp age on
while no client had actually disappeared, and the run would delete a still
existing inventory. A skipped run is reported and states how long the
controller has been silent.

The "Nie entfernen" button in the new-device notification writes to the same
`purge_exclude` option the dialog edits, so both ways stay in sync. Entry id
and MAC travel inside the action key; the integration listens for
`mobile_app_notification_action` and ignores everything that is not its own.
Note that saving the options dialog overwrites an addition made while the
dialog was open, because it always writes the list it loaded on opening.

"Jetzt entfernen" deletes the client on the spot, ignoring both the threshold
and the exclusion list. It is meant for clients that have already left the
network: an active one is recreated by the next poll, with fresh entity ids,
and reported as a new device again.

A failure while handling either action is now always logged with the action
kind, MAC and entry id, instead of only the confirmation step being covered.
With debug logging enabled for `custom_components.unifi_dynamic`, a tap that
reaches Home Assistant logs "Meldungsaktion ... empfangen" immediately; if
that line never appears after a tap, the event is not reaching Home Assistant
at all, which points at the phone or companion app rather than at the
integration.

Because a failed poll is not treated as a coordinator error — the cache is
passed on so short outages do not turn every entity unavailable — an outage
would otherwise go unnoticed until the next purge run. Consecutive failures are
therefore counted, and reaching the configured number reports the outage right
away; the counter resets on every success, so isolated hiccups never add up.
The all-clear, including the duration, goes out with the first poll that
succeeds.

That threshold governs reporting only. The purge keeps its own one-hour
threshold, because a short outage does not endanger the inventory and a
sensitive reporting setting should not start suspending the daily run.

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
