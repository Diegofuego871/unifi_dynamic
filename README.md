🇬🇧 English | 🇩🇪 [Deutsch](README.de.md)

# UniFi Dynamic Clients

Home Assistant integration that automatically creates a device with matching entities for every UniFi client (wired or wireless), and removes it again once the UniFi controller no longer reports that client.

## Features

- Creates a device per client with sensors for IP, SSID, connection type, "Last seen" and MAC, plus an "Online" binary sensor.
- Automatic, configurable removal ("purge") of clients and entities after X days without a sighting, including a daily run at a fixed time.
- `unifi_dynamic.purge_now` action to trigger the purge manually, optionally as a dry run without deleting anything.
- Push notification for newly detected clients, with configurable content (name, connection type, SSID, access point, IP, MAC).
- Persistent notification in the Home Assistant sidebar with the report of the last purge run.
- Automatic cleanup of wireless-only entities for clients that were never seen on Wi-Fi.

## Installation

### Via HACS (Custom Repository)

1. Open HACS → three-dot menu (top right) → **Custom repositories**.
2. Enter the repository URL `https://github.com/Diegofuego871/unifi_dynamic`, choose category **Integration**.
3. Search for "UniFi Dynamic Clients" in HACS and install it.
4. Restart Home Assistant.

### Manual

1. Copy the `custom_components/unifi_dynamic` folder from this repository into the `custom_components` directory of your Home Assistant configuration.
2. Restart Home Assistant.

## Setup

After installation: **Settings → Devices & Services → Add Integration → "UniFi Dynamic Clients"**.

Required fields:

| Field | Description |
|---|---|
| Host or IP | Address of the UniFi controller, without `https://` |
| API key | API key of the UniFi controller |
| Verify SSL certificate | Disable for a self-signed certificate |
| Polling interval | How often the client list is queried (seconds) |
| Remove after days without a sighting | 0 disables automatic removal |

Further options (polling interval, purge time, push and persistent notifications) can be adjusted afterwards via **Configure** on the integration, see [Options](#options) below.

## Options

Reachable via **Configure** on the integration, grouped into four collapsible sections.

### Polling

| Field | Default | Description |
|---|---|---|
| Polling interval (seconds) | 60 | How often the client list is fetched from the controller. Range: 10–3600. |

### Automatic removal

| Field | Default | Description |
|---|---|---|
| Remove after days without a sighting | 30 | Client and device are removed after this many days without a sighting. 0 disables removal. Range: 0–3650. |
| Time of the daily run | 03:30:00 | Local time of the daily cleanup run. Anything past the threshold loses its entities and device; the report is then sent as a notification. Has no effect if "Remove after days without a sighting" is 0. A check also runs 60 seconds after each Home Assistant start and only reports if something was actually removed. Independently, the run can be triggered anytime via the `unifi_dynamic.purge_now` action, optionally as a dry run. |

### Push notification

| Field | Default | Description |
|---|---|---|
| Push notification target | None | notify service or notify entity, for example a notify group. |
| Also report when nothing was removed | On | Enabled means a push after every daily run, even with no hits. |
| Report new devices | On | Push notification as soon as a client appears in the UniFi API for the first time, with name, connection type, SSID and IP. Nothing is reported during the initial fill after installation. If more than five clients appear at once, a single summary is sent instead. Clients without a known name yet are held back up to 60 seconds so the DHCP hostname appears instead of the MAC. |
| Content: Display name | On | Name from the controller, otherwise DHCP hostname, otherwise the MAC. |
| Content: Connection type | On | Wired or wireless. |
| Content: SSID | On | Wireless clients only. |
| Content: Access point | On | Wireless clients only. Name from the UniFi device list, otherwise its MAC. |
| Content: IP address | On | Current IP address of the client. |
| Content: MAC address | Off | Omitted when the display name is the MAC anyway. |
| Push notification image URL | Empty | Large image on the right of the push notification. Place the file in `www/` inside the configuration directory (`/config/www/` or `/homeassistant/www/`), and enter it here as a `/local/...` path or a full `https://` URL. Leave empty to disable the image. |

### Persistent notification

| Field | Default | Description |
|---|---|---|
| Create persistent notification | On | Report of the cleanup run with details per removed client, shown in the Home Assistant sidebar. Applies to the cleanup run only; newly detected devices never create a persistent notification. |
| Also create when nothing was removed | On | Off means the message only appears when something was actually removed. The previous one then stays and keeps showing the last real run and its time. |

## Action `unifi_dynamic.purge_now`

| Field | Required | Description |
|---|---|---|
| `dry_run` | No | Only determine what would be removed. Nothing is deleted. |
| `entry_id` | No | Without it, all configured UniFi hosts run. |

## Changelog

- **1.15.1** – Verified the HACS release/update flow (version bump, tag, update detection, installation).
- **1.15.0** – First version published via HACS.

## License

See [LICENSE](LICENSE).
