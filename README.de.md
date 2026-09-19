# UniFi Dynamic Clients

[English](README.md) · **Deutsch**

Home-Assistant-Integration, die pro UniFi-Client (verkabelt oder WLAN)
automatisch ein Gerät mit den passenden Entitäten anlegt und wieder entfernt,
sobald der Client vom UniFi-Controller länger nicht mehr gemeldet wird.

## Funktionen

- Legt pro Client ein Gerät mit Sensoren an: IP, MAC, SSID, Access Point,
  Verbindungsart und „Last seen" sowie einen Binary-Sensor „Online".
- Persistenter Client-Cache: Werte offline gegangener Clients bleiben nach
  Neustart, Reload und Options-Änderung erhalten.
- Automatisches, konfigurierbares Entfernen („Purge") nach X Tagen ohne
  Sichtung, inklusive täglichem Lauf zu einer einstellbaren Uhrzeit.
- Einzelne Geräte lassen sich vom automatischen Entfernen ausnehmen.
- Aktion `unifi_dynamic.purge_now` zum manuellen Auslösen, wahlweise als
  Testlauf („dry run") ohne Löschen.
- Push-Benachrichtigung bei neu erkannten Clients, mit einzeln schaltbarem
  Inhalt (Anzeigename, Verbindungsart, SSID, Access Point, IP, MAC).
- Das Bild der Meldung bringt die Integration mit, nichts einzurichten.
- Die Neugeräte-Meldung wartet, bis alle gewählten Angaben tatsächlich
  vorliegen, und sendet dann sofort. Ein Klick darauf öffnet die Geräteseite
  des Clients.
- Anhaltende Benachrichtigung in der Seitenleiste mit dem Bericht des letzten
  Purge-Laufs, getrennt schaltbar von der Push-Meldung.
- SSID- und Access-Point-Sensoren nur für Clients, die je im WLAN gesehen
  wurden. Reine Kabel-Clients bekommen sie nicht.

## Installation

### Über HACS (Custom Repository)

1. HACS öffnen → Drei-Punkte-Menü (oben rechts) → **Custom repositories**.
2. Repository-URL `https://github.com/Diegofuego871/unifi_dynamic` eintragen,
   Kategorie **Integration** wählen.
3. „UniFi Dynamic Clients" in HACS suchen und installieren.
4. Home Assistant neu starten.

### Manuell

1. Ordner `custom_components/unifi_dynamic` aus diesem Repository in das
   `custom_components`-Verzeichnis der Home-Assistant-Konfiguration kopieren.
2. Home Assistant neu starten.

## Einrichtung

**Einstellungen → Geräte & Dienste → Integration hinzufügen → „UniFi Dynamic
Clients"**.

| Feld | Beschreibung |
| --- | --- |
| Host oder IP | Adresse des UniFi-Controllers, ohne `https://` |
| API-Key | API-Schlüssel des UniFi-Controllers |
| SSL-Zertifikat prüfen | Deaktivieren bei selbstsigniertem Zertifikat |
| Abfrageintervall | Wie oft die Clientliste abgefragt wird (Sekunden) |
| Entfernen nach Tagen ohne Sichtung | 0 deaktiviert das automatische Entfernen |

## Optionen

Nachträglich über **Konfigurieren** an der Integration erreichbar. Der Dialog
ist in vier Abschnitte gegliedert, die beim Öffnen zugeklappt sind.

### Abfrage

| Option | Bedeutung | Vorgabe |
| --- | --- | --- |
| Abfrageintervall | Wie oft die Clientliste vom Controller geholt wird | 30 s |

### Automatisches Entfernen

| Option | Bedeutung | Vorgabe |
| --- | --- | --- |
| Entfernen nach Tagen ohne Sichtung | Schwelle in Tagen, 0 deaktiviert das Entfernen | 30 |
| Uhrzeit des täglichen Laufs | Lokale Zeit des Aufräumlaufs | 19:00 |
| Geräte vom Entfernen ausnehmen | Mehrfachauswahl; ausgewählte Clients werden nie automatisch entfernt | leer |

### Push-Benachrichtigung

| Option | Bedeutung | Vorgabe |
| --- | --- | --- |
| Ziel für Push-Benachrichtigung | notify-Service oder notify-Entity, etwa eine notify-Gruppe | keines |
| Auch melden, wenn nichts entfernt wurde | Push nach jedem täglichen Lauf, auch ohne Treffer | aus |
| Neue Geräte melden | Push, sobald ein Client zum ersten Mal auftaucht | an |
| Inhalt: … | Sechs Schalter für Anzeigename, Verbindungsart, SSID, Access Point, IP und MAC | alle an ausser MAC |

### Anhaltende Benachrichtigung

| Option | Bedeutung | Vorgabe |
| --- | --- | --- |
| Anhaltende Benachrichtigung erstellen | Bericht des Aufräumlaufs in der Seitenleiste | an |
| Auch erstellen, wenn nichts entfernt wurde | Andernfalls erscheint sie nur bei tatsächlichen Treffern | an |

## Aktion `unifi_dynamic.purge_now`

Löst den Aufräumlauf sofort aus, statt auf die eingestellte Uhrzeit zu warten.

| Feld | Pflicht | Beschreibung |
| --- | --- | --- |
| `dry_run` | Nein | Nur ermitteln, was entfernt würde. Es wird nichts gelöscht. |
| `entry_id` | Nein | Ohne Angabe laufen alle eingerichteten UniFi-Hosts. |

Die Aktion liefert eine strukturierte Antwort mit Anzahl entfernter Clients,
Entitäten und Geräte sowie der Anzahl ausgenommener Clients.

## Funktionsweise

Die Integration fragt `/stat/sta` ab, also die Liste der aktiven Clients. Ein
Client, der nicht mehr erscheint, verschwindet nicht sofort: Sein letzter
Stand bleibt im Cache und altert. Grundlage dafür ist ein eigener Zeitstempel,
der bei jeder Sichtung gesetzt wird, nicht das UniFi-Feld `last_seen`. Damit
sind Millisekunden-Varianten, fehlende Werte und eine abweichende
Controller-Uhr kein Thema.

War Home Assistant länger als eine Stunde ohne erfolgreichen Poll, wird die
Ausfallzeit allen Zeitstempeln gutgeschrieben. Sonst würde ein Neustart nach
längerem Stillstand sämtliche Clients auf einmal als überfällig einstufen.

Das Bild in den Push-Meldungen liefert die Integration selbst aus: Der Ordner
`brand/` wird als statischer Pfad unter `/unifi_dynamic/` registriert, also
über denselben Mechanismus wie `/local/`. Lehnt ein Benachrichtigungsziel die
Zusatzdaten ab, wird die Meldung ohne sie erneut gesendet.

Die Namen der Access Points stammen aus `/stat/device`. Diese Liste wird
deutlich seltener geholt als die Clientliste und im Cache gehalten. Schlägt
der Abruf fehl, zeigen die Sensoren die MAC des Access Points.

## Changelog

Siehe [CHANGELOG.md](CHANGELOG.md).

## Lizenz

Siehe [LICENSE](LICENSE).
