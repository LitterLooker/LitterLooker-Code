importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCh1N2brEWgHe_7-HB_KQx44WmU5WKRhDg",
  authDomain: "litterlookerorg.firebaseapp.com",
  projectId: "litterlookerorg",
  storageBucket: "litterlookerorg.firebasestorage.app",
  messagingSenderId: "492080813442",
  appId: "1:492080813442:web:96423f2ed01c48e94b2b9b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle,
    notificationOptions);
});
