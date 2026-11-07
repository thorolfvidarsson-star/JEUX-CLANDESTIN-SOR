#!/usr/bin/env python3
"""Préparer les fichiers Cloudflare Pages du poker SOR, sans publication distante."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
files = (
    'index.html', 'tables.html', 'game.html', 'rules.html', 'admin.html', 'solo.html',
    'app.js', 'tables.js', 'game.js', 'admin.js', '_worker.js',
    'style.css', 'sor-theme.css', 'sw.js', 'sw-register.js',
    'manifest.webmanifest', 'sons-of-reaper.png',
    'blackjack.html', 'blackjack.js', 'club-ui.css',
    'club-heading.woff', 'FONT-LICENSE.txt',
    'roulette.html', 'roulette.js', 'roulette.css',
)
# Valider l'ensemble avant de modifier les fichiers installables.
for name in files:
    source = root / 'app' / name
    if source.is_symlink() or not source.is_file():
        raise SystemExit('Source absente ou invalide : ' + name)
    if name.endswith('.html') and b'<!doctype html>' not in source.read_bytes().lower():
        raise SystemExit('HTML invalide : ' + name)
destination = root / 'deploy'
destination.mkdir(parents=True, exist_ok=True)
for name in files:
    shutil.copyfile(root / 'app' / name, destination / name)
print(f'Prêt : {len(files)} fichiers dans deploy/ (Worker, interface et visuel).')
