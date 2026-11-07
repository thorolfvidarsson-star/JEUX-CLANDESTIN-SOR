# Candidate 1.1.0-sor-blackjack

Base : dernière candidate jeux `1.0.2-sor-connexion` (commit `5a06cae684838aad93ead93adbd9f8b6356275d0`). Worker 4.2.0. Ce projet est le club de jeux ; il ne modifie pas SOR PB Gestion.

## Interface

Accueil plus aéré, typographie ivoire, identité Sons of Reaper / Paleto Bay et faucheuse conservées. Choix direct entre poker et blackjack. Mise et actions du blackjack adaptées au téléphone. Styles locaux, sans police distante ni nouvelle bibliothèque. Les six tables, profils, formulaires corrigés et console d'administration restent disponibles. Nouveau cache statique `sor-v1.1.0` ; les API restent exclues du cache.

## Blackjack

- Partie individuelle face au croupier. Même compte joueur et même solde de jetons virtuels que le poker.
- 6 jeux mélangés par le serveur à chaque main, tirage cryptographique sans pondération. Aucun résultat calculé par le navigateur.
- Mise paire de 10 à 10 000 jetons. Cela permet le paiement exact du blackjack naturel à 3:2, sans fraction de jeton.
- Victoire ordinaire : gain 1:1 ; égalité : restitution de la mise ; blackjack naturel : gain 3:2. Le résultat affiche le gain net et le solde tient déjà compte du règlement.
- As 1 ou 11. Le croupier reste sur tous les 17, même avec un as compté 11. Blackjack naturel réglé immédiatement ; 21 après tirage termine automatiquement le tour.
- Carte, rester, doubler. Le double engage une mise identique, donne une seule carte puis termine le tour. Uniquement sur les deux premières cartes, si le solde suffit. Pas de séparation ni d'assurance dans cette version.
- Main reprise après rechargement. Huit dernières mains terminées visibles, historique limité au joueur connecté.
- Carte cachée du croupier et pioche conservées côté serveur jusqu'au règlement. La pioche n'est jamais renvoyée.
- Une partie à la fois : quitter son siège de poker avant de jouer au blackjack ; terminer sa main de blackjack avant de rejoindre le poker.
- Le compte administrateur conserve son rôle de gestion uniquement. Aucune promotion de compte ni changement des mots de passe existants.

## Comptabilité et données

Deux nouvelles tables D1 `blackjack_hands` et `blackjack_events`, un index d'unicité et deux triggers d'exclusion poker/blackjack sont créés automatiquement au premier appel API après installation. Aucune suppression ni réinitialisation des tables existantes. Le schéma fourni est actualisé pour une installation neuve ; ne pas remplacer une base existante.

Mises, état de la main et règlements sont écrits dans une même transaction D1. Révision attendue et identifiant de demande empêchent les doubles débits/paiements et les décisions concurrentes. Une réponse réseau perdue peut être reprise avec le même identifiant, même après rechargement. Aucune nouvelle mise n'est possible tant que cette demande reste à confirmer dans l'interface. Les modifications/suppressions de comptes par un administrateur sont refusées pendant une main active, y compris lors d'un lancement concurrent.

Aucune base ni variable distante modifiée pendant ce développement. Le ZIP n'inclut aucun secret. Conserver la liaison Cloudflare `DB` vers la base dédiée aux jeux et le secret `ADMIN_BOOTSTRAP_PASSWORD` déjà configurés. Les paramètres Cloudflare prennent effet lors d'un nouveau déploiement, pas par la seule sauvegarde du réglage. Aucun déploiement en production effectué ici.

## Vérifications reproductibles

```sh
python3 tools/build.py
python3 -m unittest discover -s tests -v
node --disable-warning=ExperimentalWarning tests/test_admin_bootstrap.mjs
node --disable-warning=ExperimentalWarning tests/test_blackjack.mjs
# Nécessitent Wrangler et Chromium/Playwright installés :
python3 tests/smoke_auth_local.py
python3 tests/smoke_admin_local.py
python3 tests/smoke_blackjack_local.py
```

Les tests Node utilisent le vrai Worker et une base SQLite jetable. Les parcours navigateur utilisent Chromium et le vrai runtime local Cloudflare workerd/D1, sans service de production. `SOR_WRANGLER_BIN` et `SOR_CHROMIUM` peuvent désigner les exécutables disponibles.

Résultats détaillés dans les fichiers `VALIDATION_*.json` de la livraison : as et soft 17, paiements 3:2 et 1:1, égalités/pertes, double, absence de fuite de la pioche, idempotence, concurrence, isolation entre joueurs, exclusion poker/blackjack, contrôle administrateur, formulaires et reprise réseau. Le poker est aussi vérifié avec deux joueurs locaux, cartes privées, blindes, action de se coucher et règlement.

Largeurs simulées : 320, 390 et 1366 px, interactions tactiles simulées. Aucun téléphone Android physique ni FiveM réel disponible. La latence et D1 de production ne sont pas testées. Les captures sont des preuves locales, pas un déploiement public.

## Livraison

Sources et Déployable sont générés après validation par `tools/package.py`. Le Déployable contient directement `index.html`, `_worker.js`, les autres pages et ressources à la racine du ZIP. Les archives des versions précédentes restent conservées sur GitHub et ne sont pas réembarquées dans les Sources.
