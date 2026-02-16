const CACHE_NAME = "job-costing-pwa-v33";
const URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./apple-touch-icon.svg",
  "./CLOUD_SYNC.md"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept non-GET (e.g., cloud sync POST).
  if (req.method !== "GET") {
    event.respondWith(fetch(req));
    return;
  }

  // Only cache-first for same-origin app assets.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
    return;
  }

  // For cross-origin GET requests, just fetch from network.
  event.respondWith(fetch(req));
});
