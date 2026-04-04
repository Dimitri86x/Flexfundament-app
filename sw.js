/* ============================================
   Flexfundament App – Service Worker
   ============================================ */

var CACHE_NAME = 'ff-app-v16';

var APP_SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './projects.html',
  './reports.html',
  './reports-logic.js',
  './documents.html',
  './drives.html',
  './costs.html',
  './calendar.html',
  './shared.js',
  './shared.css',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// External scripts cached with best-effort (no install failure if CDN unreachable)
var EXTERNAL_SCRIPTS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// CDN hosts intercepted by the fetch handler (cache-first)
var CACHED_CDN_HOSTS = ['www.gstatic.com', 'cdnjs.cloudflare.com'];

// Install: cache App Shell (required) + CDN scripts (best-effort)
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // App shell must succeed — if any file is missing the install fails
      return cache.addAll(APP_SHELL).then(function() {
        // CDN scripts are best-effort: cache them individually, ignore failures
        var cdnPromises = EXTERNAL_SCRIPTS.map(function(url) {
          return fetch(url, { cache: 'no-cache' })
            .then(function(response) {
              if (response && response.status === 200) {
                return cache.put(url, response);
              }
            })
            .catch(function(err) {
              console.warn('[SW] CDN pre-cache failed (offline?):', url, err.message);
            });
        });
        return Promise.all(cdnPromises);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: delete old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch strategy
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // CDN scripts (Firebase SDK, jsPDF): cache-first, fall back to network
  if (CACHED_CDN_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Ignore all other external origins (Firebase API calls, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  var acceptHeader = event.request.headers.get('accept') || '';

  // HTML pages: network-first (always fresh when online, cached fallback when offline)
  if (event.request.mode === 'navigate' ||
      acceptHeader.indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        // Update the cache with the fresh response
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline: serve cached version
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Static assets (JS, CSS, images): cache-first with background update
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return cached;
      });

      return cached || fetchPromise;
    })
  );
});
