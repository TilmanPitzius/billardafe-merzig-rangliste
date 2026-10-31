#!/usr/bin/env python3
"""Baut die Demo-Version des Prototyps nach ./demo-build/ (mit erfundenen Daten, ohne echten Server).

Starten:  python tools/build_demo.py
Ansehen:  python -m http.server 8765 --directory demo-build   ->  http://localhost:8765
"""
import os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'demo-build')
FILES = ['app.js', 'app.css', 'opening.js', 'opening.css', 'rules.js', 'scorekeeper.js', 'scorekeeper.css',
         'icons.js', 'features.js', 'admin.js', 'features.css', 'theme.css', 'demo-api.js']

def main():
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    for f in FILES:
        shutil.copy(os.path.join(ROOT, f), OUT)
    for d in ['icons', 'branding']:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))
    # Demo: kein echter Server, kein Login-Modul
    with open(os.path.join(OUT, 'deployment-config.js'), 'w', encoding='utf-8') as fh:
        fh.write("'use strict';\nwindow.BillardDeployment = Object.freeze({}); // Demo: kein echter Server\n")
    with open(os.path.join(ROOT, 'index.html'), encoding='utf-8') as fh:
        html = fh.read()
    head = html[html.index('<head>') + 6:html.index('</head>')]
    body = html[html.index('<body>') + 6:html.index('</body>')]
    for pat in [r'\s*<meta http-equiv="Content-Security-Policy"[^>]*>', r'\s*<link rel="manifest"[^>]*>']:
        head = re.sub(pat, '', head)
    head = head.replace('<script src="./remote-auth.js" defer></script>', '')
    head = head.replace('<link rel="stylesheet" href="./app.css">',
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Caveat:wght@500;700&family=Manrope:wght@400;500;600;700;800&display=swap">\n'
        '  <link rel="stylesheet" href="./app.css">')
    head = head.replace('<script src="./deployment-config.js" defer></script>',
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" defer></script>\n'
        '  <script src="./demo-api.js" defer></script>\n  <script src="./deployment-config.js" defer></script>')
    bar = ('<div class="fx-demo-bar" role="note"><strong>Prototyp</strong><span>Erfundene Daten · neu laden setzt alles zurück.</span>'
           '<span class="fx-demo-roles" role="group" aria-label="Demo-Ansicht"><button type="button" data-demo-as="player" aria-pressed="true">Spieler</button>'
           '<button type="button" data-demo-as="owner" aria-pressed="false">Inhaber</button><button type="button" data-demo-as="staff" aria-pressed="false">Theke</button></span></div>')
    body = body.replace('<div id="app-shell">', '<div id="app-shell">\n  ' + bar, 1)
    with open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write('<!doctype html>\n<html lang="de">\n<head>\n' + head.strip() + '\n</head>\n<body>\n' + body.strip() + '\n</body>\n</html>\n')
    print('Demo gebaut:', OUT)
    print('Ansehen: python -m http.server 8765 --directory demo-build  ->  http://localhost:8765')

if __name__ == '__main__':
    sys.exit(main())
