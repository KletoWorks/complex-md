/* complex.md is not an installable app, by decision (2026-09-04). A service
   worker was briefly served at this path; this replacement unregisters
   itself and clears every cache in any browser that still has the old one,
   then gets out of the way. Keep it served until 2026-10-01, then delete. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});
