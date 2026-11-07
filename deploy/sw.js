// Service worker Sons of Reaper — réseau d'abord pour les ressources statiques, cache en secours. Jamais /api/.
const CACHE = "sor-v1.1.1";
const CORE = ["./club-heading.woff", "./FONT-LICENSE.txt", "./blackjack.html", "./blackjack.js", "./club-ui.css", "./", "./index.html", "./tables.html", "./rules.html", "./game.html", "./admin.html", "./solo.html", "./style.css", "./sor-theme.css", "./sons-of-reaper.png", "./app.js", "./game.js", "./tables.js", "./admin.js", "./sw-register.js", "./manifest.webmanifest"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith("black-woods-") || k.startsWith("sor-")) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
});
