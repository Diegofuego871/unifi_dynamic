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

Weitere Optionen (Abfrageintervall, Purge-Zeit, Push- und Persistent-Benachrichtigungen) lassen sich nachträglich über **Konfigurieren** an der Integration anpassen, siehe [Optionen](#optionen) unten.

## Optionen

Über **Konfigurieren** an der Integration erreichbar, gruppiert in vier ein-/ausklappbare Abschnitte.

### Abfrage

| Feld | Standard | Beschreibung |
|---|---|---|
| Abfrageintervall (Sekunden) | 60 | Wie oft die Clientliste vom Controller geholt wird. Bereich: 10–3600. |

### Automatisches Entfernen

| Feld | Standard | Beschreibung |
|---|---|---|
| Entfernen nach Tagen ohne Sichtung | 30 | Client und Gerät werden entfernt, wenn sie so lange nicht mehr gesehen wurden. 0 deaktiviert das Entfernen. Bereich: 0–3650. |
| Uhrzeit des täglichen Laufs | 03:30:00 | Lokale Zeit des täglichen Aufräumlaufs. Wer über der Schwelle liegt, verliert seine Entitäten und sein Gerät; danach kommt der Bericht als Benachrichtigung. Bei "Entfernen nach Tagen ohne Sichtung" = 0 hat diese Uhrzeit keine Wirkung. Zusätzlich läuft 60 Sekunden nach jedem HA-Start eine Prüfung, die nur bei tatsächlichem Entfernen meldet. Unabhängig davon lässt sich der Lauf jederzeit über die Aktion `unifi_dynamic.purge_now` auslösen, auf Wunsch als Testlauf. |

### Push-Benachrichtigung

| Feld | Standard | Beschreibung |
|---|---|---|
| Ziel für Push-Benachrichtigung | Keine | notify-Service oder notify-Entity, zum Beispiel eine notify-Gruppe. |
| Auch melden, wenn nichts entfernt wurde | Ein | Aktiv bedeutet eine Push nach jedem täglichen Lauf, auch ohne Treffer. |
| Neue Geräte melden | Ein | Push-Meldung, sobald ein Client zum ersten Mal in der UniFi-API auftaucht, mit Name, Verbindungsart, SSID und IP. Bei der Erstbefüllung nach der Installation wird bewusst nichts gemeldet. Ab mehr als fünf gleichzeitig neuen Clients kommt eine Sammelmeldung statt Einzelmeldungen. Clients ohne bekannten Namen werden bis zu 60 Sekunden zurückgehalten, damit statt der MAC der DHCP-Hostname erscheint. |
| Inhalt: Anzeigename | Ein | Name aus dem Controller, sonst DHCP-Hostname, sonst die MAC. |
| Inhalt: Verbindungsart | Ein | Kabel oder Wireless. |
| Inhalt: SSID | Ein | Nur bei WLAN-Clients. |
| Inhalt: Access Point | Ein | Nur bei WLAN-Clients. Name aus der UniFi-Geräteliste, sonst dessen MAC. |
| Inhalt: IP-Adresse | Ein | Aktuelle IP-Adresse des Clients. |
| Inhalt: MAC-Adresse | Aus | Wird weggelassen, wenn der Anzeigename ohnehin die MAC ist. |
| Bild-URL für die Push-Benachrichtigung | Leer | Grosses Bild rechts in der Push-Meldung. Datei in `www/` im Konfigurationsverzeichnis ablegen (`/config/www/` bzw. `/homeassistant/www/`), Eintrag hier als `/local/...`-Pfad oder vollständige `https://`-URL. Leer schaltet das Bild ab. |

### Anhaltende Benachrichtigung

| Feld | Standard | Beschreibung |
|---|---|---|
| Anhaltende Benachrichtigung erstellen | Ein | Bericht des Aufräumlaufs mit Details je entferntem Client, in der Home-Assistant-Seitenleiste. Betrifft nur den Aufräumlauf; neu erkannte Geräte erzeugen grundsätzlich keine anhaltende Benachrichtigung. |
| Auch erstellen, wenn nichts entfernt wurde | Ein | Aus bedeutet: Die Meldung erscheint nur, wenn tatsächlich etwas entfernt wurde. Die vorherige bleibt dann stehen und zeigt weiterhin den letzten echten Lauf samt Zeitpunkt. |

## Aktion `unifi_dynamic.purge_now`

| Feld | Pflicht | Beschreibung |
|---|---|---|
| `dry_run` | Nein | Nur ermitteln, was entfernt würde. Es wird nichts gelöscht. |
| `entry_id` | Nein | Ohne Angabe laufen alle eingerichteten UniFi-Hosts. |

## Lizenz

Siehe [LICENSE](LICENSE).
