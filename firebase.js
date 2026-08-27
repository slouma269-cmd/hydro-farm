/* =========================================================
   HYDRO FARM
   Firebase + Firebase Cloud Messaging
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
   HYDRO FARM FCM VAPID PUBLIC KEY
========================================================= */

const HYDRO_VAPID_KEY =
  "BDDs10tlb8c7DPFmpkqHWpWNVkE3_yrqFpJ0ytLfRqmOnyKqUzn-KpSznaC5d3MhWZtg5-yQbknlG2jNCU7Knwo";


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const firebaseApp =
  initializeApp(firebaseConfig);


let hydroMessaging = null;

try {

  hydroMessaging =
    getMessaging(firebaseApp);

  console.log(
    "Hydro Farm: Firebase Messaging initialized"
  );

} catch(error) {

  console.error(
    "Hydro Farm: Firebase Messaging initialization failed",
    error
  );

}


/* =========================================================
   SERVICE WORKER
========================================================= */

async function getHydroServiceWorker(){

  if(!("serviceWorker" in navigator)){

    console.warn(
      "Service Worker is not supported"
    );

    return null;

  }

  try{

    const registration =
      await navigator.serviceWorker.register(
        "./sw.js",
        {
          scope: "./"
        }
      );

    console.log(
      "Hydro Farm Service Worker registered"
    );

    return registration;

  }catch(error){

    console.error(
      "Service Worker registration failed",
      error
    );

    return null;

  }

}


/* =========================================================
   NOTIFICATION PERMISSION
========================================================= */

async function requestHydroNotificationPermission(){

  if(!("Notification" in window)){

    console.warn(
      "Browser does not support notifications"
    );

    return "unsupported";

  }


  if(Notification.permission === "granted"){

    return "granted";

  }


  if(Notification.permission === "denied"){

    console.warn(
      "Notification permission was denied"
    );

    return "denied";

  }


  try{

    const permission =
      await Notification.requestPermission();

    console.log(
      "Hydro Farm notification permission:",
      permission
    );

    return permission;

  }catch(error){

    console.error(
      "Notification permission error",
      error
    );

    return "error";

  }

}


/* =========================================================
   GET FCM TOKEN
========================================================= */

async function getHydroFCMToken(){

  if(!hydroMessaging){

    console.error(
      "FCM Messaging is not available"
    );

    return null;

  }


  try{

    const registration =
      await getHydroServiceWorker();


    if(!registration)
      return null;


    const permission =
      await requestHydroNotificationPermission();


    if(permission !== "granted"){

      updateFCMStatus(
        "الإشعارات غير مفعلة"
      );

      return null;

    }


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


    if(!token){

      console.warn(
        "FCM token was not generated"
      );

      updateFCMStatus(
        "لم يتم إنشاء Token"
      );

      return null;

    }


    console.log(
      "Hydro Farm FCM Token:",
      token
    );


    localStorage.setItem(
      "hydro_fcm_token",
      token
    );


    updateFCMStatus(
      "مفعّل"
    );


    /*
      The token is intentionally stored locally.

      Later we can send it to Firebase/Firestore
      or another backend for multi-device support.
    */


    return token;

  }catch(error){

    console.error(
      "Hydro Farm FCM Token error:",
      error
    );

    updateFCMStatus(
      "خطأ في FCM"
    );

    return null;

  }

}


/* =========================================================
   UPDATE FCM STATUS IN UI
========================================================= */

function updateFCMStatus(text){

  const fcmStatus =
    document.getElementById("fcmStatus");

  if(fcmStatus){

    fcmStatus.textContent =
      text;

    if(text === "مفعّل"){

      fcmStatus.className =
        "green";

    }else{

      fcmStatus.className =
        "";

    }

  }


  const tokenStatus =
    document.getElementById(
      "fcmTokenStatus"
    );

  if(tokenStatus){

    tokenStatus.textContent =
      text;

    if(text === "مفعّل"){

      tokenStatus.className =
        "green";

    }

  }

}


/* =========================================================
   FOREGROUND FCM MESSAGE
========================================================= */

function startHydroForegroundMessages(){

  if(!hydroMessaging)
    return;


  onMessage(
    hydroMessaging,
    payload => {

      console.log(
        "Hydro Farm FCM foreground message:",
        payload
      );


      const notification =
        payload.notification || {};


      const data =
        payload.data || {};


      const title =
        notification.title ||
        data.title ||
        "Hydro Farm";


      const body =
        notification.body ||
        data.body ||
        data.message ||
        "يوجد تنبيه جديد من البيت المحمي";


      const severity =
        String(
          data.severity ||
          "INFO"
        ).toUpperCase();


      if(
        typeof window.showHydroNotification ===
        "function"
      ){

        window.showHydroNotification(
          title,
          body,
          severity
        );

      }


      if(
        typeof window.addHydroAlert ===
        "function"
      ){

        window.addHydroAlert(
          title,
          body,
          severity
        );

      }

    }
  );

}


/* =========================================================
   PREPARE FCM
========================================================= */

async function prepareHydroFCM(){

  const registration =
    await getHydroServiceWorker();


  if(!registration)
    return null;


  startHydroForegroundMessages();


  /*
    We do NOT force the permission immediately
    when the page loads.

    The user can activate notifications through
    the notification/bell button.
  */


  if(
    "Notification" in window &&
    Notification.permission === "granted"
  ){

    return await getHydroFCMToken();

  }


  return null;

}


/* =========================================================
   BELL BUTTON
========================================================= */

function setupHydroNotificationButton(){

  const bell =
    document.getElementById("bell");


  if(!bell)
    return;


  bell.addEventListener(
    "click",
    async () => {

      const permission =
        await requestHydroNotificationPermission();


      if(permission === "granted"){

        await getHydroFCMToken();


        if(
          typeof window.showHydroToast ===
          "function"
        ){

          window.showHydroToast(
            "تم تفعيل إشعارات Hydro Farm"
          );

        }

      }

      else if(permission === "denied"){

        if(
          typeof window.showHydroToast ===
          "function"
        ){

          window.showHydroToast(
            "الإشعارات محظورة من إعدادات المتصفح"
          );

        }

      }

    }
  );

}


/* =========================================================
   GLOBAL API
========================================================= */

window.HydroFirebase = {

  app:
    firebaseApp,

  messaging:
    hydroMessaging,

  vapidKey:
    HYDRO_VAPID_KEY,

  getFCMToken:
    getHydroFCMToken,

  requestPermission:
    requestHydroNotificationPermission,

  prepare:
    prepareHydroFCM

};


/* =========================================================
   START
========================================================= */

window.addEventListener(
  "load",
  () => {

    setupHydroNotificationButton();

    prepareHydroFCM();

  }
);
