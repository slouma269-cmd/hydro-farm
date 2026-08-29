// ==========================================
// 1. إعدادات وتفريغ بيانات Firebase
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCiTf3a5rp47E6My5UhIcNjbSDJ3yYEGJ4",
  authDomain: "hydro-smart-2026.firebaseapp.com",
  projectId: "hydro-smart-2026",
  storageBucket: "hydro-smart-2026.firebasestorage.app",
  messagingSenderId: "365503155313",
  appId: "1:365503155313:web:fc7db3b832681919e8dfd0"
};

// مفتاح VAPID الحقيقي الخاص بمشروعك
const vapidKey = "BMcDnn8ETX0X7cYBtRe7g8v3tkUFYar1aGuJj3HjYEd4OY8lHGa-s75GWGAEgNmMAdRR1D5Zn_4kyfSr72gMNdU";

// تهيئة الخدمة
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ==========================================
// 2. دالة اختبار FCM الرئيسية
// ==========================================
window.testFCM = function() {
  logDebug("🔥 تم الضغط على زر اختبار FCM...");

  if (!('serviceWorker' in navigator)) {
    alert("المتصفح لا يدعم Service Worker");
    return;
  }

  const messaging = firebase.messaging();

  // تسجيل الـ Service Worker وطلب التوكين
  navigator.serviceWorker.register('firebase-messaging-sw.js', { scope: './' })
    .then((registration) => {
      logDebug("🟢 Service Worker جاهز ومسجل!");

      return Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          logDebug("🟢 تم منح إذن الإشعارات!");
          return messaging.getToken({
            serviceWorkerRegistration: registration,
            vapidKey: vapidKey
          });
        } else {
          throw new Error("تم رفض إذن الإشعارات من الهاتف");
        }
      });
    })
    .then((token) => {
      if (token) {
        logDebug(`🔑 FCM Token: ${token}`);
        localStorage.setItem('fcm_token', token);
        
        // إظهار نافذة منبثقة بنص التوكين لنسخه مباشرة
        prompt("نسخ الـ FCM Token الخاص بجهازك:", token);
      } else {
        logDebug("⚠️ لم يتم استخراج Token.");
      }
    })
    .catch((err) => {
      logDebug(`🔴 خطأ: ${err.message}`);
    });
};

// ==========================================
// 3. استقبال الرسائل المباشرة داخل التطبيق
// ==========================================
if (typeof firebase !== 'undefined') {
  try {
    const messaging = firebase.messaging();
    messaging.onMessage((payload) => {
      logDebug(`📩 إشعار مباشر: ${payload.notification?.title} - ${payload.notification?.body}`);
      alert(`🚨 ${payload.notification?.title}\n${payload.notification?.body}`);
    });
  } catch (e) {
    console.log("FCM listener init skip", e);
  }
                        }
