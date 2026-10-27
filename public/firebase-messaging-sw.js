importScripts('https://www.gstatic.com/firebasejs/8.0.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.0.1/firebase-messaging.js');

// A service worker can't read .env values: paste your Firebase web config here.
// (These values are public identifiers, they are not secrets.)
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
});

const messaging = firebase.messaging();

const defaultHref = self.location.origin;

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  const options = {
    badge: "icon.png",
    body: data.body,
    icon: data.photoURL,
    data: { href: data.href || defaultHref },
  };
  if (data.image) {
    options.image = data.image;
  }
  self.registration.showNotification(data.title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || defaultHref;
  event.waitUntil(self.clients.openWindow(href));
});
