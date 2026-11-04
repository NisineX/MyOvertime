const CACHE_NAME = 'my-overtime-shell-v1';
const SHELL_FILES = ['./', './index.html', './manifest.json'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Heavy media is fetched only when the app requests it, then cached for later visits.
  if (/\.(mp4|mp3|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if (response.ok && request.mode === 'navigate') caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone()));
    return response;
  }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html'))));
});
