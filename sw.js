/* Assistant Coach — service worker

   The cache name carries a build stamp that build.py fills in from a
   hash of the built file. Nobody has to remember to bump anything:
   change the app, rebuild, and the name changes on its own.

   A new worker waits rather than taking over, so the app can offer the
   update instead of reloading underneath someone mid-session. */
const CACHE = 'assistant-coach-db45a4b7';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './favicon.png'];

self.addEventListener('install', e => {
  /* Cache each file on its own. addAll gives up entirely if one file is
     missing, which meant a single absent icon could stop the whole app
     working offline. */
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(CORE.map(u => c.add(u)))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* The page asks to be taken over once the coach presses Update. */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'VERSION') {
    e.source && e.source.postMessage({ type: 'VERSION', cache: CACHE });
  }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Never cache the sync endpoint — stale team data is worse than none. */
  if (url.pathname.includes('/macros/s/') || url.hostname.includes('script.google')) return;

  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => hit))
    );
    return;
  }

  if (req.mode === 'navigate' || url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  }
});
