/* My Overtime — delayed offline cache.
   This worker is registered only after Setup is completed. */
const CACHE_NAME = "my-overtime-shell-v1";
const APP_SHELL = "./";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("my-overtime-shell-") && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (!event.data || event.data.type !== "MY_OVERTIME_PREPARE_OFFLINE") return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const target = new URL(event.data.url || APP_SHELL, self.registration.scope).href;
    try {
      const response = await fetch(target, { cache: "reload", credentials: "same-origin" });
      if (response.ok) await cache.put(target, response.clone());
      const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      clientsList.forEach(client => client.postMessage({ type: "MY_OVERTIME_OFFLINE_READY", ok: response.ok }));
    } catch (error) {
      const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      clientsList.forEach(client => client.postMessage({ type: "MY_OVERTIME_OFFLINE_READY", ok: false }));
    }
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // HTML navigation: always try GitHub Pages first so new versions appear;
  // use the last successfully cached app when offline or the network is weak.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const copy = response.clone();
          cache.put(request, copy).catch(() => {});
          cache.put(new URL(APP_SHELL, self.registration.scope).href, copy.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        return (await cache.match(request)) ||
               (await cache.match(new URL(APP_SHELL, self.registration.scope).href)) ||
               new Response("My Overtime is not cached yet. Connect to the internet once after completing Setup.", {
                 status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
               });
      }
    })());
    return;
  }

  // Cache only same-origin app resources after Setup; do not cache Firebase/CDN assets.
  if (url.pathname.startsWith(new URL(self.registration.scope).pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        fetch(request).then(r => { if (r.ok) cache.put(request, r.clone()); }).catch(() => {});
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch (error) {
        throw error;
      }
    })());
  }
});
