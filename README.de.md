🇬🇧 [English](README.md) | 🇩🇪 Deutsch

# UniFi Dynamic Clients

Home-Assistant-Integration, die pro UniFi-Client (verkabelt oder WLAN) automatisch ein Gerät mit den passenden Entitäten anlegt und wieder entfernt, sobald der Client vom UniFi-Controller nicht mehr gemeldet wird.

## Funktionen

- Legt pro Client ein Device mit Sensoren an: IP, SSID, Verbindungsart, "Last seen", MAC sowie einen "Online"-Binary-Sensor.
- Automatisches, konfigurierbares Entfernen ("Purge") von Clients und Entities nach X Tagen ohne Sichtung, inklusive täglichem Lauf zu einer festen Uhrzeit.
- Aktion `unifi_dynamic.purge_now` zum manuellen Auslösen des Purge, wahlweise als Testlauf ("dry run") ohne Löschen.
- Push-Benachrichtigung bei neu erkannten Clients, konfigurierbarer Inhalt (Name, Verbindungsart, SSID, Access Point, IP, MAC).
- Anhaltende Benachrichtigung in der Home-Assistant-Seitenleiste mit dem Bericht des letzten Purge-Laufs.
- Automatische Bereinigung von WLAN-only-Entities bei Clients, die nie im WLAN gesehen wurden.

## Installation

### Über HACS (Custom Repository)

1. HACS öffnen → Drei-Punkte-Menü (oben rechts) → **Custom repositories**.
2. Repository-URL `https://github.com/Diegofuego871/unifi_dynamic` eintragen, Kategorie **Integration** wählen.
3. "UniFi Dynamic Clients" in HACS suchen und installieren.
4. Home Assistant neu starten.

### Manuell

1. Ordner `custom_components/unifi_dynamic` aus diesem Repository in das `custom_components`-Verzeichnis der Home-Assistant-Konfiguration kopieren.
2. Home Assistant neu starten.

## Einrichtung

Nach der Installation: **Einstellungen → Geräte & Dienste → Integration hinzufügen → "UniFi Dynamic Clients"**.

Benötigte Angaben:

| Feld | Beschreibung |
|---|---|
| Host oder IP | Adresse des UniFi-Controllers, ohne `https://` |
| API-Key | API-Schlüssel des UniFi-Controllers |
| SSL-Zertifikat prüfen | Deaktivieren bei selbstsigniertem Zertifikat |
| Abfrageintervall | Wie oft die Clientliste abgefragt wird (Sekunden) |
| Entfernen nach Tagen ohne Sichtung | 0 deaktiviert das automatische Entfernen |

Weitere Optionen (Abfrageintervall, Purge-Zeit, Push- und Persistent-Benachrichtigungen) lassen sich nachträglich über **Konfigurieren** an der Integration anpassen.

## Aktion `unifi_dynamic.purge_now`

| Feld | Pflicht | Beschreibung |
|---|---|---|
| `dry_run` | Nein | Nur ermitteln, was entfernt würde. Es wird nichts gelöscht. |
| `entry_id` | Nein | Ohne Angabe laufen alle eingerichteten UniFi-Hosts. |

## Lizenz

Siehe [LICENSE](LICENSE).
