'use strict';
// My Overtime: serve the app immediately; cache each requested resource quietly.
const PREFIX='my-overtime-app-';
const VERSION='v23';
const APP_CACHE=PREFIX+VERSION;
const RUNTIME_CACHE=PREFIX+'runtime-v7';
const SHELL=new URL('./index.html',self.registration.scope).href;
const LIBS=[
 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js',
 'https://www.gstatic.com/firebasejs/12.2.1/firebase-database-compat.js',
 'https://www.gstatic.com/firebasejs/12.2.1/firebase-storage-compat.js'
];
self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
 const keep=new Set([APP_CACHE,RUNTIME_CACHE]);
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&!keep.has(k)).map(k=>caches.delete(k)));
 await self.clients.claim();
})());});
async function refresh(req,cacheName,key){try{const r=await fetch(req,{cache:'no-store'});if(r&&r.ok){const c=await caches.open(cacheName);await c.put(key||req,r.clone());}}catch(_){}}
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;
 const u=new URL(req.url),same=u.origin===self.location.origin,lib=LIBS.includes(u.href);
 if(!same&&!lib)return;
 if(req.mode==='navigate'){
  e.respondWith((async()=>{
   const c=await caches.open(APP_CACHE);const cached=await c.match(req)||await c.match(SHELL);
   if(cached){e.waitUntil(refresh(req,APP_CACHE,SHELL));return cached;}
   try{const r=await fetch(req);if(r&&r.ok)e.waitUntil(c.put(SHELL,r.clone()));return r;}catch(_){return await c.match(SHELL)||Response.error();}
  })());return;
 }
 const cacheName=lib?APP_CACHE:RUNTIME_CACHE;
 e.respondWith((async()=>{
  const c=await caches.open(cacheName),cached=await c.match(req);
  if(cached){e.waitUntil(refresh(req,cacheName,req));return cached;}
  try{const r=await fetch(req);if(r&&r.ok&&(same||lib))e.waitUntil(c.put(req,r.clone()));return r;}catch(_){return await c.match(req)||Response.error();}
 })());
});
