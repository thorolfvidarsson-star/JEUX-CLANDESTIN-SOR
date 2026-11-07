# Correctif 1.0.2-sor-connexion

Base : `1.0.1-sor-admin`, commit `2dbe7594f67a3b64714de6b33fca7cc9e6ade460`.

Le défaut reproduit concernait le formulaire public du lobby : une inscription valide réussissait en local, mais les réponses de refus (mauvais mot de passe, compte déjà enregistré) étaient affichées dans le lobby, derrière la fenêtre modale. Celle-ci restait ouverte sans montrer la raison du refus, donnant l'impression que le bouton ne fonctionnait pas.

## Corrections

- Les refus du serveur, les erreurs réseau et la validation des champs sont affichés dans la fenêtre active, près du bouton.
- Le bouton indique « Connexion en cours… » ou « Création en cours… ». Un seul envoi est permis pendant la demande.
- Un délai de 15 secondes évite de laisser le formulaire bloqué indéfiniment. Après un refus ou un délai dépassé, les contrôles sont de nouveau accessibles et les champs sont conservés pour corriger la saisie.
- La création d'un compte demande six caractères minimum pour le mot de passe, comme le serveur. La connexion continue d'accepter les mots de passe courts des comptes anciens.
- Fermer le formulaire n'envoie plus une demande d'inscription ou de connexion. Le changement de mode est un vrai bouton utilisable au clavier et au toucher.
- Si le compte est créé mais que la synchronisation de session échoue ensuite, le message l'indique et propose de passer en mode Connexion. Une réussite n'est plus annoncée à tort.
- Les ressources du formulaire et le cache statique passent à `sor-1.0.2` pour récupérer les fichiers corrigés après installation et rechargement de la page.

## Comptes et données

**SOR-VARG utilise le mode Connexion**, avec le secret `ADMIN_BOOTSTRAP_PASSWORD` prévu dans Cloudflare pour sa première initialisation. Le mode Créer un compte reste réservé aux nouveaux joueurs ; un nom d'administration y est refusé et le message indique désormais d'utiliser Connexion.

Le Worker, les API, les permissions, le schéma D1, les règles des parties et les comptes existants restent identiques à `1.0.1-sor-admin`. Le mot de passe réel n'est pas inclus dans les fichiers. Aucun déploiement, aucun secret distant et aucune donnée de production n'ont été modifiés.

Si la fenêtre indique que le service est indisponible, vérifier que le vrai ZIP Déployable a été installé avec `_worker.js` et que la liaison D1 `DB` est présente. Pour SOR-VARG, conserver le secret d'initialisation prévu dans `ADMIN-SOR-VARG.md`. Un correctif d'affichage ne crée pas ces liaisons à distance.

## Validation

- Reproduction des refus 401 et 409 invisibles dans la fenêtre avec l'ancienne version, après inscription valide réelle sur D1 locale.
- Tests Chromium en 320, 390 et 1366 px sur workerd et D1 locale : inscription par la touche Entrée, connexion, reconnexion après rechargement, compte existant, mauvais mot de passe, nom réservé, annulation d'un formulaire rempli sans création de compte et accès aux six tables.
- Simulations des erreurs réseau, API indisponible, réponse HTML à la place de l'API et synchronisation de session échouant après une inscription réussie. Le cas PC vérifie aussi l'expiration du délai, l'absence de double envoi et la reprise après expiration.
- Trois parcours SOR-VARG dans la console d'administration, tests Node du bootstrap et huit tests Python du générateur conservés.

Les comptes et mots de passe des tests sont fictifs. Les interactions tactiles sont simulées ; aucun Android physique, aucune intégration FiveM réelle et aucune partie multijoueur complète n'ont été testés. Le site de production n'a pas été inspecté dans ces tests.

Reproduction : `python3 tools/build.py`, `python3 -m unittest discover -s tests -v`, `node tests/test_admin_bootstrap.mjs`, puis `SOR_WRANGLER_BIN=chemin/vers/wrangler python3 tests/smoke_auth_local.py` et `python3 tests/smoke_admin_local.py` avec la même variable d'environnement.
