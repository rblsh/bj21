// Cache the shell so the game opens offline. Bump CACHE on every release:
// the old cache is dropped on activate, so a stale build cannot survive.
const CACHE = 'bj21-v3';
const SHELL = [
  '.', 'index.html', 'css/style.css',
  'js/app.js', 'js/engine.js', 'js/spring.js', 'js/sound.js', 'js/strategy.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network first, falling back to the cache: a fresh build wins when there is a
// connection, and the cached one keeps the game playable when there is not
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
