> Version actuelle : voir [BLACKJACK-1.1.0.md](BLACKJACK-1.1.0.md). Les notes ci-dessous décrivent la base poker historique.

# Poker SOR — Worker v4.1.1 · administrateur SOR-VARG

Site statique + API Cloudflare Pages (mode avancé, `_worker.js`) + base D1.
Jetons virtuels uniquement.

## Contenu du ZIP

Le ZIP contient les fichiers **à la racine** : `index.html`, `_worker.js`, `style.css`, `game.html`, etc.
Déployez le contenu du ZIP tel quel à la racine du projet Pages (ne déposez pas le dossier lui-même).

## Déploiement

1. Décompressez le ZIP.
2. Cloudflare Pages → votre projet → déployez le contenu à la racine (glisser-déposer ou Git).
3. Vérifiez que le binding D1 `DB` pointe vers `cloudpoker-db` (inchangé par rapport à v3.x).
4. Pour initialiser **SOR-VARG**, définir le secret `ADMIN_BOOTSTRAP_PASSWORD` dans Cloudflare, puis se connecter avec ce nom et la valeur choisie. Le nom est déjà prévu par défaut ; une variable facultative `ADMIN_BOOTSTRAP_USERNAME` permet de le personnaliser. Les comptes administrateurs déjà enregistrés restent inchangés. Voir `ADMIN-SOR-VARG.md`.
5. Contrôle : ouvrez `/api/health`. La réponse doit contenir `"version":"4.1.1"`. Le chargement des tables vérifie en plus la liaison D1.

## Migration depuis v3.x

- Aucune colonne existante n'est modifiée. Le Worker ajoute seulement la table `login_throttle`
  et un index sur `table_seats` (création automatique au premier appel).
- Les mains restées bloquées par l'ancienne version sont réparées automatiquement à la prochaine
  lecture de la table, et les mises engagées sont rendues par le moteur selon les règles normales.
- Le réglage « Mise minimale de la table » devient la **petite blinde** (la grosse blinde vaut le double).
  La valeur existante (10 par défaut) donne donc les mêmes blindes 10/20 qu'avant.

## Changements de comportement à connaître

- Mode solo supprimé. Son tirage de cartes était volontairement biaisé en faveur de la maison,
  alors que l'interface affirmait le contraire. Il n'est pas réintroduit.
- Un joueur sans jetons ne peut plus prendre une place ; il est exclu de la distribution. Un joueur qui perd tous ses jetons libère sa place en fin de main.
- Mot de passe : 6 caractères minimum à la création et au changement (la connexion accepte les anciens).
- Photo de profil : lien `https://` obligatoire.
- Le lobby n'affiche plus les pseudonymes des joueurs assis, seulement leur nombre.
- Modification du solde d'un joueur assis : refusée tant qu'il est à une table.
- Connexion : 8 échecs consécutifs sur un même nom bloquent les tentatives pendant 15 minutes.
- En-têtes de sécurité (CSP, `X-Frame-Options`, etc.) ajoutés à toutes les réponses. Aucun script inline.

## Règles de jeu, résumé technique

- Délai par tour : 35 secondes, contrôlé par le serveur. Au-delà : check si rien à suivre, sinon coucher.
  Le joueur est retiré de la table à la fin de la main, sauf action volontaire avant cette fin.
- Pots annexes : chaque joueur ne peut gagner que la part du pot qu'il a couverte.
- Relance minimale : mise actuelle + dernière relance (au minimum la grosse blinde). Tapis autorisé même en dessous.
- Table inactive 10 minutes : mises rendues puis table vidée.

## Tests réalisés (voir NOTES.md)

Tests automatisés exécutés contre le Worker compilé et une base D1 simulée sur SQLite
(node:sqlite). Ils ne remplacent pas un test sur Cloudflare D1 réel ni un test navigateur.

## Limites connues

- Non testé : rendu visuel sur appareils réels, comportement sur D1 de production, latence.
- La refonte visuelle complète (charte, animations, table mobile) n'a PAS été réalisée dans la 4.1.0 : seuls le focus visible et les zones tactiles ont été ajoutés.
- Rejeu de partie et historique des mains : non implémentés.

## Prérequis

Compte Cloudflare, projet Pages en mode avancé (`_worker.js`), base D1 `cloudpoker-db` liée au binding `DB`.
Dans `wrangler.toml`, `database_id` est un espace réservé : renseignez le vrai identifiant avant tout usage avec Wrangler.
Aucun secret n'est présent dans le ZIP.

## Nouveautés 4.1.0

- Service worker : réseau d'abord (plus de page neuve avec d'anciens scripts), cache `black-woods-v4.1.0`, pages admin incluses.
- Scripts et styles référencés avec `?v=4.1.0` ; `no-cache` sur les pages, `sw.js` et le manifeste.
- Jeu : une action à la fois (anti double envoi), resynchronisation avec le serveur après une erreur et au retour sur l'onglet.
- `solo.html` : page « mode solo fermé » (aucune route solo côté API).
- Focus clavier visible, zones tactiles de 44 px sur écrans tactiles.

## Contrôles après déploiement

1. `/api/health` renvoie `"version":"4.1.0"`.
2. Ouvrez `/`, `/tables.html`, `/rules.html`, `/solo.html`, `/admin.html` ; une table inexistante (`/game.html?id=99`) doit afficher une erreur claire.
3. Dans le navigateur, rechargez deux fois : la console doit montrer `style.css?v=4.1.0` et `game.js?v=4.1.0`.
4. Connectez-vous, rejoignez une table, jouez une main à deux comptes ; vérifiez les soldes avant/après.

## Diagnostic

- Erreur 500 « liaison ASSETS absente » : le projet n'est pas en mode avancé.
- Erreurs d'API : tableau de bord Cloudflare → Workers & Pages → Logs en temps réel.
- Ancienne interface persistante : Application → Service workers → Unregister, puis rechargez.
