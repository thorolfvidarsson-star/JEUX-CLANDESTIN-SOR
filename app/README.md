> Version actuelle : [ROULETTE-1.2.0.md](ROULETTE-1.2.0.md), ajout de la roulette noir/blanc au thème biker.

> Présentation actuelle : [BIKER-1.1.1.md](BIKER-1.1.1.md). Moteur et règles conservés depuis 1.1.0.

> Version actuelle : voir [BLACKJACK-1.1.0.md](BLACKJACK-1.1.0.md). Les notes ci-dessous décrivent la base poker historique.

# Sources du poker Sons of Reaper

Poker Texas Hold’em multijoueur provenant du ZIP Black Woods confié par l'utilisateur,
adapté à Sons of Reaper / Paleto Bay. Interface noire et argent, rouge uniquement
dans les yeux de la faucheuse. Aucune boutique ni paiement.

Les comptes, soldes virtuels, tables et administration du moteur 4.1.0 sont conservés.
Le mode solo est fermé comme dans la source fournie ; aucun autre jeu n'a été ajouté.
Le visuel de la faucheuse est une recréation inspirée des références fournies.

`_worker.js` contient le moteur et l'API Cloudflare Pages. `schema.sql` documente D1.
`wrangler.toml` permet le développement local ; son identifiant D1 est fictif.
La charte principale est dans `sor-theme.css`, après `style.css`.

Depuis ce dossier, avec Node.js 24 et Wrangler 4 :

    npx wrangler pages dev . --ip 127.0.0.1 --port 8788

La base locale est distincte de la production. Vérifier `/api/health`, puis le lobby.
Voir README-SOR.md et README-DEPLOIEMENT.md (historique du moteur d'origine).
