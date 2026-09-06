// Cache the shell so the game opens offline. Bump CACHE on every release:
// the old cache is dropped on activate, so a stale build cannot survive.
const CACHE = 'bj21-v6';
const SHELL = [
  '.', 'index.html', 'css/style.css',
  'js/app.js', 'js/engine.js', 'js/spring.js', 'js/sound.js', 'js/strategy.js',
  'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
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

// Network first, falling back to the cache: a fresh build wins when there is a
// connection, and the cached one keeps the game playable when there is not.
// The timeout matters more than it looks: a phone on one bar of signal does not
// fail the fetch, it hangs on it, and without a deadline the game hangs too.
const NET_TIMEOUT = 3000;

function fromNetwork(req) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT);
    fetch(req).then(res => { clearTimeout(t); resolve(res); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fromNetwork(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r =>
        r || (req.mode === 'navigate' ? caches.match('index.html') : Promise.reject(new Error('offline')))
      ))
  );
});
