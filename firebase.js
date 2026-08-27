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
   INITIALIZE FIREBASE
========================================================= */

const firebaseApp =
  initializeApp(firebaseConfig);


/* =========================================================
   INITIALIZE FCM
========================================================= */

let hydroMessaging = null;

try {

  hydroMessaging =
    getMessaging(firebaseApp);

  console.log(
    "Firebase Messaging initialized"
  );

  const status =
    document.getElementById("firebaseStatus");

  if(status){

    status.textContent =
      "متصل";

    status.className =
      "green";

  }

} catch(error) {

  console.error(
    "Firebase Messaging initialization failed:",
    error
  );

}


/* =========================================================
   VAPID PUBLIC KEY
========================================================= */

const HYDRO_VAPID_KEY =
  "BDDs10tlb8c7DPFmpkqHWpWNVkE3_yrqFpJ0ytLfRqmOnyKqUzn-KpSznaC5d3MhWZtg5-yQbknlG2jNCU7Knwo";


/* =========================================================
   GET FCM TOKEN
========================================================= */

async function getHydroFCMToken(){

  if(!hydroMessaging){

    console.error(
      "FCM Messaging is not initialized"
    );

    return null;

  }


  try{

    const registration =
      await navigator.serviceWorker.ready;


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


    if(token){

      console.log(
        "Hydro Farm FCM Token:",
        token
      );


      const status =
        document.getElementById(
          "fcmTokenStatus"
        );


      if(status){

        status.textContent =
          "مسجل";

        status.className =
          "green";

      }


      const fcmStatus =
        document.getElementById(
          "fcmStatus"
        );


      if(fcmStatus){

        fcmStatus.textContent =
          "مفعّل";

        fcmStatus.className =
          "green";

      }


      return token;

    }


    console.warn(
      "No FCM registration token available"
    );

    return null;


  }catch(error){

    console.error(
      "FCM token error:",
      error
    );

    return null;

  }

}


/* =========================================================
   FOREGROUND MESSAGES
========================================================= */

if(hydroMessaging){

  onMessage(
    hydroMessaging,
    payload => {

      console.log(
        "Hydro Farm FCM message:",
        payload
      );


      const title =
        payload.notification?.title ||
        "Hydro Farm";


      const body =
        payload.notification?.body ||
        "تنبيه جديد من النظام";


      if(
        typeof showHydroNotification ===
        "function"
      ){

        showHydroNotification(
          title,
          body
        );

      }


      if(
        typeof addHydroAlert ===
        "function"
      ){

        addHydroAlert(
          title,
          body
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
    getHydroFCMToken

};
