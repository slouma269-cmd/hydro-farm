// ==========================================
// Firebase Cloud Messaging Service Worker
// ==========================================

// 1. استدعاء مكتبات Firebase المتوافقة (Compat SDK)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 2. تهيئة Firebase ببيانات مشروعك
firebase.initializeApp({
  apiKey: "AIzaSyCiTf3a5rp47E6My5UhIcNjbSDJ3yYEGJ4",
  authDomain: "hydro-smart-2026.firebaseapp.com",
  projectId: "hydro-smart-2026",
  storageBucket: "hydro-smart-2026.firebasestorage.app",
  messagingSenderId: "365503155313",
  appId: "1:365503155313:web:fc7db3b832681919e8dfd0"
});

// 3. إنشاء كائن الرسائل
const messaging = firebase.messaging();

// 4. استقبال التنبيهات وإظهارها عندما يكون التطبيق في الخلفية أو مغلقاً
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || '🚨 تنبيه Hydro Farm';
  const notificationOptions = {
    body: payload.notification?.body || 'تحديث جديد من نظام المزرعة الذكية.',
    icon: 'icon-192.png',
    badge: 'icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
