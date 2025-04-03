// Service Worker for SoulSeer - Optimized for Render deployment
const CACHE_NAME = 'soulseer-cache-v1';

// Assets to cache on install (minimum required)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// Install event - cache basic assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Optimized fetch event - network first, fallback to cache, then offline page
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip service worker requests and non-HTTP requests
  const url = new URL(event.request.url);
  if (event.request.url.startsWith('chrome-extension') || 
      !event.request.url.startsWith('http')) {
    return;
  }
  
  // API requests (special handling for API endpoints)
  if (url.pathname.startsWith('/api/')) {
    // For API requests, try network with a shorter timeout
    event.respondWith(
      fetchWithTimeout(event.request, 3000)
        .catch(() => {
          // For failed API requests, try to return cached API response
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If no cached response, return a generic error from offline-api.json
              return caches.match('/offline-api.json');
            });
        })
    );
    return;
  }
  
  // Regular assets - Network first with fallback to cache
  event.respondWith(
    fetchWithTimeout(event.request, 5000)
      .then(response => {
        // Clone the response
        const responseClone = response.clone();
        
        // Cache the successful response (but only cache valid responses)
        if (response.status === 200) {
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
        }
        
        return response;
      })
      .catch(() => {
        // If network failed, try to serve from cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Handle navigation requests (HTML pages)
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            // Return nothing for other resources (will show as failed)
            return new Response('', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Timeout function for fetch requests
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    // Set timeout
    const timeoutId = setTimeout(() => {
      reject(new Error('Network request timeout'));
    }, timeoutMs);
    
    fetch(request).then(
      (response) => {
        // Clear timeout and resolve
        clearTimeout(timeoutId);
        resolve(response);
      },
      (err) => {
        // Clear timeout and reject
        clearTimeout(timeoutId);
        reject(err);
      }
    );
  });
}