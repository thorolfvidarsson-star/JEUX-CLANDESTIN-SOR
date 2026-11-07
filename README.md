# JEUX-CLANDESTIN-SOR

Dépôt préparé pour recevoir les jeux et livrer des ZIP vérifiés.

**Version actuelle : page d'accueil HTML déployable. Les jeux ne sont pas encore intégrés.** Le ZIP Déployable contient `index.html` à la racine et affiche une page « En préparation ».

[Télécharger le ZIP Déployable avec HTML](livraison/0.0.1-accueil/JEUX-CLANDESTIN-SOR_0.0.1-accueil_Deployable.zip?raw=true)

Dans Cloudflare Pages, utiliser ce ZIP Déployable. Le ZIP de configuration initial ci-dessous ne contient aucune page de site et ne doit pas être déployé.

[Télécharger le ZIP Sources de configuration](livraison/0.0.0-configuration/JEUX-CLANDESTIN-SOR_0.0.0-configuration_Sources.zip?raw=true)

## Organisation

- `app/` : page d'accueil et futures sources des jeux.
- `deploy/` : page prête à installer, produite par `tools/build.py`.
- `delivery.json` : nom du projet et chemins autorisés dans les archives.
- `tools/package.py` : génération des ZIP et vérification des contenus, CRC et SHA-256.
- `tests/` : tests du mécanisme de livraison, sans dépendance externe.
- `livraison/` : ZIP générés et manifeste de vérification.

Ce dépôt est indépendant de SOR PB Gestion. Il ne contient ni ses sources privées ni les données du club.

## Générer les ZIP depuis GitHub

1. Ouvrir **Actions → Générer les ZIP → Run workflow**.
2. Indiquer une version, par exemple `0.1.0`.
3. Laisser **Générer aussi le ZIP Déployable** décoché pour les Sources seules. Le cocher lorsque les fichiers prêts à installer sont présents dans `deploy/`.
4. Attendre la réussite des tests et de la génération.
5. Télécharger le résultat dans **Artifacts**, en bas de l'exécution. Le téléchargement GitHub contient les ZIP produits, `MANIFESTE.json` et `SHA256SUMS.txt`. Ces artefacts sont conservés 30 jours.

Le workflow est manuel. Il ne publie aucun site, n'exécute aucun déploiement et ne modifie aucune base distante.

## Générer les ZIP en local

Python 3.10 ou plus récent suffit ; aucune bibliothèque supplémentaire n'est nécessaire.

```sh
python3 -m unittest discover -s tests -v
python3 tools/package.py --version 0.1.0
```

Pour générer également le Déployable :

```sh
python3 tools/build.py
python3 tools/package.py --version 0.1.0 --deployable
```

Fichiers produits dans `livraison/` :

```text
JEUX-CLANDESTIN-SOR_0.1.0_Sources.zip
JEUX-CLANDESTIN-SOR_0.1.0_Deployable.zip  # uniquement avec --deployable
MANIFESTE.json
SHA256SUMS.txt
```

Le Déployable contient directement les fichiers de `deploy/`, sans dossier parent. La génération refuse un dossier de déploiement vide ou contenant seulement son README explicatif. Les chemins sortant du dépôt, les liens symboliques et les fichiers privés reconnus sont refusés. Les fichiers des ZIP sont relus et comparés aux fichiers d'origine.

## Ajouter l'application

La page d'accueil est préparée par `tools/build.py`. Pour ajouter les jeux, placer leurs sources dans `app/`, adapter la compilation à leur technologie et préparer leurs fichiers installables dans `deploy/`. Le projet n'impose aucun moteur de jeu. Si son organisation diffère, adapter explicitement `source_paths` et `deploy_directory` dans `delivery.json`. Un chemin de sources configuré mais absent provoque une erreur.

Conserver les secrets, identifiants et bases réelles hors du dépôt et des livraisons. Le générateur ignore les dossiers techniques et refuse notamment les fichiers `.env` réels, clés privées et bases SQLite. Les fichiers `.env.example`, `.env.sample` et `.env.template` peuvent servir de modèles sans secret.

Pour fournir des liens permanents comme dans la conversation SOR PB Gestion, ajouter volontairement les ZIP vérifiés de `livraison/` au dépôt. Les versions déjà enregistrées ne sont pas réembarquées dans le ZIP Sources.

## Reprendre depuis une autre conversation

Donner à Codex l'adresse du dépôt :

https://github.com/thorolfvidarsson-star/JEUX-CLANDESTIN-SOR

Puis demander : « Travaille sur ce dépôt, lis `AGENTS.md`, exécute les vérifications puis livre les ZIP et leurs liens GitHub. » La conversation doit disposer de l'accès au dépôt et des outils d'exécution ou de livraison nécessaires. La configuration de ce dépôt ne change pas les outils disponibles dans une autre conversation ChatGPT.
