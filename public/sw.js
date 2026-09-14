const CACHE_NAME = 'mats-static-v5';

// Static assets to pre-cache on install (with correct /favicon/ subdirectory paths)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ministy_logo.jpg',
  '/parish-logo.png',
  '/favicon/favicon.png',
  '/favicon/icon-192.png',
  '/favicon/icon-512.png',
  '/favicon/icon-512-maskable.png',
  '/favicon/android-chrome-192x192.png',
  '/favicon/android-chrome-512x512.png',
  '/favicon/apple-touch-icon.png',
  '/favicon/favicon.ico',
  '/favicon/favicon-16x16.png',
  '/favicon/favicon-32x32.png'
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
    caches.open(CACHE_NAME).then(async (cache) => {
      // Safely pre-cache assets without letting a single missing file fail the entire service worker installation
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res.ok) {
              await cache.put(url, res);
            }
          } catch (err) {
            console.warn('Failed to pre-cache asset:', url, err);
          }
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Purging old service worker cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // Only handle GET requests with http/https schemes (ignore chrome-extension://, blob:, data:, etc.)
  if (request.method !== 'GET' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return;
  }

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
            cache.put(request, responseToCache).catch((err) => {
              console.warn('Failed to cache resource:', url, err);
            });
          }).catch(() => {});
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

// ============================================================================
// Push Notification Event Handlers (FCM / Web Push API)
// ============================================================================

self.addEventListener('push', (event) => {
  let title = 'MATS Notification';
  let options = {
    body: 'You have a new ministry update.',
    icon: '/favicon/icon-192.png',
    badge: '/favicon/favicon-32x32.png',
    tag: 'mats-general',
    renotify: true,
    data: {
      url: '/'
    }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      const notificationData = payload.notification || payload.data || {};
      title = notificationData.title || title;
      options = {
        ...options,
        body: notificationData.body || options.body,
        icon: notificationData.icon || options.icon,
        tag: notificationData.tag || options.tag,
        data: {
          url: notificationData.click_action || notificationData.url || (payload.data && payload.data.url) || '/',
          ...payload.data
        }
      };
    } catch {
      // If plain text payload
      options.body = event.data.text() || options.body;
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If client is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

