// Bumped to v2 to evict shells poisoned by the old cache-first navigation
// handling — activate() only deletes caches whose name differs from this one,
// so a constant name meant the cleanup never ran. Bump this whenever cached
// entries need to be discarded wholesale.
const CACHE_NAME = 'bantlo-app-shell-v2';
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

  // 1. NETWORK-FIRST for HTML and for anything that must never be stale.
  //
  // Every navigation, not an allow-list of paths. The build emits
  // content-hashed asset filenames, so a stale index.html asks for files that
  // no longer exist on the origin — the app then fails to boot at all. Serving
  // HTML cache-first is only safe when asset URLs are stable, and here they are
  // deliberately not.
  //
  // This previously covered only '/', '/auth' and '/about'. Because the host
  // serves index.html for unknown SPA routes, opening /dashboard or
  // /groups/:id fell through to the cache-first branch below and stored an
  // index.html under that path — permanently, since the cache name never
  // changed. After a later deploy those users got a white screen with no way
  // back: the version-check prompt that would have recovered them is React
  // code, which never runs when the shell is broken.
  const isVersion = url.pathname === '/version.info';

  if (event.request.mode === 'navigate' || isVersion) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((networkResponse) => {
          // Keep one copy of the shell for offline use, always under
          // /index.html rather than the requested path — otherwise the cache
          // accumulates a separate HTML entry per route visited.
          if (event.request.mode === 'navigate' && networkResponse && networkResponse.status === 200) {
            const resToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', resToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline: any cached shell beats a browser error page.
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // Cache-first for hashed static assets. Safe precisely because the build
  // renames a file whenever its contents change, so an entry can never go
  // stale under a name that now means something else.
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
