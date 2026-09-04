/* complex.md service worker: the house pattern (docs/CACHING.md). Navigations
   are network-first with the cached page, then the offline shell, as
   fallbacks; static assets are cache-first; analytics bypass the cache. */

// BUILD_ID is stamped by the site build (a hash of the shipped assets) and
// again by cache-bust at deploy: a changed value means a new cache name, so
// activate deletes every old cache and install re-precaches.
const BUILD_ID = '__BUILD_ID__';
const CACHE = 'complex-md-' + BUILD_ID;
const BYPASS = ['/analytics.js', '/collect'];
const SHELL = [
  '/',
  '/offline/',
  '/offline/index.html',
  '/site.css',
  '/site.js',
  '/site.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/fonts/inter-latin-var.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (BYPASS.some((p) => url.pathname.startsWith(p))) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/offline/')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
