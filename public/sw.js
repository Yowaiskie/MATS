const CACHE_NAME = 'mats-static-v2';

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ministy_logo.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/favicon.svg'
];

// Helper to determine if a request is targeting Firebase/Firestore or dynamic data APIs
function isFirebaseOrApiRequest(url) {
  return (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebaseinstallations.googleapis.com') ||
    url.includes('firebase.googleapis.com') ||
    url.includes('google.com/recaptcha') ||
    url.includes('googleapis.com')
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = request.url;

  // CRITICAL REQUIREMENT: Always bypass cache for Firebase & Firestore network requests
  if (isFirebaseOrApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-First with Cache Fallback for navigation / app shell / static assets
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // If valid response, update the static cache in background
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network failed (offline), try retrieving from cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // If it's a navigation request and not in cache, fallback to app shell /index.html for SPA routing
        if (request.mode === 'navigate') {
          const appShell = await caches.match('/index.html') || await caches.match('/');
          if (appShell) {
            return appShell;
          }
        }

        return new Response('Network error occurred', {
          status: 533,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
