// Firebase Cloud Messaging Service Worker for MATS
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker with default project configuration
try {
  firebase.initializeApp({
    messagingSenderId: '485856675702',
    projectId: 'mats-c10da',
    appId: '1:485856675702:web:e2c0d3565a8eb4f7e79c57'
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    const notificationTitle = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || 'MATS Notification';
    const notificationOptions = {
      body: (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || 'You have a new ministry announcement.',
      icon: '/favicon/icon-192.png',
      badge: '/favicon/favicon-32x32.png',
      tag: (payload.data && payload.data.tag) || 'mats-bg-notification',
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        url: (payload.data && (payload.data.url || payload.data.click_action)) || (payload.notification && payload.notification.click_action) || '/'
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  // Ignore re-init error if already initialized
}

// Also import the main MATS service worker for caching and offline support
importScripts('/sw.js');
