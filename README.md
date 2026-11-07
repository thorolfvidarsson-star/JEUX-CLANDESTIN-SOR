# JEUX-CLANDESTIN-SOR

## Candidate 1.1.1-sor-biker — le clubhouse

- [ZIP Déployable — HTML à la racine](livraison/1.1.1-sor-biker/JEUX-CLANDESTIN-SOR_1.1.1-sor-biker_Deployable.zip?raw=true)
- [ZIP Sources et tests](livraison/1.1.1-sor-biker/JEUX-CLANDESTIN-SOR_1.1.1-sor-biker_Sources.zip?raw=true)
- [Changements et vérifications](app/BIKER-1.1.1.md)
- [Aperçu PC](livraison/1.1.1-sor-biker/LOBBY_1366.png) · [Aperçu mobile](livraison/1.1.1-sor-biker/LOBBY_390.png)

Ambiance biker affirmée : patch MC, cuir cousu, plaques en acier et gros lettrage inclus dans les fichiers. Les jeux, comptes, soldes et permissions sont ceux de la 1.1.0 : Worker, schéma et scripts métier identiques. Tests Chromium/workerd/D1 en local aux largeurs 320/390/1366 px ; aucun appareil physique ni FiveM réel testé. Aucun déploiement de production. Les versions ci-dessous sont historiques.

## Candidate 1.1.0-sor-blackjack — nouvelle présentation et blackjack

- [ZIP Déployable : HTML à la racine](livraison/1.1.0-sor-blackjack/JEUX-CLANDESTIN-SOR_1.1.0-sor-blackjack_Deployable.zip?raw=true)
- [ZIP Sources et tests](livraison/1.1.0-sor-blackjack/JEUX-CLANDESTIN-SOR_1.1.0-sor-blackjack_Sources.zip?raw=true)
- [Règles, changements et limites](app/BLACKJACK-1.1.0.md)
- [Validation blackjack et poker](livraison/1.1.0-sor-blackjack/VALIDATION_BLACKJACK.json)

Accueil noir/argent plus lisible, accès direct aux deux jeux, blackjack contre le croupier avec solde partagé et reprise de main. Les comptes, l’administration et les corrections de connexion sont conservés. Mises et règlements transactionnels, demandes répétées sans double débit, résultats calculés côté serveur. Les tables D1 du blackjack sont ajoutées automatiquement ; aucune base existante n’est réinitialisée. Aucune production déployée. Tests sur bases locales jetables et Chromium aux largeurs 320/390/1366 px ; aucun appareil physique ni FiveM réel testé. **Les sections suivantes décrivent les versions historiques.**

## Version 1.0.2-sor-connexion — formulaires réactifs

- [ZIP Déployable corrigé des jeux](livraison/1.0.2-sor-connexion/JEUX-CLANDESTIN-SOR_1.0.2-sor-connexion_Deployable.zip?raw=true)
- [ZIP Sources et tests](livraison/1.0.2-sor-connexion/JEUX-CLANDESTIN-SOR_1.0.2-sor-connexion_Sources.zip?raw=true)
- [Correctif et limites des tests](app/CONNEXION-1.0.2.md)
- [Validation des formulaires](livraison/1.0.2-sor-connexion/VALIDATION_CONNEXION.json)

Les messages de refus apparaissent dans la fenêtre de connexion/inscription, au lieu de rester cachés derrière elle. La validation des champs est visible, l'envoi indique sa progression, les doubles demandes sont évitées et les contrôles se réactivent après erreur ou expiration du délai. L'inscription et la connexion sont testées sur workerd/D1 locale en 320/390/1366 px. Le Worker et les règles de comptes de la 1.0.1 sont inchangés ; SOR-VARG et les anciens comptes restent conservés. Aucun déploiement ni changement de données réelles. Les versions suivantes ci-dessous sont historiques.

## Version 1.0.1-sor-admin — SOR-VARG

- [ZIP Déployable des jeux avec l'accès SOR-VARG](livraison/1.0.1-sor-admin/JEUX-CLANDESTIN-SOR_1.0.1-sor-admin_Deployable.zip?raw=true)
- [ZIP Sources et tests](livraison/1.0.1-sor-admin/JEUX-CLANDESTIN-SOR_1.0.1-sor-admin_Sources.zip?raw=true)
- [Configuration de SOR-VARG](app/ADMIN-SOR-VARG.md)
- [Validation locale](livraison/1.0.1-sor-admin/VALIDATION_ADMIN.json)

Le vrai poker fourni est conservé. Le nom **SOR-VARG** est prévu dans la console et réservé à l'inscription publique. Son compte administrateur s'initialise à la première connexion après configuration du secret Cloudflare **`ADMIN_BOOTSTRAP_PASSWORD`**. Aucun mot de passe en clair n'est publié ; aucune base réelle, aucun secret distant et aucun déploiement n'ont été modifiés.

Worker **4.1.1**, schéma et règles des parties inchangés. Les comptes existants conservent leurs droits et mots de passe. Un compte joueur déjà nommé SOR-VARG n'est jamais promu automatiquement. Voir les instructions ci-dessus pour ce cas.

La commande de vérification comprend désormais `node tests/test_admin_bootstrap.mjs`, en plus des huit tests Python du générateur. Les parcours navigateur utilisent une base D1 locale et un secret fictif aléatoire, sans téléphone physique ni FiveM réel. Les sections suivantes décrivent la livraison précédente.

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
