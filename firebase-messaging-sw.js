importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCiTf3a5np47E5My5UhIcNjbSDJ3yYEGJ4",
  authDomain: "hydro-smart-2026.firebaseapp.com",
  projectId: "hydro-smart-2026",
  storageBucket: "hydro-smart-2026.firebasestorage.app",
  messagingSenderId: "365503155313",
  appId: "1:365503155313:web:fc7db3b832581919e0dfd0",
  measurementId: "G-TLJ3S9G7JM"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background Message:', payload);
  self.registration.showNotification(payload.notification?.title || '🚨 تنبيه Hydro Farm', {
    body: payload.notification?.body || 'تحديث جديد من المزرعة.',
    icon: 'icon-192.png'
  });
});
