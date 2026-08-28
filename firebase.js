/* =========================================================
   HYDRO FARM
   FIREBASE + FCM + MOBILE DEBUG
========================================================= */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getMessaging,
  getToken,
  onMessage
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {

  apiKey:
    "AIzaSyA_x9UwCimSHYHszSbZU6Fj5o2Q_yGO4xU",

  authDomain:
    "hydro-farm-gh001.firebaseapp.com",

  projectId:
    "hydro-farm-gh001",

  storageBucket:
    "hydro-farm-gh001.firebasestorage.app",

  messagingSenderId:
    "231547739134",

  appId:
    "1:231547739134:web:f9e7c4104c1cd62cd6feaf",

  measurementId:
    "G-G79WT4R8DX"

};


/* =========================================================
   DEBUG
========================================================= */

function firebaseDebug(message, type = "info") {

  console.log("[Firebase]", message);

  window.dispatchEvent(
    new CustomEvent("hydro-debug", {
      detail: {
        source: "Firebase",
        message: message,
        type: type,
        time: new Date().toLocaleTimeString()
      }
    })
  );

}


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

let firebaseApp = null;
let hydroMessaging = null;

try {

  firebaseApp =
    initializeApp(firebaseConfig);

  firebaseDebug(
    "Firebase تم تهيئته بنجاح",
    "success"
  );

} catch (error) {

  console.error(error);

  firebaseDebug(
    "فشل تهيئة Firebase: " + error.message,
    "error"
  );

}


/* =========================================================
   INITIALIZE FCM
========================================================= */

if (firebaseApp) {

  try {

    hydroMessaging =
      getMessaging(firebaseApp);

    firebaseDebug(
      "Firebase Cloud Messaging تم تهيئته",
      "success"
    );

  } catch (error) {

    console.error(error);

    firebaseDebug(
      "فشل تهيئة FCM: " + error.message,
      "error"
    );

  }

}


/* =========================================================
   VAPID PUBLIC KEY
========================================================= */

const HYDRO_VAPID_KEY =
  "BDDs10tlb8c7DPFmpkqHWpWNVkE3_yrqFpJ0ytLfRqmOnyKqUzn-KpSznaC5d3MhWZtg5-yQbknlG2jNCU7Knwo";


/* =========================================================
   GET FCM TOKEN
========================================================= */

async function getHydroFCMToken() {

  if (!hydroMessaging) {

    firebaseDebug(
      "FCM Messaging غير متوفر",
      "error"
    );

    return null;

  }


  if (
    !("Notification" in window)
  ) {

    firebaseDebug(
      "Notifications API غير مدعوم",
      "error"
    );

    return null;

  }


  if (
    Notification.permission !==
    "granted"
  ) {

    firebaseDebug(
      "صلاحية الإشعارات ليست granted: " +
      Notification.permission,
      "warning"
    );

    return null;

  }


  try {

    firebaseDebug(
      "انتظار Service Worker...",
      "info"
    );


    const registration =
      await navigator.serviceWorker.ready;


    firebaseDebug(
      "Service Worker جاهز",
      "success"
    );


    const token =
      await getToken(
        hydroMessaging,
        {

          vapidKey:
            HYDRO_VAPID_KEY,

          serviceWorkerRegistration:
            registration

        }
      );


    if (token) {

      firebaseDebug(
        "تم الحصول على FCM Token بنجاح",
        "success"
      );


      window.dispatchEvent(
        new CustomEvent(
          "hydro-fcm-token",
          {
            detail: token
          }
        )
      );


      return token;

    }


    firebaseDebug(
      "لم يتم الحصول على FCM Token",
      "warning"
    );

    return null;


  } catch (error) {

    console.error(
      "FCM token error:",
      error
    );

    firebaseDebug(
      "خطأ FCM Token: " +
      error.message,
      "error"
    );

    return null;

  }

}


/* =========================================================
   FOREGROUND MESSAGE
========================================================= */

if (hydroMessaging) {

  onMessage(
    hydroMessaging,
    payload => {

      console.log(
        "FCM message:",
        payload
      );


      firebaseDebug(
        "تم استقبال رسالة FCM",
        "success"
      );


      const title =
        payload.notification?.title ||
        "Hydro Farm";


      const body =
        payload.notification?.body ||
        "تنبيه جديد من النظام";


      if (
        typeof showHydroNotification ===
        "function"
      ) {

        showHydroNotification(
          title,
          body
        );

      }


      if (
        typeof addHydroAlert ===
        "function"
      ) {

        addHydroAlert(
          title,
          body,
          "INFO"
        );

      }

    }
  );

}


/* =========================================================
   EXPORT
========================================================= */

window.HydroFirebase = {

  app:
    firebaseApp,

  messaging:
    hydroMessaging,

  getFCMToken:
    getHydroFCMToken,

  vapidKey:
    HYDRO_VAPID_KEY

};


firebaseDebug(
  "firebase.js جاهز",
  "success"
);
