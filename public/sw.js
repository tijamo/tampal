/*
 * Tampal service worker.
 *
 * Strategy:
 *  - Precache the app shell so the PWA opens offline.
 *  - Network-first for navigations (fall back to cached shell/offline page).
 *  - Stale-while-revalidate for static assets (icons, manifest).
 *  - Never cache Supabase API/auth responses (they carry personal data and must
 *    always be fresh and authenticated).
 *
 * Attendance writes made while offline are queued in IndexedDB by the app
 * (see src/lib/offline-queue.ts) and replayed on reconnect; the SW just wakes
 * the app via the 'sync' event when Background Sync is available.
 */
const CACHE = 'tampal-shell-v4';
const SHELL = ['/', '/offline', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Supabase carries personal data and must never be cached. Detect it by host
// (Supabase Cloud) OR by API path prefix, so a self-hosted instance behind a
// custom domain (e.g. https://api.tamfam.example) is still treated as off-limits.
const SUPABASE_API_PREFIXES = ['/rest/v1', '/auth/v1', '/realtime/v1', '/storage/v1', '/functions/v1'];

function isSupabase(url) {
  if (url.hostname.endsWith('.supabase.co')) return true;
  return SUPABASE_API_PREFIXES.some((p) => url.pathname.startsWith(p));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never intercept writes
  const url = new URL(request.url);

  // Personal data from Supabase must never be served from cache.
  if (isSupabase(url)) return;

  // App navigations: network first, fall back to cache, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/offline'))),
    );
    return;
  }

  // Same-origin static assets only: stale-while-revalidate. Everything else
  // (RSC/flight-data fetches for client-side navigation and router.refresh(),
  // API routes, etc.) must go straight to the network so mutations show up
  // without a hard refresh.
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest';

  if (url.origin === self.location.origin && isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

// Background Sync: tell open clients to flush the offline attendance queue.
self.addEventListener('sync', (event) => {
  if (event.tag === 'tamfam-attendance-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'flush-attendance-queue' }));
      }),
    );
  }
});
