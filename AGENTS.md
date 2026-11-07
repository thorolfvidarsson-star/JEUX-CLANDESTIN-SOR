# Consignes de travail

Le dépôt appartient à JEUX-CLANDESTIN-SOR. Il contient la configuration de livraison et une page d'accueil HTML demandée par l'utilisateur. Les jeux complets restent à fournir.

- Examiner les derniers commits et les fichiers présents avant de modifier l'application. Lire `README.md` et `delivery.json`.
- Ajouter les sources de l'application lorsqu'elles sont fournies ; ne pas inventer une application ou reprendre le code privé d'un autre projet pour remplir le dépôt.
- Préserver les règles métier, permissions et données des sources effectivement confiées par l'utilisateur.
- Exécuter les vérifications adaptées au changement et les tests du générateur avant une livraison : `python3 -m unittest discover -s tests -v`.
- Préparer la page d'accueil avec `python3 tools/build.py`, puis utiliser `python3 tools/package.py --version VERSION` pour les Sources et ajouter `--deployable` pour inclure la page installable. Adapter le processus quand les vraies sources des jeux seront fournies.
- Donner les ZIP vérifiés et leurs liens réels. Ne pas annoncer de Déployable lorsqu'il n'existe pas, ni présenter la configuration initiale comme une application fonctionnelle.
- Conserver les versions précédentes lors de l'ajout volontaire des livraisons dans GitHub ; utiliser un dossier de version distinct.
- Ne pas déployer ni modifier des données réelles sans autorisation explicite de l'utilisateur. Le workflow de ZIP est manuel et ne doit pas devenir un déploiement automatique lors d'un simple correctif.
- Ne pas inclure de secrets ou de bases réelles dans les archives. Ne pas contourner les exclusions du générateur pour publier de tels fichiers.
- Signaler les limites réelles des tests, notamment lorsqu'un téléphone ou FiveM n'a été que simulé.

Ces consignes organisent le travail dans le dépôt ; elles n'accordent aucun accès à GitHub et n'activent pas les outils d'une autre conversation.
