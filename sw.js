// Inoa Games service worker: offline hub + engine, each game cached after its first play.
// Bump VERSION whenever engine/ or the hub changes shape; old caches are deleted on activate.
const VERSION = 'v2';
const CORE = `inoa-core-${VERSION}`, RUNTIME = `inoa-run-${VERSION}`, ASSETS = 'inoa-assets-v1';
const PRECACHE = ['./', 'index.html', 'engine/inoa3d.js', 'engine/ui.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'favicon.png', '404.html'];
const THREE_CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\//;
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', e => { e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))).catch(() => { })); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('inoa-') && ![CORE, RUNTIME, ASSETS].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

// only cache complete, successful responses (never partial/opaque/error responses)
const good = r => r && r.ok && r.status === 200 && r.type !== 'opaque';
async function cacheFirst(req, name) { const hit = await caches.match(req); if (hit) return hit; const res = await fetch(req); if (good(res)) (await caches.open(name)).put(req, res.clone()); return res; }
async function networkFirst(req, name) { try { const res = await fetch(req); if (good(res)) (await caches.open(name)).put(req, res.clone()); else if (req.mode === 'navigate' && res.status === 404) return (await caches.match('404.html')) || res; return res; } catch (e) { const hit = await caches.match(req, { ignoreSearch: true }); if (hit) return hit; if (req.mode === 'navigate') return (await caches.match('404.html')) || Response.error(); throw e; } }
async function staleWhileRevalidate(req, name) { const hit = await caches.match(req); const net = fetch(req).then(async res => { if (good(res)) (await caches.open(name)).put(req, res.clone()); return res; }).catch(() => hit); return hit || net; }

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (THREE_CDN.test(req.url)) return e.respondWith(cacheFirst(req, ASSETS));          // pinned version: immutable
  if (FONTS.test(req.url)) return e.respondWith(staleWhileRevalidate(req, RUNTIME));
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/api/')) return;                                          // billing/account functions: never cached
  // content-addressed-ish game assets (models/hdri) rarely change: cache first; legacy JSON packs too
  if (/\/packs\/assets\//.test(url.pathname) || /\/packs\/[a-z]+\.json$/.test(url.pathname) || /\/thumbs\//.test(url.pathname)) return e.respondWith(cacheFirst(req, ASSETS));
  // pages, engine, manifests: fresh when online, cached when offline
  e.respondWith(networkFirst(req, RUNTIME));
});
