importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBfWd-HfC5JU_gPh1qKvKffa3CKOGb17jE',
  authDomain: 'skillpath-9e635.firebaseapp.com',
  projectId: 'skillpath-9e635',
  storageBucket: 'skillpath-9e635.firebasestorage.app',
  messagingSenderId: '89377391385',
  appId: '1:89377391385:web:d063adfa8b2d5969333b88',
});

const messaging = firebase.messaging();

// Handles push messages when the app tab is closed or in the background.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'SkillPath';
  const body  = payload.notification?.body  ?? 'You have tasks waiting today!';
  self.registration.showNotification(title, {
    body,
    icon:  '/LOGO.png',
    badge: '/LOGO.png',
    data:  { url: payload.fcmOptions?.link ?? '/' },
  });
});

// Click on notification → open/focus the app tab.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
