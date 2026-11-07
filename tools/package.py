#!/usr/bin/env python3
"""ZIP vérifiés depuis des chemins explicites ; aucun réseau ni déploiement."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import zipfile


IGNORED_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", ".wrangler", "livraison",
}
PRIVATE_DIRS = {".ssh", ".aws", ".codex"}
IGNORED_FILES = {".DS_Store", ".gitkeep"}
ENV_MODELS = {".env.example", ".env.sample", ".env.template"}
PRIVATE_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".sqlite", ".sqlite3", ".db"}


def configured_path(root, value):
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError("Les chemins configurés doivent être relatifs au dépôt.")
    if ".." in Path(value).parts or value in {".", "./"}:
        raise ValueError("Chemin non autorisé : " + value)
    if any(part in IGNORED_DIRS | PRIVATE_DIRS for part in Path(value).parts):
        raise ValueError("Dossier technique ou privé non autorisé : " + value)
    path = root / value
    for ancestor in [path, *path.parents]:
        if ancestor == root:
            break
        if ancestor.is_symlink():
            raise ValueError("Lien symbolique refusé : " + value)
    if not path.resolve().is_relative_to(root):
        raise ValueError("Chemin hors du dépôt : " + value)
    if not path.exists():
        raise ValueError("Chemin configuré absent : " + value)
    return path


def check_file(root, path):
    relative = path.relative_to(root)
    if path.is_symlink() or not path.resolve().is_relative_to(root):
        raise ValueError("Lien symbolique ou chemin externe refusé : " + str(relative))
    name = path.name.lower()
    private_env = (name == ".env" or name.startswith(".env.")) and name not in ENV_MODELS
    if private_env or path.suffix.lower() in PRIVATE_SUFFIXES:
        raise ValueError("Fichier privé refusé dans une archive : " + str(relative))
    if any(part in PRIVATE_DIRS for part in relative.parts):
        raise ValueError("Dossier privé refusé : " + str(relative))


def collect(root, path):
    if path.is_file():
        check_file(root, path)
        return [path]
    files = []
    for current, dirs, names in os.walk(path, followlinks=False):
        current = Path(current)
        kept = []
        for name in sorted(dirs):
            child = current / name
            if name in IGNORED_DIRS:
                continue
            if child.is_symlink() or name in PRIVATE_DIRS:
                raise ValueError("Dossier privé ou lien refusé : " + str(child.relative_to(root)))
            kept.append(name)
        dirs[:] = kept
        for name in sorted(names):
            if name in IGNORED_FILES or name.endswith((".pyc", ".pyo")):
                continue
            child = current / name
            check_file(root, child)
            files.append(child)
    return files


def archive_bytes(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, path in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o100755 if path.stat().st_mode & 0o111 else 0o100644) << 16
            archive.writestr(info, path.read_bytes())
    contents = stream.getvalue()
    with zipfile.ZipFile(io.BytesIO(contents)) as archive:
        if archive.testzip() is not None or set(archive.namelist()) != set(files):
            raise RuntimeError("Échec du contrôle CRC ou de la liste des fichiers.")
        for name, path in files.items():
            if archive.read(name) != path.read_bytes():
                raise RuntimeError("Un fichier a changé pendant la génération : " + name)
    return contents


def package(root, version, output=None, deployable=False):
    root = Path(root).resolve()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}", version):
        raise ValueError("Version invalide : lettres, chiffres, points, tirets ou underscores.")
    config = json.loads((root / "delivery.json").read_text(encoding="utf-8"))
    project = config.get("project", "")
    if not isinstance(project, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}", project):
        raise ValueError("Nom de projet invalide dans delivery.json.")
    source_paths = config.get("source_paths")
    if not isinstance(source_paths, list) or not source_paths:
        raise ValueError("Renseigner source_paths dans delivery.json.")
    output = Path(output) if output is not None else root / "livraison"
    output = output.resolve()
    sources = {}
    for value in source_paths:
        path = configured_path(root, value)
        if path.is_dir() and output.is_relative_to(path):
            raise ValueError("Le dossier de sortie doit être hors des chemins de sources.")
        sources.update({p.relative_to(root).as_posix(): p for p in collect(root, path)})
    if not sources:
        raise ValueError("Aucun fichier de sources à archiver.")
    plans = [("Sources", sources)]
    if deployable:
        deploy = configured_path(root, config.get("deploy_directory"))
        if not deploy.is_dir():
            raise ValueError("deploy_directory doit être un dossier.")
        if output.is_relative_to(deploy):
            raise ValueError("Le dossier de sortie doit être hors du dossier de déploiement.")
        files = {p.relative_to(deploy).as_posix(): p for p in collect(root, deploy)}
        files.pop("README.md", None)
        if not files:
            raise ValueError("Déployable vide : ajouter les fichiers installables dans deploy_directory.")
        plans.append(("Deployable", files))
    # Tous les contenus sont contrôlés avant d'écrire une livraison.
    archives = []
    for label, files in plans:
        name = project + "_" + version + "_" + label + ".zip"
        contents = archive_bytes(files)
        target = output / name
        if target.exists() and target.read_bytes() != contents:
            raise ValueError("Une autre livraison existe pour cette version : " + name)
        archives.append((name, contents, {
            "file": name,
            "bytes": len(contents),
            "files": len(files),
            "sha256": hashlib.sha256(contents).hexdigest(),
            "crc": "PASS",
            "all_bytes_verified": True,
        }))
    output.mkdir(parents=True, exist_ok=True)
    for name, contents, _ in archives:
        (output / name).write_bytes(contents)
    manifest = {
        "project": project,
        "version": version,
        "mode": "sources_and_deployable" if deployable else "sources",
        "archives": [info for _, _, info in archives],
    }
    (output / "MANIFESTE.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "SHA256SUMS.txt").write_text(
        "".join(info["sha256"] + "  " + name + "\n" for name, _, info in archives), encoding="utf-8"
    )
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--deployable", action="store_true")
    args = parser.parse_args()
    try:
        manifest = package(Path(__file__).resolve().parents[1], args.version, args.output, args.deployable)
    except (OSError, ValueError, RuntimeError) as error:
        print("ERREUR : " + str(error), file=sys.stderr)
        return 2
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
