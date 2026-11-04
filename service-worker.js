'use strict';

// My Overtime: open the app first; fill caches quietly as resources are used.
const CACHE_PREFIX = 'my-overtime-app-';
const CACHE_VERSION = 'v21';
const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v5`;
const APP_SHELL = [
  new URL('./index.html', self.registration.scope).href,
  new URL('./manifest.json', self.registration.scope).href
];
const EXTERNAL_LIBRARIES = [
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-storage-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Installation must never download the whole app or libraries before opening.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && !keep.has(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function updateInBackground(request, cacheName, cacheKey) {
  try {
    const response = await fetch(request, {cache:'no-store'});
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(cacheKey || request, response.clone());
    }
  } catch (_) { /* offline or slow connection: keep the existing cached copy */ }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isLibrary = EXTERNAL_LIBRARIES.includes(url.href);
  if (!sameOrigin && !isLibrary) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const shell = APP_SHELL[0];
      const cached = await cache.match(request) || await cache.match(shell);
      // Cached app is returned immediately; network refresh happens after response.
      if (cached) {
        event.waitUntil(updateInBackground(request, STATIC_CACHE, shell));
        return cached;
      }
      // First-ever visit has no local copy, so fetch only the requested page.
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) event.waitUntil(cache.put(shell, fresh.clone()));
        return fresh;
      } catch (e) {
        return await cache.match(shell) || Response.error();
      }
    })());
    return;
  }

  if (isLibrary) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) {
        event.waitUntil(updateInBackground(request, STATIC_CACHE, request));
        return cached;
      }
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) event.waitUntil(cache.put(request, fresh.clone()));
        return fresh;
      } catch (_) { return Response.error(); }
    })());
    return;
  }

  // Other same-origin files are cached only when the app actually requests them.
  event.respondWith((async () => {
    const runtime = await caches.open(RUNTIME_CACHE);
    const cached = await runtime.match(request);
    if (cached) {
      event.waitUntil(updateInBackground(request, RUNTIME_CACHE, request));
      return cached;
    }
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok && fresh.type === 'basic') event.waitUntil(runtime.put(request, fresh.clone()));
      return fresh;
    } catch (e) {
      return await runtime.match(request) || Response.error();
    }
  })());
});
