const CACHE_NAME = 'bantlo-app-shell-v1';
const DATA_CACHE_NAME = 'bantlo-data-cache-v1';

// App shell files setup
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.info',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static App Shell');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  // Preemptively clean up old caches if version changes
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude Supabase API and external tools from caching in SW for now.
  // We handle Supabase sync manually via IndexedDB logic per user request.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. NETWORK-ONLY / NETWORK-FIRST for dynamic or frequent-update paths
  // Gateway pages should never be stale (Landing, Auth, About)
  const isGateway = url.pathname === '/' || url.pathname === '/auth' || url.pathname === '/about';
  const isVersion = url.pathname === '/version.info';

  if (isGateway || isVersion) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => {
        // Only return cached version if offline
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first for all other static assets (App Shell)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Only cache good responses
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const resToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resToCache);
        });
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback: Serve index.html for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// Background Sync API implementation for offline mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    console.log('[SW] Background sync triggered.');
    event.waitUntil(syncMutations());
  }
});

async function syncMutations() {
  // Logic to read from IndexedDB mutation queue and push to Supabase will be here.
  console.log('[SW] Executing syncMutations...');
}

// Listen to messages from clients to clear caches (Easter Egg Force Update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FORCE_UPDATE') {
    console.log('[SW] Force updating cache...');
    caches.keys().then((names) => {
      for (let name of names) caches.delete(name);
    }).then(() => {
      self.registration.unregister().then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.navigate(client.url));
        });
      });
    });
  }
});
