# Candidate 1.1.1-sor-biker

Base : dernière version des jeux sur GitHub, `ccc6f5c6c66c985aada5437935c135869563e2ee` (1.1.0-sor-blackjack). Aucun retour à une ancienne RC.

## Ambiance clubhouse

- Accueil « LE CLUB. LA ROUTE. LE JEU. », gros lettrage et emblème Sons of Reaper présenté comme un patch cousu, avec écusson MC.
- Cuir noir texturé en CSS, contours cousus, plaques rivetées et boutons en acier patiné. Noir et argent ; les yeux rouges du visuel d'origine restent présents.
- Nouvelle présentation appliquée au lobby, aux six tables, au blackjack, aux fenêtres de compte et à l'administration. Tables de jeu et règles conservent leurs commandes.
- Typographie DejaVu Sans Condensed Bold embarquée en WOFF (environ 17 ko), sans requête vers un fournisseur de polices. Licence incluse dans `FONT-LICENSE.txt`. Aucun nouveau framework, aucune bibliothèque d'exécution ajoutée.
- Petits écrans : patch et titre disposés côte à côte, choix des jeux empilés, boutons tactiles accessibles, absence de défilement horizontal aux largeurs vérifiées. Éléments décoratifs sans interception des clics.
- Ressources marquées 1.1.1 et cache statique `sor-v1.1.1`. Le numéro est visible en bas du lobby et du blackjack. Les API restent exclues du service worker.

## Fonctionnement conservé

Le Worker, le schéma SQL et les six scripts des comptes/jeux sont identiques octet pour octet à 1.1.0. Poker, blackjack, mises, gains, reprise de main, historique, accès SOR-VARG et permissions conservent les mêmes règles. Aucune modification d'une API ni de la base requise spécifiquement par ce thème.

Pour un passage depuis une version plus ancienne que 1.1.0, l'ajout du blackjack et ses tables D1 restent ceux documentés dans [BLACKJACK-1.1.0.md](BLACKJACK-1.1.0.md). Conserver la liaison `DB` vers la base dédiée aux jeux et les secrets Cloudflare existants. Ne pas remplacer la base.

## Vérifications exécutées

- Huit tests du générateur de ZIP, tests Node de l'administration et tests Node du blackjack réussis.
- Chromium avec le vrai runtime local Cloudflare workerd/D1 et des données fictives jetables : largeurs 320, 390 et 1366 px.
- Lobby, patch, police embarquée, six tables, navigation, chargement des nouveaux fichiers dans le cache statique et exclusion des API.
- Création de compte, connexion, annulation, erreurs visibles dans le formulaire, reprise après refus, timeout et doubles envois.
- Administration SOR-VARG en PC/mobile, compte réservé et gestion seule.
- Blackjack : carte, rester, double, solde partagé, rechargement pendant/après la main, réponse perdue après une mise puis reprise sans double débit.
- Poker : deux joueurs locaux, blindes, affichage des cartes privées, action de se coucher et règlement ; interface vérifiée en 390 et 1366 px.

Captures et résultats détaillés dans les fichiers `VALIDATION_*.json` de cette livraison. Les interactions mobiles sont simulées dans Chromium : aucun téléphone physique ni FiveM réel testé. Aucune base ni production Cloudflare modifiée.

## Livraison

`python3 tools/build.py` prépare 22 fichiers. Le ZIP Déployable contient `index.html`, `_worker.js`, pages, scripts, styles, police, licence et visuel à la racine. Le ZIP Sources contient le code, la documentation et les tests. Les archives antérieures restent conservées sur GitHub.
