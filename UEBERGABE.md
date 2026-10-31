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
