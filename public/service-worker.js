/* Template — service worker.
 *
 * Network-first with a cached fallback so the schedule works offline but a
 * reconnected device always sees the freshly deployed data. Navigations are
 * fetched with no-store so an updated index.html is never served stale.
 *
 * Bump CACHE whenever the set of core assets changes; old caches are purged
 * on activate. The page reloads itself on controllerchange (see app.js).
 */
'use strict';

const CACHE = 'app-v1';
const CORE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/local-state.js',
  '/share-link.js',
  '/nav-glow.js',
  '/manifest.webmanifest',
  '/app-changes.json',
  '/icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Connectivity may be weak and flaky: serve from cache IMMEDIATELY and
// revalidate in the background. The app's explicit freshness fetches
// (cache:'no-store') get the network with a short timeout, falling back to
// cache, so a bad signal can never blank or block the UI.
const FRESH_TIMEOUT_MS = 4000;

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  if (req.cache === 'no-store') {
    event.respondWith((async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FRESH_TIMEOUT_MS);
      try {
        const res = await fetch(req, { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req.url, copy)).catch(() => {});
        }
        return res;
      } catch (e) {
        clearTimeout(timer);
        const hit = await caches.match(req.url);
        if (hit) return hit;
        throw e;
      }
    })());
    return;
  }

  // Secondary pages (any path other than /): the
  // network races a short fuse. A fast network wins — every visit shows
  // the current deploy (issue #61). A slow one loses to the cached copy at
  // ~900ms (issue #76: a bad link must not stall app-like pages), with
  // the fetch still landing in the cache for next time. No cache and no
  // network inside 4s → the error it truly is.
  const path = new URL(req.url).pathname;
  if (req.mode === 'navigate' && path !== '/') {
    event.respondWith((async () => {
      const cacheKey = new URL(req.url).origin + path;
      const cachedP = caches.match(req.url, { ignoreSearch: true });
      const ctrl = new AbortController();
      const hardTimer = setTimeout(() => ctrl.abort(), FRESH_TIMEOUT_MS);
      // fetch by URL: navigate-mode Requests can't take an init dict, and
      // no-store keeps the HTTP cache from re-creating staleness
      const netP = fetch(req.url, { cache: 'no-store', signal: ctrl.signal })
        .then(res => {
          clearTimeout(hardTimer);   // never abort a body mid-stream
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(cacheKey, copy)).catch(() => {});
          }
          return res;
        });
      const raced = await Promise.race([
        netP.then(res => ({ net: res })).catch(() => null),
        new Promise(res => setTimeout(res, 900)).then(async () => {
          const hit = await cachedP;
          return hit ? { cache: hit } : null;   // nothing cached: keep waiting
        }),
      ]);
      if (raced && raced.net) return raced.net;
      if (raced && raced.cache) {
        event.waitUntil(netP.catch(() => {}));   // let the refresh land
        return raced.cache;
      }
      try {
        return await netP;
      } catch (e) {
        clearTimeout(hardTimer);
        const hit = await cachedP;
        if (hit) return hit;
        throw e;
      }
    })());
    return;
  }

  // shell + assets: cache-first, background revalidation. Navigations are
  // cached under their bare path — launch URLs can carry a ?m= migration
  // stamp (issue #50) that must not mint per-stamp cache entries.
  event.respondWith((async () => {
    const cached = await caches.match(req.url, { ignoreSearch: req.mode === 'navigate' });
    const cacheKey = req.mode === 'navigate'
      ? new URL(req.url).origin + new URL(req.url).pathname
      : req.url;
    const revalidate = fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(cacheKey, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(revalidate);
      return cached;
    }
    const net = await revalidate;
    if (net) return net;
    return caches.match('/');
  })());
});
