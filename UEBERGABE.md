# Prototyp: Erweiterungen für die Billardcafé-Merzig-Rangliste

Dieser Stand ist ein Vorschlag, kein fertiges Update. Die Oberfläche läuft im Prototyp mit einem
Demo-Server im Browser (`demo-api.js`) und erfundenen Daten. Am echten Server wurde nichts verändert.

## Was neu ist

| Bereich | Wo | Kurz |
|---|---|---|
| Monatsliga je Café-Liga | Rangliste → „Monatsliga je Café-Liga“ | Sieg 3, Niederlage 1, +1 gegen höhere Liga, max. 3 Wertungen pro Gegner und Monat. Jede Liga hat einen eigenen Monatssieger. Die bisherige Tabelle bleibt als „Gesamttabelle“. |
| Titel des Monats | Rangliste | Champion des Hauses, Stammgast des Monats (meiste Spieltage), Aufsteiger des Monats |
| Stufe & Fortschritt | Profil → Wertungskarten | Stufe I–III innerhalb der Café-Liga, grober Fortschrittsbalken. Die Spielstärke-Zahl bleibt verborgen. |
| Gewinnchance & Vorgabe | Partie starten → Schritt 3 | „Du gewinnst etwa 3 von 10 Spielen“, freiwilliger Vorgabe-Vorschlag |
| Startseite | Spielen | Kacheln: freie Tische, Wochenaufgaben, nächstes Event |
| Erfolge | neuer Tab | Bonusheft (10 Kugeln = 1 Gutschein), Wochenaufgaben, 14 Abzeichen in Bronze/Silber/Gold |
| Gutschein | Erfolge → Bonusheft | Einmal-Code mit QR, Personal scannt → als eingelöst markiert, Rabatt wird normal in der Kasse gebucht |
| Events | neuer Tab | Termine mit An-/Abmeldung, Teilnehmerzahl, Sponsor |
| Café-Bildschirm | Events → „Café-Bildschirm-Ansicht öffnen“ (`#tv`) | Tischbelegung (Gewichtssensor), Liga-Führende, Neuigkeiten, Event, Aufgaben – rotiert alle 12 s |

Die Regeln sind über Fußzeile und Partie-Ansicht weiter erreichbar; ihr Tab ist für „Erfolge“ und „Events“ gewichen.

## Dateien

- `features.js`, `features.css` – alle Erweiterungen, getrennt vom bestehenden Code
- `app.js` – nur kleine Einhängepunkte, alle mit `NEU` markiert (Routen, Laden, Rendern, `window.BillardApp`)
- `index.html` – zwei neue Tabs, Einbindung der neuen Dateien
- `demo-api.js` – nur für den Prototyp, gehört **nicht** in die echte App
- Für den QR-Code im Gutschein wird `qrcode-generator` (MIT) gebraucht. Im Prototyp kommt es vom CDN; in der echten App lokal ablegen, damit die CSP (`script-src 'self'`) passt.

## Was der Server zusätzlich liefern müsste

Bestehende Antworten, ergänzt um Felder:

- `GET /me` → je Wertung zusätzlich `tier` (1–3), `progress` (0–1, grob), `next_rank`
- `GET /leaderboard` → je Zeile `league_points`, `bonus`, `tier`; dazu `titles: {champion, regular, climber}` mit jeweils `player`
- `GET /players` muss das eigene Profil enthalten (prüft der Assistent schon heute)

Neue Endpunkte:

| Methode & Pfad | Antwort / Zweck |
|---|---|
| `GET /odds?pool&opponent&wins` | `{game_win_probability, provisional, suggestion: {race_self, race_opponent} \| null}` |
| `GET /achievements` | `{week: [Aufgaben], badges: [Abzeichen], stamps: {count, goal, reward, vouchers}, unseen: [Texte]}` |
| `POST /vouchers` | Gutschein aus 10 Stempeln erzeugen → `{voucher: {code, title, valid_until, redeemed_at}}` |
| `POST /vouchers/{code}/redeem` | nur Personal-Rolle; 409, wenn schon eingelöst |
| `GET /events` | `{events: [{id, type, title, starts_at, place, description, price, capacity, participants, sponsor, registered}]}` |
| `POST /events/{id}/register` | `{register: true \| false}` |
| `GET /tables` | `{tables: [{no, status: "busy" \| "free", since}]}` – aus dem Signal des Gewichtssensors, ohne Namen |
| `GET /feed` | `{items: [Texte]}` für den Café-Bildschirm |

Genaue Antwortformen und Berechnungen (Monatspunkte, Aufgaben, Abzeichen, Vorgabe) stehen als lauffähiges Beispiel in `demo-api.js`.

## Gegen Missbrauch (Vorschlag)

- Nur beidseitig bestätigte Partien zählen, wo möglich nur mit gleichzeitig belegtem Tisch laut Sensor.
- Derselbe Gegner zählt höchstens dreimal pro Monat für Liga, Aufgaben und Abzeichen.
- Stempel höchstens einer pro Spieltag plus Wochenaufgaben.
- Höchstens ein Monatspreis pro Person; auffällige Paarungen markieren, Personal entscheidet.

## Design „Nachttisch“ (aktuell)

- `theme.css` legt das Erscheinungsbild über die bestehende App: Filzgrün mit Filzstruktur, warmes Lampenlicht, Messing für Hauptaktionen und Ränge, Holz der Bande für Navigation und Leisten, Kreideblau für Zustände wie „frei“. Es überschreibt nur Optik, keine Logik, und lässt sich durch Entfernen der Zeile in `index.html` abschalten.
- Schriften: Barlow Condensed (wie das Neonschild des Cafés) und Manrope, beide Google Fonts unter der SIL Open Font License. Für die echte App lokal ablegen, sonst blockiert die CSP sie.
- Liga-Zeichen sind Billardkugeln 1–4 in Code, Avatare Initialen mit Messing-, Silber- oder Bronzering. Es werden keine Bilddateien benötigt; der Pokal ist ein Platzhalter für eine spätere Grafik.
- `assets/` enthält ältere Grafik-Entwürfe, die das aktuelle Design nicht mehr verwendet.

## Spielerprofil & Statistik (Version 6)

- Neue Ansichten: `#spieler/<id>` (öffentliches Profil), `#statistik` bzw. `#statistik/<id>`, `#profil-bearbeiten`.
- Profil: eigene Billardkugel 1–15 als Avatar (kein Foto), Motto (max. 80 Zeichen), Lieblingsdisziplin, gewählter Titel, Vitrine mit bis zu drei erspielten Pokalen/Medaillen, Sichtbarkeit (alle / nur angemeldete Spieler / nur ich). Aus der Rangliste öffnet ein Tipp auf eine Zeile oder das Podium das Profil.
- Statistik: Spielstärke-Verlauf je Disziplin als Diagramm auf einem Billardtisch (Liga-Grenzen als Kreidelinien, Liga-Kugeln an der Bande, Monate als Diamanten; Werte bleiben verborgen), Form der letzten 10, Wettbewerbe, Partien pro Monat, Lieblingstage, häufigste Gegner.
- Neue Endpunkte: `GET /profile/{id|me}`, `POST /profile` (motto, ball, favorite_pool, title_id, showcase, visibility), `GET /stats/{id|me}` (bands, history je Disziplin als Liste {t, r}, per_pool, form, streak, rivals, weekdays, months). Leaderboard-Zeilen enthalten zusätzlich `player.ball` und `player.title`. Beispiel-Umsetzung in `demo-api.js`.
- Datenschutz: Bei „nur ich“ liefert der Server für andere nur Name und Kugel, keine Statistik. Für den Verlauf werden nur Relativwerte zur Liga-Grenze gezeigt, keine Zahlen.

## Admin / Café-Verwaltung (Version 7)

Neue Datei `admin.js`, Route `#admin`, `#admin/<bereich>`, `#admin/spieler/<id>`. Für Konten mit Rolle wird in der Navigation „Erfolge“ durch „Verwaltung“ ersetzt.

**Rollen** (am Sitzungs-Objekt: `user.role` = `owner` | `staff` | `null`, `user.is_admin` bleibt für die bestehende Annullier-Funktion = Inhaber):
- Inhaber: alles.
- Theke (Personal): Übersicht, Gutscheine prüfen/einlösen, Streitfälle ansehen, Events pflegen.
- Der Server prüft jede Anfrage selbst (403 ohne passende Rolle). In der Demo wechselt der Prototyp-Balken zwischen Spieler / Inhaber / Theke (`POST /demo/switch`, nur Demo).

**Bereiche und Endpunkte** (alle unter `/admin`, schreibende Aktionen mit Spielerbezug brauchen `reason`, mind. 3 Zeichen, und erzeugen einen Protokolleintrag):
- Übersicht – `GET /admin/overview`: offener Monatsabschluss, Streitfälle, offene/heute eingelöste Gutscheine, auffällige Paarungen (≥ 5 Partien derselben zwei Spieler im Monat), neue Spieler, letzte Aktionen.
- Monatsabschluss – `GET /admin/month-close?month=`, `POST /admin/month-close/decide {month, key, decision: approve|reject|swap, player_id?, reason}`, `POST /admin/month-close/approve-all {month, reason?}`. Das System schlägt je Disziplin (8-/9-Ball) und Café-Liga den Sieger vor, dazu Champion, Stammgast, Aufsteiger; Regel „höchstens eine Auszeichnung pro Person“ mit Nachrücker. **Monatstitel entstehen erst nach Bestätigung** (vorher automatisch). Bestätigen vergibt Pokal/Medaille + Titel + Gutschein und benachrichtigt den Spieler.
- Spieler – `GET /admin/players?q=`, `GET /admin/players/{id}`, `POST …/{id}/award {catalog_id}`, `…/revoke {honor_id}`, `…/stamps {delta}` (−10…+10), `…/voucher {catalog_id}`, `…/pin-reset` (liefert Einmal-Code, wird nicht gespeichert), `…/block {blocked}` (gesperrt = kein Login, nicht in Rangliste/Monatsabschluss), `…/merge {into_id}` (Doppelprofile: Partien, Auszeichnungen, Gutscheine, Stempel wandern, Wertung wird neu berechnet).
- Gutscheine – `GET /admin/vouchers?status=open|redeemed|expired|all`, `GET /admin/vouchers/{code}`, `POST /admin/vouchers/{code}/redeem` (409 schon eingelöst, 410 abgelaufen). Der alte Spieler-Endpunkt `/vouchers/{code}/redeem` ist jetzt ebenfalls nur fürs Personal.
- Streitfälle – `GET /admin/matches` (widersprochene Partien), `POST /admin/matches/{id}/resolve {score_a, score_b}`, `POST /admin/matches/{id}/void` (wie bisher).
- Gutscheine verteilen (nur Inhaber) – Ansicht `#admin/gutscheine/neu`. `POST /admin/vouchers/preview` (gleicher Body, nur Vorschau: Anzahl + Empfänger), `POST /admin/vouchers/issue {template: <Vorlagen-ID>|custom, title?, valid_days?, note?, target: players|liga|active|event|all|none, player_ids?, liga?, pool?, event_id?, count?, reason}` (max. 200 bzw. 50 Codes), `GET /admin/vouchers/batches` (Aktionen mit eingelöst/gesamt). `target: none` erzeugt Codes ohne Empfänger zum Ausgeben (Flyer, Neukunden); sie lassen sich an der Theke genauso einlösen. Empfänger werden benachrichtigt, der Hinweis (`note`) erscheint im Bonusheft.
- Belohnungs-Katalog – `GET/POST /admin/catalog {name, kind: pokal|medaille|titel|gutschein, tier 1–3 | valid_days 7–365, description?, sponsor?}`, `POST /admin/catalog/{id}/archive`.
- Events – `POST /admin/events {id?, type, title, starts_at, place, price, capacity|null, sponsor?, description}`, `POST /admin/events/{id}/delete`.
- Wochenaufgaben – `GET/POST /admin/quests {id?, title, text, type: new_opponent|pool|higher_liga|weekday|doubles|games, goal 1–10, pool?, weekday 0–6?}`, `POST /admin/quests/{id}/delete`; höchstens 5.
- Protokoll – `GET /admin/audit?player=&action=`: Zeit, Person, Rolle, Aktion, Spieler, Detail, Begründung; nicht löschbar.

**Spieler-Seite:** Verliehenes erscheint in Vitrine/Titelauswahl mit „Vom Café verliehen · Datum“, Gutscheine im Bonusheft mit Herkunft. Benachrichtigungen bleiben, bis die App sie mit `POST /achievements/seen {count}` bestätigt (gehen bei Profilwechsel nicht verloren).

**Offen für die echte Umsetzung:** echte Café-Konten mit eigener Anmeldung (nicht per Nickname), Push-Benachrichtigungen, QR-Scan per Kamera an der Theke, Benachrichtigung angemeldeter Spieler bei gelöschten Events.

**Demo lokal ansehen:** `python tools/build_demo.py`, dann `python -m http.server 8765 --directory demo-build` und http://localhost:8765 öffnen. Oben im Prototyp-Balken zwischen Spieler, Inhaber und Theke wechseln.

## Profilbild & neue Motive (Version 9)

**Profilbild:** Spieler wählen im Profil-Editor zwischen *Kugel* (wie bisher), *Vorlage* (8 SVG-Motive: Acht, Queues, Kreide, Dreieck, Tasche, Pokal, Neun, Lampe) oder *eigenem Foto*. Fotos werden im Browser quadratisch auf 256 px zugeschnitten und als JPEG (Qualität 0.85) gesendet. Der Server erhält damit nie das Originalfoto mit EXIF- oder GPS-Daten.

- `POST /api/profile` nimmt zusätzlich `avatar_type` (`ball` | `preset` | `photo`), `preset_id` und `photo` (data-URL, jpeg/png/webp, max. ca. 300 KB) an.
- Spielerdaten (Rangliste, Profile) liefern `av: {type, preset, photo}`. Bei privaten Profilen sehen andere nur die Kugel.
- Inhaber und Theke: `POST /api/admin/players/:id/remove-photo` entfernt ein unpassendes Foto. Der Spieler wird benachrichtigt, und der Vorgang steht im Protokoll.
- Datenschutz: Fotos sind personenbezogene Daten. Deshalb sind sie optional, werden beim Löschen des Kontos mit entfernt und gehören in die Datenschutzerklärung. Für den Echtbetrieb sollten die Bilder als Datei oder Blob gespeichert werden statt als data-URL in der Datenbank.

**Motive:** Scrollbalken als Queue (Spitze, Kreide, Ahornschaft, Wicklung), Fortschrittsbalken als Queue mit Spielball, Kreidewürfel statt Punkten (Checkboxen, Protokoll, TV-Punkte, Navigation), Bande mit Diamanten unter Überschriften, Wochenaufgaben als Kreidetafel (Schrift Caveat). Die Verwaltungs-Tabs brechen jetzt um, statt rechts abgeschnitten zu werden.

## Icons & Orte (Version 10)

**Icons:** `icons.js` enthält 36 Icons von [game-icons.net](https://game-icons.net) (Lorc & Delapouite, **CC BY 3.0**: gewerbliche Nutzung erlaubt, Namensnennung Pflicht, steht im Footer). Aufruf: `BCMIcon('trophy')`, eingefärbt über `currentColor`. Eingesetzt in Navigation, Abzeichen und Vitrine (statt Anfangsbuchstaben), Event-Arten, Verwaltungs-Reitern, Kacheln und Gutscheinen. Weitere Icons: Namen in `tools/build_icons.py` ergänzen und das Skript laufen lassen (Anleitung im Skript).

**Orte (Standorte):** Der Inhaber verwaltet unter *Verwaltung → Orte* Standorte mit Name, Adresse und Notiz. Das Stammhaus ist fest.
- **Events** haben einen Standort und einen optionalen Hinweis (z. B. „Ausweichort wegen Renovierung“). Ändert sich der Standort, bekommen alle Angemeldeten eine Nachricht. Das Event zeigt dann 14 Tage lang „Ort geändert“ samt Adresse und Kartenlink (OpenStreetMap, nur ein Link – es wird nichts eingebettet oder geladen).
- **Gutscheine** (Vorlagen, Einzel- und Sammelausgabe) können auf einen Standort beschränkt werden. Die Theke wählt, an welchem Standort sie steht; ein Gutschein für einen anderen Standort wird dann nicht eingelöst (Server prüft das ebenfalls, 409).
- Endpunkte: `GET /api/venues` (öffentlich, `?all=1` mit archivierten), `POST /api/admin/venues` (anlegen/bearbeiten, nur Inhaber), `POST /api/admin/venues/:id/archive`. Events und Gutscheine liefern `venue: {id, name, address, main}`; Events zusätzlich `venue_note`, `venue_changed`. `POST …/redeem` nimmt `venue_id` der Theke an.
- Ein Standort mit kommenden Events lässt sich erst archivieren, wenn die Events verlegt sind.

## Tische & QR-Codes (Version 11)

Unter *Verwaltung → Tische & QR* legt der Inhaber Tische pro Standort an: Nummer, Art (Pool/Snooker/Karambol), optionale Bezeichnung und optionale Sensor- oder Kassen-ID für die Tischzeit. Die Theke sieht die Tische und kann drucken, aber nichts ändern.

- **QR-Code:** enthält nur einen Link `…/#tisch/<kürzel>`. Das Kürzel ist zufällig (10 Zeichen) und keine Tischnummer. „Neuer Code“ macht den alten sofort ungültig, zum Beispiel wenn ein Aufkleber beschädigt oder abfotografiert wurde. Das steht mit Begründung im Protokoll. Nummer oder Standort zu ändern, lässt den Code gültig.
- **Druck:** Einzelkarte oder alle Tische eines Standorts. Vier Karten (9 × 12 cm) passen auf eine A4-Seite, mit heller Druckvariante. Dazu gibt es Download als SVG und „Link kopieren“.
- **Scannen (Spieler):** Die Seite `#tisch/<kürzel>` zeigt Tisch, Standort und Belegung. Mit „Hier spielen“ merkt sich die App den Tisch für vier Stunden, nur in diesem Browser-Tab. Die Startseite zeigt dann „Du spielst an Tisch X“ und die Tische dieses Standorts. Ungültige Codes zeigen einen Hinweis.
- **Endpunkte:**
  - `GET /api/tables?venue=` (öffentlich)
  - `GET /api/tables/:kürzel` (öffentlich, 404 bei ungültigem Code)
  - `GET /api/admin/tables`
  - `POST /api/admin/tables` (anlegen/bearbeiten, Nummer pro Standort eindeutig)
  - `POST /api/admin/tables/:id/new-code` (mit Begründung)
  - `POST /api/admin/tables/:id/toggle`
- **Für den Echtbetrieb:**
  - Die Basis-Adresse im QR-Code sollte fest die öffentliche Domain sein, nicht `location.href`.
  - Beim Anlegen einer Partie sollte die App `table_id` mitschicken. Damit lassen sich Wochenaufgaben pro Standort umsetzen, und Sensorzeit und Partie passen zusammen.
- **Bibliothek:** Der QR-Code wird mit `vendor/qrcode.js` erzeugt (qrcode-generator, MIT, Lizenz liegt daneben). Die Datei liegt lokal, damit die Content-Security-Policy (`script-src 'self'`) greift. Das betrifft auch die Gutschein-QR-Codes.
