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
- Aktion `unifi_dynamic.remove_client` zum gezielten Entfernen einzelner
  Clients, per Geräteauswahl oder MAC-Adresse.
- Aktion `unifi_dynamic.purge_now` zum manuellen Auslösen, wahlweise als
  Testlauf („dry run") ohne Löschen.
- Push-Benachrichtigung bei neu erkannten Clients, mit einzeln schaltbarem
  Inhalt (Anzeigename, Verbindungsart, SSID, Access Point, IP, MAC).
- Das Bild der Meldung bringt die Integration mit, nichts einzurichten.
- Die Neugeräte-Meldung wartet, bis alle gewählten Angaben tatsächlich
  vorliegen, und sendet dann sofort. Ein Klick darauf öffnet die Geräteseite
  des Clients. Zwei Buttons wirken direkt aus der Meldung heraus: „Nie
  entfernen" setzt den Client auf die Ausnahmeliste, „Jetzt entfernen" löscht
  ihn sofort.
- Der Purge setzt aus, solange der Controller nicht erreichbar ist. Ein Ausfall
  kann den Bestand damit nie löschen. Ein ausgesetzter Lauf wird gemeldet.
- Die Erreichbarkeit des Controllers bemisst sich an fehlgeschlagenen Abfragen
  in Folge, die Schwelle ist einstellbar. Gemeldet wird je Störung einmal, die
  Entwarnung kommt mit der ersten wieder erfolgreichen Abfrage. Push und
  anhaltende Benachrichtigung sind getrennt abschaltbar.
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
| Als ausgefallen nach (Abfragen) | Fehlgeschlagene Abfragen in Folge, bis der Controller als ausgefallen gilt | 30 |

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
| Melden, wenn der Controller ausfällt | Push nach einer Stunde ohne erfolgreichen Poll, samt Entwarnung | an |
| Inhalt: … | Sechs Schalter für Anzeigename, Verbindungsart, SSID, Access Point, IP und MAC | alle an ausser MAC |

### Anhaltende Benachrichtigung

| Option | Bedeutung | Vorgabe |
| --- | --- | --- |
| Anhaltende Benachrichtigung erstellen | Bericht des Aufräumlaufs in der Seitenleiste | an |
| Auch erstellen, wenn nichts entfernt wurde | Andernfalls erscheint sie nur bei tatsächlichen Treffern | an |
| Auch erstellen, wenn der Controller ausfällt | Bleibt in der Seitenleiste, bis der Controller wieder antwortet | an |

## Aktion `unifi_dynamic.purge_now`

Löst den Aufräumlauf sofort aus, statt auf die eingestellte Uhrzeit zu warten.

| Feld | Pflicht | Beschreibung |
| --- | --- | --- |
| `dry_run` | Nein | Nur ermitteln, was entfernt würde. Es wird nichts gelöscht. |
| `entry_id` | Nein | Ohne Angabe laufen alle eingerichteten UniFi-Hosts. |

Die Aktion liefert eine strukturierte Antwort mit Anzahl entfernter Clients,
Entitäten und Geräte sowie der Anzahl ausgenommener Clients.

## Aktion `unifi_dynamic.remove_client`

Entfernt einzelne Clients sofort, unabhängig von der Schwelle und von der
Ausnahmeliste.

| Feld | Pflicht | Beschreibung |
| --- | --- | --- |
| `device_id` | Eines von beiden | Zu entfernende Geräte, Mehrfachauswahl möglich. |
| `mac` | Eines von beiden | MAC-Adressen, mehrere möglich. Doppelpunkte, Bindestriche, Punkte oder blanke Hexfolge. |
| `entry_id` | Nein | Nur für MAC-Adressen relevant. Ohne Angabe werden alle eingerichteten UniFi-Hosts durchsucht. |

Die Antwort nennt je Client den Entry, die MAC, den Namen, die Zahl entfernter
Entitäten und Geräte sowie ob er zu diesem Zeitpunkt online war — dann legt ihn
der nächste Abgleich wieder an, mit neuen Entity-IDs. Unbekannte Adressen
kommen mit `removed: false` zurück, statt den Aufruf scheitern zu lassen. Wie
beim Button in der Meldung wird ein entfernter Client 15 Minuten lang nicht
erneut als neu gemeldet. Eine Bestätigungs-Push gibt es nicht, die Antwort ist
die Rückmeldung.

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

Der Purge misst das Alter gegen den letzten erfolgreichen Poll, nicht gegen die
Wanduhr, und setzt ganz aus, wenn dieser länger als eine Stunde zurückliegt.
Bei nicht erreichbarem Controller würden die Zeitstempel sonst weiter altern,
obwohl kein Client tatsächlich verschwunden ist, und der Lauf würde einen noch
existierenden Bestand löschen. Ein ausgesetzter Lauf wird gemeldet, samt
Angabe, wie lange der Controller schweigt.

Der Button „Nie entfernen" in der Neugeräte-Meldung schreibt in dieselbe Option
`purge_exclude`, die auch der Dialog bearbeitet; beide Wege bleiben damit
konsistent. Entry-ID und MAC stecken im Aktions-Key, die Integration lauscht
auf `mobile_app_notification_action` und ignoriert alles Fremde. Zu beachten:
Wird der Optionsdialog gespeichert, während er offen war, überschreibt er eine
zwischenzeitliche Ergänzung — er schreibt immer die Liste, die er beim Öffnen
geladen hat.

„Jetzt entfernen" löscht den Client sofort, ohne Rücksicht auf die Schwelle und
auf die Ausnahmeliste. Gedacht ist der Button für Clients, die das Netz bereits
verlassen haben: Ein noch aktiver Client wird vom nächsten Poll wieder angelegt,
mit neuen Entity-IDs. Seine Neugeräte-Meldung bleibt 15 Minuten gesperrt, damit
Entfernen und Wiedererkennung keine Schleife bilden.

Da ein fehlgeschlagener Poll bewusst nicht als Coordinator-Fehler gilt — der
Cache wird weitergereicht, damit kurze Aussetzer nicht alle Entitäten auf
unavailable kippen — würde ein Ausfall sonst erst beim nächsten Purge-Lauf
auffallen. Deshalb werden fehlgeschlagene Abfragen in Folge gezählt; ist die
eingestellte Zahl erreicht, geht die Meldung sofort raus. Der Zähler wird bei
jedem Erfolg zurückgesetzt, einzelne Aussetzer summieren sich also nie. Die
Entwarnung samt Dauer kommt mit der ersten wieder erfolgreichen Abfrage.

Diese Schwelle steuert nur die Meldung. Der Purge behält seine eigene Schwelle
von einer Stunde, denn ein kurzer Ausfall gefährdet den Bestand nicht, und eine
empfindlich eingestellte Meldeschwelle soll nicht den täglichen Lauf aussetzen
lassen.

Das Bild in den Push-Meldungen liefert die Integration selbst aus: Der Ordner
`brand/` wird als statischer Pfad unter `/unifi_dynamic/` registriert, also
über denselben Mechanismus wie `/local/`. Das Bild ist optional: Fehlt es,
entfällt nur das Bild, Klickziel und Tag bleiben. Lehnt ein
Benachrichtigungsziel die Zusatzdaten insgesamt ab, wird die Meldung ohne sie
erneut gesendet — dann ohne Bild, Klickziel und Tag.

Das Klickziel wird als `url` und als `clickAction` mitgeschickt, weil iOS den
ersten Schlüssel liest und Android nur den zweiten. Unter iOS fragt die
Companion-App beim ersten Klick auf eine Meldung mit URL „Adresse öffnen?".
Diese Rückfrage gehört zur App, nicht zu dieser Integration: Sie hängt an
„Adressen öffnen bestätigen" in den allgemeinen Einstellungen der App und
lässt sich in der Rückfrage selbst mit „Immer geöffnet" dauerhaft abstellen.

Die Namen der Access Points stammen aus `/stat/device`. Diese Liste wird
deutlich seltener geholt als die Clientliste und im Cache gehalten. Schlägt
der Abruf fehl, zeigen die Sensoren die MAC des Access Points.

## Changelog

Siehe [CHANGELOG.md](CHANGELOG.md).

## Lizenz

Siehe [LICENSE](LICENSE).
