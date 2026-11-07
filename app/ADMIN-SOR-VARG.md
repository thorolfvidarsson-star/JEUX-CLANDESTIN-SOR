# Accès administrateur SOR-VARG — 1.0.1-sor-admin

Le nom proposé dans la console est **SOR-VARG**. Le compte est initialisé à la première connexion avec le secret du projet Cloudflare ; aucun mot de passe n'est incorporé dans le ZIP ou le dépôt.

## Configuration par le propriétaire du projet

1. Conserver la liaison D1 **`DB`** vers la base du poker.
2. Dans les paramètres du projet Cloudflare Pages, rubrique Variables et secrets, ajouter un **secret** nommé **`ADMIN_BOOTSTRAP_PASSWORD`** avec le mot de passe choisi pour ce compte. Ne pas écrire sa valeur dans GitHub.
3. Installer le ZIP Déployable `1.0.1-sor-admin`, qui contient les jeux et `index.html` à la racine. Aucun déploiement n'est effectué par cette livraison.
4. Ouvrir `/admin.html`, saisir **SOR-VARG** et le mot de passe défini dans le secret, puis se connecter.

Si ce nom n'existe pas encore, cette première connexion crée un administrateur avec zéro jeton et un mot de passe haché et salé. Le nom peut être configuré avec la variable facultative `ADMIN_BOOTSTRAP_USERNAME` ; sa valeur par défaut est déjà `SOR-VARG`.

Les comptes administrateurs existants, notamment `manager`, continuent à utiliser leur mot de passe enregistré. Le secret d'initialisation ne remplace jamais le mot de passe d'un administrateur existant. Après un changement de mot de passe depuis le profil, le nouveau mot de passe reste celui de la connexion.

L'inscription publique et le changement de nom d'un joueur ne peuvent pas utiliser les noms réservés. Si un compte joueur utilise déjà le nom choisi pour l'administrateur, l'initialisation est refusée avec une erreur explicite : ce joueur n'est ni promu, ni écrasé, ni supprimé. Ce cas doit être traité séparément par l'administration existante.

Les permissions existantes restent identiques : le compte administrateur gère le club et ne prend pas place comme joueur. Les tables, jetons et comptes préexistants restent conservés ; aucun schéma D1 n'est modifié.

## Vérifications

Tests de l'initialisation, du nom réservé, des droits, des collisions et du changement de mot de passe avec `node tests/test_admin_bootstrap.mjs`. Test de la console sur workerd/D1 **locale jetable** et Chromium : `SOR_WRANGLER_BIN=chemin/vers/wrangler python3 tests/smoke_admin_local.py`.

Les tests utilisent un secret fictif aléatoire, aucune valeur réelle fournie par l'utilisateur. Aucun compte de production n'a été créé et aucun secret Cloudflare réel n'a été configuré pendant le développement.
