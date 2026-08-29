importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCiTf3a5rp47E6My5UhIcNjbSDJ3yYEGJ4",
  authDomain: "hydro-smart-2026.firebaseapp.com",
  projectId: "hydro-smart-2026",
  storageBucket: "hydro-smart-2026.firebasestorage.app",
  messagingSenderId: "365503155313",
  appId: "1:365503155313:web:fc7db3b832681919e8dfd0"
});

const messaging = firebase.messaging();

// استقبال الإشعارات عندما يكون التطبيق في الخلفية أو مغلقاً
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || '🚨 تنبيه من المزرعة الذكية';
  const notificationOptions = {
    body: payload.notification?.body || 'تحديث جديد في قراءات المستشعرات.',
    icon: './icon-192.png',
    badge: './icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
