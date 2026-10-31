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

## Design (Version 2)

- `theme.css` legt das neue Erscheinungsbild über die bestehende App (Schwarz mit Goldlicht, Türkis aus dem Café-Logo). Es überschreibt nur Optik, keine Logik, und lässt sich durch Entfernen der Zeile in `index.html` komplett abschalten.
- Schriften: Outfit (Text) und Cinzel (Auszeichnungen) von Google Fonts. Für die echte App die Schriftdateien lokal ablegen (beide unter der SIL Open Font License), sonst blockiert die CSP sie und es greifen die Systemschriften.
- Die Avatare sind Initialen mit Farbe aus dem Nickname – keine Fotos, also keine zusätzlichen personenbezogenen Daten.
