const CACHE = "wildz-shell-v1";
const SHELL = ["/", "/brand/wildz-mark.svg", "/brand/wildz-wordmark.svg", "/icons/icon-192.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", (event) => {
  const { request } = event; const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(request).then((response) => { if (response.ok && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/"))) { const clone = response.clone(); void caches.open(CACHE).then((cache) => cache.put(request, clone)); } return response; }).catch(async () => { const cached = await caches.match(request); if (cached) return cached; if (request.mode === "navigate") { const shell = await caches.match("/"); if (shell) return shell; } return Response.error(); }));
});
