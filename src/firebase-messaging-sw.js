importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDPcOav0UaY0FbmYmZE3VqPEM-boUwhYiI",
  authDomain: "montour-cabcb.firebaseapp.com",
  projectId: "montour-cabcb",
  storageBucket: "montour-cabcb.firebasestorage.app",
  messagingSenderId: "336785741612",
  appId: "1:336785741612:web:412b663f0c30a5ab6afe89"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/assets/icon/favicon.png'
  });
});