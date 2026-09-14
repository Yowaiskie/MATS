// Firebase Cloud Messaging Service Worker for MATS
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker with default project configuration
try {
  firebase.initializeApp({
    messagingSenderId: '575677848039',
    projectId: 'mats-c10da',
    appId: '1:575677848039:web:3eefca40bc39e1e93daebf'
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    const notificationTitle = payload.notification ? payload.notification.title : 'MATS Notification';
    const notificationOptions = {
      body: payload.notification ? payload.notification.body : '',
      icon: '/favicon/icon-192.png',
      badge: '/favicon/favicon-32x32.png',
      data: payload.data || { url: '/' }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  // Ignore re-init error if already initialized
}

// Also import the main MATS service worker for caching and offline support
importScripts('/sw.js');
