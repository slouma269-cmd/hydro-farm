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

const vapidKey = "BLkC--WlBf9q53xVd-u_R67-s-6lqB-_x";

// تهيئة الخدمة
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const messaging = firebase.messaging();

// ==========================================
// 2. دالة تشغيل واختبار FCM عند الضغط على الزر
// ==========================================
function testFCM() {
  logDebug("🔥 تم الضغط على زر اختبار FCM...");

  if (!('serviceWorker' in navigator)) {
    alert("المتصفح لا يدعم Service Worker");
    return;
  }

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
        
        // إظهار نافذة منبثقة بنص التوكين لنسخه
        prompt("نسخ الـ FCM Token الخاص بجهازك:", token);
      } else {
        logDebug("⚠️ لم يتم استخراج Token.");
      }
    })
    .catch((err) => {
      logDebug(`🔴 خطأ: ${err.message}`);
    });
}

// ==========================================
// 3. ربط الزر تلقائياً فور تحميل الصفحة
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // البحث عن الزر بأكثر من طريقة لضمان الاستجابة
  const fcmBtn = document.getElementById('btn-fcm-test') || 
                 document.getElementById('btnFcmTest') || 
                 document.querySelector('.btn-fcm-test') ||
                 document.querySelector("button[onclick*='FCM']");

  if (fcmBtn) {
    fcmBtn.onclick = testFCM;
    logDebug("✅ تم ربط زر اختبار FCM بنجاح.");
  } else {
    logDebug("⚠️ لم يتم العثور على زر FCM في الصفحة.");
  }
});
                 
