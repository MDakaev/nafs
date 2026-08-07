/**
 * Service worker for Nafs PWA.
 * HTML/JS: network-first (so label/copy updates show on refresh).
 * Icons/manifest: cache-first with background refresh.
 */
const CACHE = "nafs-v17";
const PRECACHE = [
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/config.js",
  "./js/analytics.js",
  "./js/i18n.js",
  "./js/motivations.js",
  "./js/growing-tree/treeGenerator.js",
  "./js/growing-tree/treeRenderer.js",
  "./js/growing-tree/treeAnimation.js",
  "./js/tree.js",
  "./js/app.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

function isShellRequest(request) {
  const url = new URL(request.url);
  if (request.mode === "navigate") return true;
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/nafs")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: "NAFS_SW_UPDATED", cache: CACHE }));
        })
      )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (isShellRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
