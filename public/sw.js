// Minimal service worker: makes Plagohive installable and keeps the app shell available on flaky networks.
// API calls are never cached (always fresh); static assets are served cache-first.
const CACHE = "plagohive-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/Plagohive.svg", "/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;           // API and third parties: network only
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));                    // offline: show the app shell
    return;
  }
  if (/\.(js|css|svg|png|jpg|webp|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
    })));
  }
});
