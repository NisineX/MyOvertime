'use strict';

const CACHE_PREFIX = 'my-overtime-app-';
const CACHE_VERSION = 'v18';
const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v3`;

const APP_SHELL = [
  new URL('./index.html', self.registration.scope).href,
  new URL('./manifest.json', self.registration.scope).href
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(APP_SHELL.map(async url => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
      } catch (_) {
        // Keep installation usable when the network is unavailable.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) &&
                       key !== STATIC_CACHE &&
                       key !== RUNTIME_CACHE)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    for (const client of windows) {
      client.postMessage({ type: 'MY_OVERTIME_UPDATED' });
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'MY_OVERTIME_SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const shellUrl = new URL('./index.html', self.registration.scope).href;
      const cached = await cache.match(request) || await cache.match(shellUrl);

      const refresh = fetch(request).then(async response => {
        if (response && response.ok) {
          await cache.put(shellUrl, response.clone());
        }
        return response;
      }).catch(() => null);

      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return (await refresh) || Response.error();
    })());
    return;
  }

  event.respondWith((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    const cached = await staticCache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        const runtime = await caches.open(RUNTIME_CACHE);
        event.waitUntil(runtime.put(request, response.clone()));
      }
      return response;
    } catch (error) {
      const runtime = await caches.open(RUNTIME_CACHE);
      const fallback = await runtime.match(request);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
