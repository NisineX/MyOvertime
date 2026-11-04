'use strict';

const CACHE_PREFIX = 'my-overtime-app-';
const CACHE_VERSION = 'v20';
const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v4`;

const EXTERNAL_SHELL = [
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-storage-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];
const APP_SHELL = [new URL('./index.html', self.registration.scope).href,
                   new URL('./manifest.json', self.registration.scope).href];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(APP_SHELL.concat(EXTERNAL_SHELL).map(async url => {
      try {
        const response = await fetch(url, {cache:'reload'});
        if (response && (response.ok || response.type === 'opaque')) await cache.put(url, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== RUNTIME_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of windows) client.postMessage({type:'MY_OVERTIME_UPDATED'});
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'MY_OVERTIME_SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

async function fetchAndCacheNavigation(request, cache, shellUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(request, {signal:controller.signal, cache:'no-store'});
    clearTimeout(timeout);
    if (response && response.ok) {
      await cache.put(shellUrl, response.clone());
      return response;
    }
  } catch (_) { clearTimeout(timeout); }
  return await cache.match(request) || await cache.match(shellUrl) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isExternalAppLibrary = EXTERNAL_SHELL.includes(url.href);
  if (!sameOrigin && !isExternalAppLibrary) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const shellUrl = new URL('./index.html', self.registration.scope).href;
      return await fetchAndCacheNavigation(request, cache, shellUrl);
    })());
    return;
  }

  if (isExternalAppLibrary) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) {
        fetch(request).then(r => {if(r && (r.ok || r.type==='opaque')) cache.put(request,r.clone());}).catch(()=>{});
        return cached;
      }
      try { const r=await fetch(request); if(r && (r.ok || r.type==='opaque')) await cache.put(request,r.clone()); return r; }
      catch (_) { return Response.error(); }
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
