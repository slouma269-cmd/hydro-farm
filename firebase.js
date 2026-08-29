const firebaseConfig = {
  apiKey: "AIzaSyCiTf3a5rp47E6My5UhIcNjbSDJ3yYEGJ4",
  authDomain: "hydro-smart-2026.firebaseapp.com",
  projectId: "hydro-smart-2026",
  storageBucket: "hydro-smart-2026.firebasestorage.app",
  messagingSenderId: "365503155313",
  appId: "1:365503155313:web:fc7db3b832681919e8dfd0"
};

const vapidKey = "BLkC--WlBf9q53xVd-u_R67-s-6lqB-_x";

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

function requestNotificationPermission() {
  logDebug("جاري إعداد Service Worker وحفظ الإشعارات...");

  if (!('serviceWorker' in navigator)) {
    logDebug("⚠️ المتصفح لا يدعم Service Worker");
    return;
  }

  // تسجيل الـ Service Worker بالمسار الصحيح للمستودع
  navigator.serviceWorker.register('firebase-messaging-sw.js', { scope: './' })
    .then((registration) => {
      logDebug("🟢 Service Worker جاهز ومسجل!");

      return Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          logDebug('🟢 تم قبول إذن الإشعارات!');
          return messaging.getToken({
            serviceWorkerRegistration: registration,
            vapidKey: vapidKey
          });
        } else {
          throw new Error('تم رفض الإذن من المتصفح');
        }
      });
    })
    .then((token) => {
      if (token) {
        logDebug(`🔑 FCM Token: ${token}`);
        localStorage.setItem('fcm_token', token);
        prompt("نسخ الـ FCM Token الخاص بك:", token);
      } else {
        logDebug('⚠️ لم يتم إنشاء Token.');
      }
    })
    .catch((err) => {
      logDebug(`🔴 خطأ التشغيل: ${err.message}`);
    });
}

messaging.onMessage((payload) => {
  logDebug(`📩 إشعار مباشر: ${payload.notification?.title} - ${payload.notification?.body}`);
  alert(`🚨 ${payload.notification?.title}\n${payload.notification?.body}`);
});
            
