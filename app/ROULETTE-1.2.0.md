# Candidate 1.2.0-sor-roulette

Base GitHub : `b34994ac5ac8fdf43af12cdee1dcca4edaa6dcfa` (1.1.1-sor-biker). L'identité biker, le poker, le blackjack et les comptes sont conservés.

## Noir et blanc, conformément à la dernière demande

Roulette européenne à **un seul zéro**, 37 cases de 0 à 36. **Le blanc remplace le rouge habituel ; le noir reste noir.** Le zéro reste vert.

Numéros blancs : 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34 et 36. Les 18 autres numéros de 1 à 36 sont noirs. L'ordre de la roue est celui de la roulette européenne. Le numéro sous le repère correspond au résultat calculé par le serveur ; l'animation ne choisit aucun résultat.

## Mises et gains

| Mise | Gain net en cas de victoire | Retour avec mise gagnante |
| --- | --- | --- |
| Numéro plein, y compris 0 | 35:1 | 36 × la mise |
| Noir ou blanc | 1:1 | 2 × la mise |
| Pair/impair, 1–18/19–36 | 1:1 | 2 × la mise |
| Douzaine ou colonne | 2:1 | 3 × la mise |

Au zéro, toutes les mises extérieures perdent ; seul le numéro plein 0 gagne. Pas de partage, prison, cheval, carré ni transversale dans cette première table.

Jetons de 10, 50, 100, 500 ou 1 000. Chaque appui ajoute le jeton choisi. Plusieurs cases peuvent être jouées ensemble ; maximum total de 10 000 jetons par tirage. Annuler le dernier ajout, retirer une mise ou tout retirer n'envoie aucune requête API. La sélection ne débite rien : le bouton de lancement valide toutes les mises ensemble.

Le retour total et le résultat net sont distingués. Le solde est commun au poker et au blackjack. Dix derniers tirages personnels conservés, résultat et solde retrouvés après rechargement. Les comptes administrateurs restent réservés à la gestion. Quitter son siège de poker ou terminer sa main de blackjack avant une nouvelle mise de roulette.

## Serveur et sauvegarde

- Tirage uniforme côté Worker avec le générateur cryptographique existant, sans résultat ni gain accepté depuis le navigateur.
- Nouvelle table D1 additive `roulette_spins`, avec index de consultation par joueur et unicité joueur/identifiant de demande. Les tables existantes ne sont pas remplacées. Création automatique au premier appel après installation.
- Débit, paiement et historique dans une seule transaction D1. Solde suffisant exigé avant le tirage, même pour une mise qui pourrait gagner.
- La même demande rejouée renvoie le tirage déjà validé sans second débit ou crédit. Une même clé avec d'autres mises est refusée.
- Une réponse réseau perdue laisse une demande à reprendre, enregistrée localement pour le joueur. Les nouvelles mises restent bloquées jusqu'à confirmation ; la reprise reste possible si le joueur a entre-temps rejoint le poker.
- Les contrôles d'exclusion poker/blackjack et de solde sont vérifiés au moment de l'écriture, pour gérer les onglets concurrents.
- Aucun secret ni base livré. Conserver `DB` vers la base dédiée aux jeux et les secrets Cloudflare existants. Aucune base distante ni production modifiée pendant le développement.

## Présentation et livraison

Nouvelle page `roulette.html` et accès direct depuis le lobby/menu. Style cuir noir et acier de la 1.1.1, couleurs fonctionnelles noir/blanc/vert pour la roue et les mises. Le tapis des numéros peut se replier sur téléphone, avec des cases accessibles au doigt. La roue respecte le réglage de réduction des animations. Aucun framework ni chargement distant ajouté.

Le cache statique passe à `sor-v1.2.0`, sans cache des API. Version visible en bas de page. Le Déployable contient 25 fichiers à la racine, dont `index.html`, `roulette.html` et `_worker.js`. La production Cloudflare n'est pas déployée par cette livraison.

## Vérifications exécutées

- Tests Node du vrai moteur : tous les types de mise pour chacun des 37 résultats, zéro, 18 noirs/18 blancs, paiements et combinaisons.
- Worker avec SQLite jetable : accès, migration additive, solde insuffisant, historique privé, idempotence, requêtes simultanées, courses avec poker/blackjack et annulation intégrale d'une mise refusée.
- Chromium et vrai runtime local Cloudflare workerd/D1 en 320, 390 et 1366 px : navigation depuis le lobby, jetons, noir/blanc, annuler/retirer/vider, 37 mises numérotées, résultat de la roue, solde, rechargement et réponse réseau perdue suivie d'une reprise sans double débit.
- Parcours existants de connexion/inscription, administration, blackjack et poker rejoués. Huit tests du générateur réussis. ZIP relus et vérifiés octet pour octet.

Les interactions mobiles sont **simulées**, sans téléphone physique ni FiveM réel. Aucun test de latence ou de D1 en production. Voir `VALIDATION_*.json` dans la livraison et les scripts `tests/` pour reproduire les essais.
