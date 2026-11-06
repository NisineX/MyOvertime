/* My Overtime offline-first cache manager — v4
 * Cache shell + all declared app media; serve cached video byte ranges offline.
 */
const CACHE_NAME = 'my-overtime-shell-v4';
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
  "./asset-f9fc8b070662.png",
  './Banner.png',
  './logo.png'
];
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/12.2.1/firebase-storage-compat.js'
];
const STATIC_EXT = /\.(?:html|js|css|json|png|jpe?g|webp|svg|gif|mp3|mp4|woff2?|ttf)$/i;
const CDN_HOSTS = new Set(['cdnjs.cloudflare.com','www.gstatic.com']);

async function cacheOne(cache, url) {
  try {
    const response = await fetch(url, {cache:'reload'});
    if (response && (response.ok || response.type === 'opaque')) {
      await cache.put(url, response.clone());
      return true;
    }
  } catch (error) { /* keep going; a missing optional asset must not break install */ }
  return false;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Install the shell individually: one missing optional path must not cancel all caching.
    for (const file of CORE_FILES) await cacheOne(cache, file);
    // Cache images, sounds AND the splash video before the worker finishes installing.
    await Promise.allSettled(APP_ASSETS.map(url => cacheOne(cache, url)));
    await Promise.allSettled(CDN_ASSETS.map(url => cacheOne(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('my-overtime-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function rangeResponse(response, rangeHeader) {
  return response.arrayBuffer().then(buffer => {
    const size = buffer.byteLength;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader || '');
    if (!match || (!match[1] && !match[2])) return new Response(null, {status:416,headers:{'Content-Range':`bytes */${size}`}});
    let start, end;
    if (!match[1]) { const suffix = Math.min(Number(match[2]), size); start = size - suffix; end = size - 1; }
    else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
    if (start >= size || start > end) return new Response(null, {status:416,headers:{'Content-Range':`bytes */${size}`}});
    const headers = new Headers(response.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Accept-Ranges','bytes');
    return new Response(buffer.slice(start, end + 1), {status:206,statusText:'Partial Content',headers});
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Keep Firebase, Google APIs and other live data requests online-only.
  if (/firebaseio\.com$|googleapis\.com$|firebasestorage\.googleapis\.com$/.test(url.hostname)) return;
  const sameOrigin = url.origin === self.location.origin;
  const isCDN = CDN_HOSTS.has(url.hostname);
  if (!sameOrigin && !isCDN) return;

  if (sameOrigin && request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put('./index.html', response.clone());
          return response;
        }
      } catch (error) { /* offline fallback below */ }
      return (await cache.match(request)) || (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
    })());
    return;
  }

  if (!(sameOrigin && STATIC_EXT.test(url.pathname)) && !(isCDN && STATIC_EXT.test(url.pathname))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = new Request(url.href, {method:'GET'});
    let cached = await cache.match(cacheKey);
    // Media elements may request byte ranges. Serve the requested slice from the full cached file.
    if (request.headers.has('Range') && /\.mp4$/i.test(url.pathname) && cached) {
      return rangeResponse(cached.clone(), request.headers.get('Range'));
    }
    if (cached) {
      // Return the cached copy immediately and refresh it for the next visit.
      fetch(cacheKey).then(response => {
        if (response && (response.ok || response.type === 'opaque')) return cache.put(cacheKey, response);
      }).catch(() => {});
      return cached;
    }
    try {
      const networkRequest = request.headers.has('Range') && /\.mp4$/i.test(url.pathname)
        ? new Request(url.href, {method:'GET', credentials:request.credentials, mode:request.mode, cache:'reload'})
        : request;
      const response = await fetch(networkRequest);
      if (response && (response.ok || response.type === 'opaque')) {
        // Cache the complete video response, not a partial 206 range.
        if (response.status === 200) await cache.put(cacheKey, response.clone());
        if (request.headers.has('Range') && response.status === 200 && /\.mp4$/i.test(url.pathname))
          return rangeResponse(response.clone(), request.headers.get('Range'));
      }
      return response;
    } catch (error) {
      cached = await cache.match(cacheKey);
      if (request.headers.has('Range') && /\.mp4$/i.test(url.pathname) && cached)
        return rangeResponse(cached.clone(), request.headers.get('Range'));
      return cached || Response.error();
    }
  })());
});
