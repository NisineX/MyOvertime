/* My Overtime service worker
   Deliberately does not cache anything during first visit.
   The page registers this worker only after Setup is completed. */
'use strict';

const CACHE_NAME = 'my-overtime-app-v1';
const APP_ROOT = new URL('./', self.location.href);
const INDEX_URL = new URL('index.html', APP_ROOT).href;

self.addEventListener('install', event => {
  // No precache at install: user must finish Setup first.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function sameOrigin(url) {
  try { return new URL(url, self.location.href).origin === self.location.origin; }
  catch (_) { return false; }
}

async function cacheCurrentApp() {
  const cache = await caches.open(CACHE_NAME);
  const pageResponse = await fetch(INDEX_URL, {cache: 'no-store'});
  if (!pageResponse.ok) throw new Error('Could not download the app page');
  const pageText = await pageResponse.clone().text();
  if (!pageText.toLowerCase().includes('<html')) throw new Error('Invalid app page');
  await cache.put(INDEX_URL, pageResponse);

  // Cache same-origin resources referenced by the single-file app.
  const matches = [...pageText.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)];
  const urls = new Set();
  for (const m of matches) {
    try {
      const u = new URL(m[1], INDEX_URL);
      if (u.origin === self.location.origin &&
          !u.href.startsWith('data:') &&
          !u.href.startsWith('blob:') &&
          !u.href.includes('#')) urls.add(u.href);
    } catch (_) {}
  }

  await Promise.all([...urls].map(async url => {
    try {
      const response = await fetch(url, {cache: 'no-store'});
      if (response.ok && response.type !== 'opaque') await cache.put(url, response);
    } catch (_) { /* Keep going; one optional asset must not cancel offline setup. */ }
  }));
  return true;
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'MY_OVERTIME_PREPARE_OFFLINE') {
    const reply = event.ports && event.ports[0];
    event.waitUntil(cacheCurrentApp().then(
      () => reply && reply.postMessage({ok: true}),
      error => reply && reply.postMessage({ok: false, error: String(error)})
    ));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // App navigation: prefer live website; if offline, show the last saved HTML.
  if (request.mode === 'navigate' || url.href.split('?')[0] === INDEX_URL) {
    event.respondWith((async () => {
      try {
        const live = await fetch(request);
        if (live && live.ok) {
          const copy = live.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy)).catch(() => {});
        }
        return live;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        const saved = await cache.match(INDEX_URL);
        if (saved) return saved;
        return new Response(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><h3>My Overtime</h3><p>ইন্টারনেট সংযোগ নেই। প্রথম Setup সম্পন্ন করে একবার অনলাইনে Offline Download করুন।</p>',
          {headers: {'Content-Type': 'text/html; charset=utf-8'}, status: 503}
        );
      }
    })());
    return;
  }

  // Other same-origin files: cache first, then network and save a successful response.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (_) {
      return new Response('', {status: 504, statusText: 'Offline'});
    }
  })());
});
