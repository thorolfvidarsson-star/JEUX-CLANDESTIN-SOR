# Cloudflare Pages

Fichiers prêts à installer, préparés par `python3 tools/build.py` depuis `app/`.
Le ZIP Déployable contient l'interface, le visuel et `_worker.js` à la racine.
Configurer le binding D1 `DB` dans Cloudflare Pages. Le code n'inclut aucune base
ni aucun secret de production. Une simple ouverture du HTML ou GitHub Pages
ne suffit pas pour exécuter l'API et les parties multijoueurs.
