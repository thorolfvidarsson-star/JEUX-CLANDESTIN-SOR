"""Contrôles du livrable réel, du périmètre autorisé et des refus de publication."""

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from tools.package import package


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "app").mkdir()
        (self.root / "app/main.txt").write_text("Sources fictives de contrôle.\n", encoding="utf-8")
        (self.root / "deploy").mkdir()
        (self.root / "deploy/README.md").write_text("Instructions uniquement.\n", encoding="utf-8")
        self.config = {
            "project": "FIXTURE",
            "source_paths": ["app", "delivery.json"],
            "deploy_directory": "deploy",
        }
        self.save_config()

    def save_config(self):
        (self.root / "delivery.json").write_text(json.dumps(self.config), encoding="utf-8")

    def test_sources_exactes_empreinte_et_reproductibilite(self):
        (self.root / "hors_perimetre.txt").write_text("Ne pas publier.", encoding="utf-8")
        (self.root / "app/node_modules").mkdir()
        (self.root / "app/node_modules/cache.txt").write_text("Ne pas embarquer.", encoding="utf-8")
        first = package(self.root, "1.0.0", self.root / "sortie-1")
        second = package(self.root, "1.0.0", self.root / "sortie-2")
        self.assertEqual(first, second)
        info = first["archives"][0]
        one = self.root / "sortie-1" / info["file"]
        two = self.root / "sortie-2" / info["file"]
        self.assertEqual(one.read_bytes(), two.read_bytes())
        self.assertEqual(hashlib.sha256(one.read_bytes()).hexdigest(), info["sha256"])
        with zipfile.ZipFile(one) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(set(archive.namelist()), {"app/main.txt", "delivery.json"})
            self.assertEqual(archive.read("app/main.txt"), (self.root / "app/main.txt").read_bytes())

    def test_deployable_a_la_racine_et_fichiers_speciaux_conserves(self):
        (self.root / "deploy/index.html").write_text("<p>Application fictive</p>", encoding="utf-8")
        (self.root / "deploy/_headers").write_text("/*\n  X-Test: yes\n", encoding="utf-8")
        (self.root / "deploy/.well-known").mkdir()
        (self.root / "deploy/.well-known/exemple.json").write_text("{}", encoding="utf-8")
        manifest = package(self.root, "1.0.0", deployable=True)
        self.assertEqual(len(manifest["archives"]), 2)
        with zipfile.ZipFile(self.root / "livraison/FIXTURE_1.0.0_Deployable.zip") as archive:
            self.assertEqual(set(archive.namelist()), {"index.html", "_headers", ".well-known/exemple.json"})

    def test_deployable_vide_refuse_sans_livraison_partielle(self):
        with self.assertRaisesRegex(ValueError, "Déployable vide"):
            package(self.root, "1.0.0", deployable=True)
        self.assertFalse((self.root / "livraison").exists())

    def test_secret_selectionne_refuse(self):
        (self.root / "app/.env").write_text("FAUX_SECRET=fictif", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Fichier privé"):
            package(self.root, "1.0.0")
        self.assertFalse((self.root / "livraison").exists())

    def test_lien_symbolique_refuse(self):
        (self.root / "app/lien.txt").symlink_to(self.root / "delivery.json")
        with self.assertRaisesRegex(ValueError, "Lien symbolique"):
            package(self.root, "1.0.0")

    def test_historique_git_explicitement_selectionne_refuse(self):
        (self.root / ".git").mkdir()
        (self.root / ".git/config").write_text("Historique technique fictif.", encoding="utf-8")
        self.config["source_paths"].append(".git")
        self.save_config()
        with self.assertRaisesRegex(ValueError, "Dossier technique"):
            package(self.root, "1.0.0")

    def test_chemin_externe_version_et_sortie_recursive_refuses(self):
        for version in ["../ailleurs", "1.0.0/ailleurs", ""]:
            with self.subTest(version=version), self.assertRaises(ValueError):
                package(self.root, version)
        self.config["source_paths"] = ["../ailleurs"]
        self.save_config()
        with self.assertRaises(ValueError):
            package(self.root, "1.0.0")
        self.config["source_paths"] = ["app"]
        self.save_config()
        with self.assertRaisesRegex(ValueError, "hors des chemins"):
            package(self.root, "1.0.0", self.root / "app/sortie")

    def test_meme_version_differente_non_ecrasee(self):
        first = package(self.root, "1.0.0")
        original = (self.root / "livraison" / first["archives"][0]["file"]).read_bytes()
        (self.root / "app/main.txt").write_text("Sources fictives modifiées.", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "autre livraison"):
            package(self.root, "1.0.0")
        self.assertEqual((self.root / "livraison" / first["archives"][0]["file"]).read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
