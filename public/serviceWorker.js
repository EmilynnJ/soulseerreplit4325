// Service Worker for SoulSeer Psychic Application
const CACHE_NAME = 'soulseer-cache-v1';
const APP_VERSION = '1.0.0';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/offline-api.json',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png'
];

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing Service Worker...', event);
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Precaching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .catch(error => {
        console.error('[ServiceWorker] Precaching failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating Service Worker...', event);
  
  // Clean up old caches
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            return cacheName !== CACHE_NAME;
          }).map(cacheName => {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Helper function to determine if a request is an API call
function isApiRequest(request) {
  return request.url.includes('/api/');
}

// Helper function to determine if a request is for an HTML page
function isHtmlRequest(request) {
  const url = new URL(request.url);
  const pathExtension = url.pathname.split('.').pop();
  
  // If no file extension or explicitly html
  return !pathExtension || pathExtension === 'html';
}

// Utility function to fetch with timeout
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    // Set timeout
    const timeoutId = setTimeout(() => {
      reject(new Error('Request timed out'));
    }, timeoutMs);
    
    fetch(request).then(
      (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

// Fetch event - network-first strategy with fallbacks
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Different strategies based on the type of request
  if (isApiRequest(request)) {
    // For API requests: Network first, fall back to offline-api.json
    event.respondWith(
      fetchWithTimeout(request.clone(), 5000)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              // Only cache GET API responses
              if (request.method === 'GET') {
                cache.put(request, responseClone);
              }
            });
          }
          return response;
        })
        .catch(() => {
          // Try to get from cache first
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, return generic offline API response
              return caches.match('/offline-api.json');
            });
        })
    );
  } else if (isHtmlRequest(request)) {
    // For HTML page requests: Network first, fall back to offline.html for navigation
    event.respondWith(
      fetch(request)
        .then(response => {
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, return offline page
              return caches.match('/offline.html');
            });
        })
    );
  } else {
    // For other assets (CSS, JS, images): Cache first, then network
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached response immediately
            
            // In the background, fetch a fresh version to update the cache
            // This implements a stale-while-revalidate pattern
            fetch(request).then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, response.clone());
                });
              }
            }).catch(() => {
              // Silently fail the background refresh
            });
            
            return cachedResponse;
          }
          
          // If not in cache, try to fetch it
          return fetch(request)
            .then(response => {
              if (!response || response.status !== 200) {
                return response;
              }
              
              // Cache the fetched response
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
              
              return response;
            })
            .catch(error => {
              console.error('[ServiceWorker] Fetch failed:', error);
              // For images, try to return a placeholder
              if (request.destination === 'image') {
                return caches.match('/icons/icon-192x192.png');
              }
              
              throw error;
            });
        })
    );
  }
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});