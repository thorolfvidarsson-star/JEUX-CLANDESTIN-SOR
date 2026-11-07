# JEUX-CLANDESTIN-SOR

Le code complet du poker **Sons of Reaper / Paleto Bay** est intégré dans `app/` :
Texas Hold’em multijoueur, comptes, jetons virtuels, tables, règles et administration.
Interface noire et argent, rouge réservé aux yeux de la faucheuse. Aucune boutique.
Le mode solo reste fermé, comme dans le ZIP fourni ; aucun autre jeu n'est inclus.

## Télécharger la version 1.0.0-sor

- [ZIP Déployable](livraison/1.0.0-sor/JEUX-CLANDESTIN-SOR_1.0.0-sor_Deployable.zip?raw=true)
- [ZIP Sources complet](livraison/1.0.0-sor/JEUX-CLANDESTIN-SOR_1.0.0-sor_Sources.zip?raw=true)
- [Empreintes SHA-256](livraison/1.0.0-sor/SHA256SUMS.txt)

Le Déployable contient les fichiers à la racine pour Cloudflare Pages en mode avancé.
Configurer le binding D1 `DB` sur votre base. Aucune base réelle ni secret n'est livré.
Ce commit publie le code et les ZIP sur GitHub ; il ne déploie pas le site sur Cloudflare.

## Organisation et validation

- `app/` : toutes les sources confiées et adaptées, documentation et schéma SQL.
- `deploy/` : interface, Worker et ressources préparés par `tools/build.py`.
- `tools/`, `tests/` : génération et vérification des livraisons.
- `livraison/` : versions précédentes conservées et nouveaux ZIP vérifiés.

Les vérifications locales réalisées couvrent le chargement des six tables avec D1
locale, l'ouverture de la connexion, les pages principales et le rendu mobile à
390 px sans débordement. Aucune partie multijoueur complète ni D1 de production
testée. Voir `app/README-SOR.md`. Le visuel est une recréation des références fournies.

Le moteur vient du ZIP Black Woods fourni par l'utilisateur, sans reprise du code
privé de SOR PB Gestion. Voir `app/README.md` pour le démarrage local.

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

Le poker est préparé par `tools/build.py`, qui copie explicitement les pages, scripts, styles, Worker et visuel depuis `app/` vers `deploy/`. Pour ajouter d’autres jeux, placer leurs sources dans `app/` et adapter la préparation des fichiers installables dans `deploy/`. Le projet n'impose aucun moteur de jeu. Si son organisation diffère, adapter explicitement `source_paths` et `deploy_directory` dans `delivery.json`. Un chemin de sources configuré mais absent provoque une erreur.

Conserver les secrets, identifiants et bases réelles hors du dépôt et des livraisons. Le générateur ignore les dossiers techniques et refuse notamment les fichiers `.env` réels, clés privées et bases SQLite. Les fichiers `.env.example`, `.env.sample` et `.env.template` peuvent servir de modèles sans secret.

Pour fournir des liens permanents comme dans la conversation SOR PB Gestion, ajouter volontairement les ZIP vérifiés de `livraison/` au dépôt. Les versions déjà enregistrées ne sont pas réembarquées dans le ZIP Sources.

## Reprendre depuis une autre conversation

Donner à Codex l'adresse du dépôt :

https://github.com/thorolfvidarsson-star/JEUX-CLANDESTIN-SOR

Puis demander : « Travaille sur ce dépôt, lis `AGENTS.md`, exécute les vérifications puis livre les ZIP et leurs liens GitHub. » La conversation doit disposer de l'accès au dépôt et des outils d'exécution ou de livraison nécessaires. La configuration de ce dépôt ne change pas les outils disponibles dans une autre conversation ChatGPT.
