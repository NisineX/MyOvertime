/* My Overtime offline cache + update delivery */
const CACHE_NAME = 'my-overtime-shell-v3';
const CORE_FILES = ['./', './index.html', './manifest.json'];
const APP_ASSETS = [
  "./asset-28a5b77b1def.mp3",
  "./asset-2b7d30970ba7.png",
  "./asset-5036a83c6128.mp3",
  "./asset-5315f42ce23a.mp3",
  "./asset-541650472184.mp3",
  "./asset-548c8c4d466a.png",
  "./asset-6ee1254a502c.png",
  "./asset-7578dedf48ce.jpg",
  "./asset-856eb2e7086b.mp3",
  "./asset-8cb123858189.mp3",
  "./asset-8cb123858189.mp4",
  "./asset-8e218c4001d4.png",
  "./asset-a5a55f7e8412.mp3",
  "./asset-ae13c7d46715.mp3",
  "./asset-b518aba4312d.png",
  "./asset-b5a4350c6bed.mp3",
  "./asset-c6523cdf970f.png",
  "./asset-ed693ea86330.png",
  "./asset-f0b37a529e9e.png",
  "./asset-f0b8fe0c4be8.jpg",
  "./asset-f9fc8b070662.png"
];
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-storage-compat.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_FILES);
    // Pre-cache app images/audio/fonts after the HTML shell is safely stored.
    await Promise.allSettled(APP_ASSETS.filter(url => !/\\.mp4(?:$|\\?)/i.test(url)).map(async url => {
      const response = await fetch(url, {cache:'reload'});
      if (response.ok) await cache.put(url, response);
    }));
    // Cache the external libraries needed to start the app for offline reopening.
    await Promise.allSettled(CDN_ASSETS.map(async url => {
      const response = await fetch(url, {mode:'no-cors', cache:'reload'});
      if (response && (response.ok || response.type === 'opaque')) await cache.put(url, response);
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('my-overtime-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache Firebase/database/API traffic: it must remain live when online.
  if (/firebaseio\\.com$|googleapis\\.com$|firebasestorage\\.googleapis\\.com$/.test(url.hostname)) return;

  const isStatic = /\\.(html|js|css|json|png|jpe?g|webp|svg|gif|mp3|woff2?|ttf)$/i.test(url.pathname);
  const isApprovedCDN = ['cdnjs.cloudflare.com','www.gstatic.com'].includes(url.hostname);

  if (url.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (error) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  if ((url.origin === self.location.origin && isStatic) || (isApprovedCDN && isStatic)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        // Refresh quietly in the background so the next visit has the newest asset.
        fetch(request).then(response => {
          if (response && (response.ok || response.type === 'opaque')) cache.put(request, response);
        }).catch(() => {});
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        return cached || Response.error();
      }
    })());
  }
});
