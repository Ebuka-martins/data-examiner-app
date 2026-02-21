// service-worker.js - FIXED VERSION (No message channel errors)
const CACHE_NAME = 'data-examiner-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/favicon.ico',
  '/favicon/favicon-16x16.png',
  '/favicon/favicon-32x32.png',
  '/favicon/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/src/app.js',
  '/src/api.js',
  '/src/chart.js',
  '/src/file-analyzer.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker installed and assets cached');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Cache installation failed:', err);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Skip non-GET requests, API calls, and non-HTTP protocols
  if (event.request.method !== 'GET' || 
      event.request.url.includes('/api/') ||
      !event.request.url.startsWith('http')) {
    return;
  }

  // Skip chrome-extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        // If cached, return it
        if (cached) {
          return cached;
        }

        // Otherwise fetch from network
        return fetch(event.request).then(response => {
          // Only cache successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();
          
          // Open cache and store response (don't wait for this)
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => {
              console.error('Cache put error:', err);
            });

          return response;
        }).catch(error => {
          console.error('Fetch failed:', error);
          
          // Return a simple offline response instead of HTML for non-HTML requests
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
          
          // Return a basic offline response
          return new Response('You are offline', { 
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          });
        });
      })
  );
});

// OPTIMIZED: Remove message event listener entirely or keep it minimal
// This is the key fix - avoid complex async responses
self.addEventListener('message', event => {
  // Just do simple actions without returning promises
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  // Don't return anything - this prevents the channel error
});

// Optional: Add a simple ping handler that doesn't require async response
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'PING') {
    // Just log, don't respond
    console.log('Ping received');
  }
});