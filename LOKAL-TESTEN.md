# Prototyp lokal testen (App + Café-Bildschirm)

## Windows – ohne Installation
1. Im Projektordner **„Demo starten.bat“** doppelklicken.
2. Es öffnen sich zwei Browserfenster:
   - die App (`demo.html`)
   - der Café-Bildschirm (`tv-demo.html`)
3. Oben im Prototyp-Balken zwischen **Spieler**, **Inhaber** und **Theke** wechseln. Als Inhaber unter *Café-TV* den Bildschirm umschalten oder eine Durchsage machen. Das Bildschirm-Fenster zeigt die Änderung nach wenigen Sekunden.
4. Beenden: das schwarze Fenster schließen.

Fragt Windows nach der Firewall, für **private Netzwerke** erlauben. Nur dann kann der Fernseher zugreifen.

## Fernseher, Tablet oder zweiter Monitor
- **Zweiter Monitor oder Fernseher per HDMI am Laptop:** das Fenster „Café-Bildschirm“ hinüberziehen und mit **F11** auf Vollbild schalten.
- **Fernseher oder Fire-TV-Stick im selben WLAN:** die Adresse öffnen, die im schwarzen Fenster steht, z. B. `http://192.168.178.20:8765/tv-demo.html?bildschirm=haupt`. Für die Turnierecke `?bildschirm=turnier` verwenden.
  - Der Fernseher zeigt dann live, was in der Demo-App am Laptop eingestellt wird.
  - Die Demo-App muss dafür am Laptop geöffnet bleiben.
  - Hochgeladene Videos laufen in der Demo nur auf dem Laptop. Bilder funktionieren überall.

## Mac / Linux
`python3 tools/demo_server.py` im Projektordner starten. Das funktioniert genauso wie unter Windows.

## Gut zu wissen
- Die Demo nutzt **erfundene Daten** und keinen echten Server. Neu laden setzt alles zurück.
- Wer `index.html` oder `tv.html` ändert, erzeugt die Demo-Seiten neu: `python tools/build_demo.py`. Das braucht Python; Änderungen an JS- und CSS-Dateien wirken ohne diesen Schritt.
- `python tools/build_demo.py --paket` legt zusätzlich einen eigenständigen Ordner `demo-build/` zum Weitergeben an.
