#!/usr/bin/env python3
"""Préparer la page HTML d'accueil ; aucune publication distante."""

from pathlib import Path


root = Path(__file__).resolve().parents[1]
source = root / "app/index.html"
destination = root / "deploy/index.html"
contents = source.read_bytes()
if b"<!doctype html>" not in contents.lower() or b"<html" not in contents.lower():
    raise SystemExit("La page d’accueil HTML est absente ou invalide.")
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(contents)
print("Prêt : deploy/index.html (" + str(len(contents)) + " octets)")
