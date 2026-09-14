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

Further options (polling interval, purge time, push and persistent notifications) can be adjusted afterwards via **Configure** on the integration.

## Action `unifi_dynamic.purge_now`

| Field | Required | Description |
|---|---|---|
| `dry_run` | No | Only determine what would be removed. Nothing is deleted. |
| `entry_id` | No | Without it, all configured UniFi hosts run. |

## License

See [LICENSE](LICENSE).
