// ==========================================
// 1. إعدادات Firebase الخاصة بالمشروع
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCiTf3a5rp47E6My5UhIcNjbSDJ3yYEGJ4",
  authDomain: "hydro-smart-2026.firebaseapp.com",
  projectId: "hydro-smart-2026",
  storageBucket: "hydro-smart-2026.firebasestorage.app",
  messagingSenderId: "365503155313",
  appId: "1:365503155313:web:fc7db3b832581919e0dfd0",
  measurementId: "G-TLJ3S9G7JM"
};

const vapidKey = "BMcDnn8ETX0X7cYBtRe7g8v3tkUFYar1aGuJj3HjYEd4OY8lHGa-s75GWGAEgNmMAdRR1D5Zn_4kyfSr72gMNdU";

// تهيئة الخدمة
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ==========================================
// 2. دالة اختبار FCM واستخراج التوكين
// ==========================================
window.testFCM = async function() {
  if (typeof logDebug === 'function') {
    logDebug("🔥 تم الضغط على زر اختبار FCM...");
  }

  if (!('serviceWorker' in navigator)) {
    alert("المتصفح لا يدعم Service Worker");
    return;
  }

  // تفريغ قواعد البيانات القديمة لتجاوز خطأ Installations
  try {
    if (window.indexedDB && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      dbs.forEach(db => {
        if (db.name && db.name.includes('firebase')) {
          indexedDB.deleteDatabase(db.name);
        }
      });
    }
  } catch (e) {
    console.log("Cleanup skipped", e);
  }

  const messaging = firebase.messaging();

  // تسجيل Service Worker وطلب التوكين
  navigator.serviceWorker.register('firebase-messaging-sw.js', { scope: './' })
    .then((registration) => {
      if (typeof logDebug === 'function') logDebug("🟢 Service Worker جاهز ومسجل!");

      return Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          if (typeof logDebug === 'function') logDebug("🟢 تم منح إذن الإشعارات!");
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
        if (typeof logDebug === 'function') logDebug(`🔑 FCM Token: ${token}`);
        localStorage.setItem('fcm_token', token);
        
        // إظهار نافذة نسخ التوكين
        prompt("نسخ الـ FCM Token الخاص بجهازك:", token);
      } else {
        if (typeof logDebug === 'function') logDebug("⚠️ لم يتم استخراج Token.");
      }
    })
    .catch((err) => {
      if (typeof logDebug === 'function') logDebug(`🔴 خطأ: ${err.message}`);
      console.error("FCM Error:", err);
    });
};

// ==========================================
// 3. استقبال الرسائل المباشرة داخل التطبيق
// ==========================================
if (typeof firebase !== 'undefined') {
  try {
    const messaging = firebase.messaging();
    messaging.onMessage((payload) => {
      if (typeof logDebug === 'function') {
        logDebug(`📩 إشعار مباشر: ${payload.notification?.title} - ${payload.notification?.body}`);
      }
      alert(`🚨 ${payload.notification?.title}\n${payload.notification?.body}`);
    });
  } catch (e) {
    console.log("FCM listener init skip", e);
  }
            }
        
