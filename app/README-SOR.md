> Version actuelle : [ROULETTE-1.2.0.md](ROULETTE-1.2.0.md), ajout de la roulette noir/blanc au thème biker.

> Présentation actuelle : [BIKER-1.1.1.md](BIKER-1.1.1.md). Moteur et règles conservés depuis 1.1.0.

> Version actuelle : voir [BLACKJACK-1.1.0.md](BLACKJACK-1.1.0.md). Les notes ci-dessous décrivent la base poker historique.

# Sons of Reaper — Poker Club

Adaptation du ZIP Black Woods fourni : identité Sons of Reaper / Paleto Bay,
interface noire et argent. Seuls les yeux de la faucheuse sont rouges.
Le visuel est une recréation inspirée des références fournies.
Aucune boutique ni paiement dans cette version.

Le moteur de poker, les comptes et l'administration du ZIP sont conservés.
La refonte graphique est dans sor-theme.css, chargé après style.css.
Les pages utilisent le cache de ressources sor-1.0.0.
Les anciens logos Black Woods ne sont pas inclus dans le ZIP livré.

## Déploiement

Cloudflare Pages en mode avancé, avec _worker.js à la racine.
Conserver le binding D1 DB vers votre base existante. wrangler.toml contient
un identifiant de base fictif à remplacer avant un déploiement CLI.
Aucun identifiant réel de production n'a été fourni ni modifié.
Voir README-DEPLOIEMENT.md pour les détails historiques du moteur 4.1.0 ;
la charte et les noms qui y figurent décrivent la version d'origine.

## Développement local

Depuis le dossier du site, avec Node.js 24 et Wrangler 4 :

    npx wrangler pages dev . --ip 127.0.0.1 --port 8788

Wrangler utilise une base D1 locale distincte de la production.
Vérifier /api/health puis le chargement des six tables sur l'accueil.

## Vérifications effectuées

Compilation Worker et D1 locale : OK. API health : OK.
Accueil : six tables chargées ; menu et fenêtre de connexion : OK.
Pages tables, règles, administration et solo : ouvertes sans erreur JavaScript.
Rendu à 390 px : aucun débordement horizontal sur les pages contrôlées.
La syntaxe des sept fichiers JavaScript est valide.
Aucune partie multijoueur ni base D1 de production testée.
