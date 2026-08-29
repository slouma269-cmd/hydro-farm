// ==========================================
// 1. إعدادات Firebase
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCiTf3a5rp47E6My5UhIcNjbSDJ3yYEGJ4",
  authDomain: "hydro-smart-2026.firebaseapp.com",
  projectId: "hydro-smart-2026",
  storageBucket: "hydro-smart-2026.firebasestorage.app",
  messagingSenderId: "365503155313",
  appId: "1:365503155313:web:fc7db3b832681919e8dfd0"
};

const vapidKey = "BLkC--WlBf9q53xVd-u_R67-s-6lqB-_x"; // استبدله بمفتاح VAPID الخاص بك إن وجد

// تهيئة تطبيق Firebase
let app, messaging;
try {
  app = firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  logDebug("🟢 Firebase initialized successfully.");
} catch (e) {
  logDebug("🔴 الخطأ أثناء تهيئة Firebase: " + e.message);
}

// ==========================================
// 2. دالة تسجيل Diagnostic Logs
// ==========================================
function logDebug(msg) {
  console.log(msg);
  const consoleElem = document.getElementById("debugConsole") || document.querySelector(".debug-console");
  if (consoleElem) {
    const time = new Date().toLocaleTimeString('ar-EG');
    consoleElem.innerHTML += `<div>[${time}] ${msg}</div>`;
    consoleElem.scrollTop = consoleElem.scrollHeight;
  }
}

// ==========================================
// 3. طلب الإذن واستخراج الـ FCM Token بنجاح
// ==========================================
function requestNotificationPermission() {
  logDebug("جاري التسجيل في Service Worker وطلب إذن الإشعارات...");

  if (!('serviceWorker' in navigator)) {
    logDebug("⚠️ المتصفح لا يدعم Service Worker");
    return;
  }

  // تسجيل Service Worker بالمسار النسبي لتفادي مشاكل الـ Scope
  navigator.serviceWorker.register('./firebase-messaging-sw.js')
    .then((registration) => {
      logDebug("🟢 تم تسجيل Service Worker بنجاح!");

      return Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          logDebug('🟢 تم منح إذن الإشعارات!');

          // طلب التوكين بربطه المباشر مع تسجيل الـ SW
          return messaging.getToken({
            serviceWorkerRegistration: registration,
            vapidKey: vapidKey
          });
        } else {
          throw new Error('تم رفض إذن الإشعارات من المتصفح.');
        }
      });
    })
    .then((currentToken) => {
      if (currentToken) {
        logDebug(`🔑 FCM Token received: ${currentToken.substring(0, 8)}...${currentToken.substring(currentToken.length - 4)}`);
        localStorage.setItem('fcm_token', currentToken);
        
        // إظهار نافذة منبثقة تحتوي التوكين لنسخه بنقرة واحدة
        prompt("نسخ الـ FCM Token الكامل لاستخدامه في Firebase Console:", currentToken);
      } else {
        logDebug('⚠️ لم يتم الحصول على Token. تحقق من إعدادات VAPID.');
      }
    })
    .catch((err) => {
      logDebug(`🔴 خطأ: ${err.message}`);
    });
}

// ==========================================
// 4. استقبال التنبيهات والتطبيق مفتوح (Foreground)
// ==========================================
if (messaging) {
  messaging.onMessage((payload) => {
    logDebug(`📩 إشعار جديد: ${payload.notification?.title} - ${payload.notification?.body}`);
    if (Notification.permission === 'granted') {
      new Notification(payload.notification?.title || '🚨 تنبيه Hydro', {
        body: payload.notification?.body,
        icon: './icon-192.png'
      });
    }
  });
}

// ==========================================
// 5. ربط الأزرار عند تحميل الصفحة
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const btnFcmTest = document.getElementById("btnFcmTest") || document.querySelector(".btn-fcm-test");
  if (btnFcmTest) {
    btnFcmTest.addEventListener("click", requestNotificationPermission);
  }
});
      
