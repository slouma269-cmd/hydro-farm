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

// طلب إذن الإشعارات واستخراج الـ FCM Token وقراءته بسهولة
function requestNotificationPermission() {
  logDebug("جاري طلب إذن الإشعارات...");
  
  Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
      logDebug('🟢 تم منح إذن الإشعارات!');
      
      messaging.getToken({ vapidKey: vapidKey }).then((currentToken) => {
        if (currentToken) {
          logDebug(`🔑 FCM Token: ${currentToken.substring(0, 10)}...${currentToken.substring(currentToken.length - 5)}`);
          
          // حفظ التوكين محلياً
          localStorage.setItem('fcm_token', currentToken);
          
          // نسـخ الـ Token تلقائياً لعجلة الحافظة وإظهار تنبيه للمستخدم
          navigator.clipboard.writeText(currentToken).then(() => {
            alert("✅ تم نسـخ الـ FCM Token الكامل تلقائياً إلى حافظة هاتفك!\nيمكنك الآن لصقه مباشرة في Firebase Console.");
          }).catch(() => {
            // في حال عدم دعم النسخ التلقائي يتم عرضه في نافذة لنسخه يدوياً
            prompt("نسخ الـ FCM Token الخاص بجهازك:", currentToken);
          });

        } else {
          logDebug('⚠️ لم يتم استخراج Token. تحقق من إعدادات FCM.');
        }
      }).catch((err) => {
        logDebug(`🔴 خطأ أثناء استخراج Token: ${err.message}`);
      });

    } else {
      logDebug('🔴 تم رفض إذن الإشعارات.');
    }
  });
}


// 3. استقبال الإشعارات والتطبيق مفتوح
messaging.onMessage((payload) => {
  logDebug(`🔔 إشعار جديد: ${payload.notification?.title || 'تنبيه'}`);
  addAlertToUI(payload.notification?.title || 'تنبيه', payload.notification?.body || '', 'red');
  alert(`🔔 ${payload.notification?.title}\n${payload.notification?.body}`);
});

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
