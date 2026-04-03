/* ============================================
   Flexfundament App – Service Worker
   ============================================ */

var CACHE_NAME = 'ff-app-v12';
var APP_SHELL = [
  './shared.js',
  './shared.css',
  './manifest.json',
  './projects.html',
  './reports.html',
  './reports-logic.js',
  './documents.html',
  './drives.html',
  './costs.html'
];

// Install: cache only static assets (NOT HTML pages)
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
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

  // NEVER intercept external requests (Google, Firebase, CDN, etc.)
  if (url.origin !== self.location.origin) {
    return; // Let the browser handle it natively
  }

  // HTML pages: ALWAYS network-first (prevents auth redirect caching issues)
  if (event.request.mode === 'navigate' ||
      event.request.headers.get('accept').indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Offline: try to serve cached version
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Static assets (JS, CSS): cache-first with background update
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
