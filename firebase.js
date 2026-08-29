// ==========================================
// إعدادات مشروع Firebase وتفعيل الإشعارات FCM
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCiTf3a5rp47E6My5UhIcNjbSDJ3yYEGJ4",
  authDomain: "hydro-smart-2026.firebaseapp.com",
  projectId: "hydro-smart-2026",
  storageBucket: "hydro-smart-2026.firebasestorage.app",
  messagingSenderId: "365503155313",
  appId: "1:365503155313:web:fc7db3b832681919e8dfd0",
  measurementId: "G-TLJ3S9G7JM"
};

// المفتاح الذي تم استخراجه من صورة Web Push Certificate
const vapidKey = "BMcDnn8ETX8X7cYBTRe7g8v3tkUFYaz1a8uJj3HjYEd40YB1liGa-s75GMGAEgNaMadRR1D5Zn_4kyfSz72gMNdU";

// 1. تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// تسجيل Service Worker وطلب التوكين
function requestNotificationPermission() {
  logDebug("جاري تسجيل Service Worker وطلب إذن الإشعارات...");

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        logDebug("🟢 تم تسجيل Service Worker بنجاح!");

        return Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            logDebug('🟢 تم منح إذن الإشعارات!');

            return messaging.getToken({
              serviceWorkerRegistration: registration,
              vapidKey: vapidKey
            });
          } else {
            throw new Error('تم رفض إذن الإشعارات');
          }
        });
      })
      .then((currentToken) => {
        if (currentToken) {
          logDebug(`🔑 FCM Token: ${currentToken.substring(0, 10)}...`);
          localStorage.setItem('fcm_token', currentToken);

          // إظهار نافذة للنسخ الفوري
          prompt("نسخ الـ FCM Token الخاص بجهازك لـ Firebase Console:", currentToken);
        }
      })
      .catch((err) => {
        logDebug(`🔴 خطأ: ${err.message}`);
      });
  } else {
    logDebug("⚠️ المتصفح لا يدعم Service Worker");
  }
}

function addAlertToUI(title, message, type = 'red') {
  const alertsList = document.getElementById('alerts-list');
  if (!alertsList) return;

  const time = new Date().toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' });
  const alertItem = document.createElement('div');
  alertItem.className = `alert-item ${type}`;
  alertItem.innerHTML = `
    <strong>${type === 'red' ? '🚨' : '⚠️'} ${title} (${time})</strong>
    <p>${message}</p>
  `;

  alertsList.prepend(alertItem);
}

function testFCM() {
  requestNotificationPermission();
}
