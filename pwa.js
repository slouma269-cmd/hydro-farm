let deferredPrompt = null;

const installBtn =
  document.getElementById("installApp");


/* =========================================================
   PWA INSTALL
========================================================= */

window.addEventListener(
  "beforeinstallprompt",
  event => {

    event.preventDefault();

    deferredPrompt = event;

    if(installBtn)
      installBtn.hidden = false;

  }
);


installBtn?.addEventListener(
  "click",
  async () => {

    if(!deferredPrompt)
      return;

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    deferredPrompt = null;

    installBtn.hidden = true;

  }
);


window.addEventListener(
  "appinstalled",
  () => {

    if(installBtn)
      installBtn.hidden = true;

  }
);


/* =========================================================
   SERVICE WORKER
========================================================= */

let hydroServiceWorker = null;


async function registerHydroServiceWorker(){

  if(!("serviceWorker" in navigator))
    return null;

  try{

    hydroServiceWorker =
      await navigator.serviceWorker.register(
        "./sw.js",
        {
          scope: "./"
        }
      );

    console.log(
      "Hydro Farm Service Worker registered"
    );

    return hydroServiceWorker;

  }catch(error){

    console.error(
      "Service Worker registration failed:",
      error
    );

    return null;

  }

}


/* =========================================================
   PUSH NOTIFICATION PERMISSION
========================================================= */

async function requestHydroNotificationPermission(){

  if(!("Notification" in window)){

    console.warn(
      "Notifications are not supported"
    );

    return "unsupported";

  }


  if(Notification.permission === "granted"){

    console.log(
      "Notification permission already granted"
    );

    return "granted";

  }


  if(Notification.permission === "denied"){

    console.warn(
      "Notification permission denied"
    );

    return "denied";

  }


  try{

    const permission =
      await Notification.requestPermission();

    console.log(
      "Notification permission:",
      permission
    );

    return permission;

  }catch(error){

    console.error(
      "Notification permission error:",
      error
    );

    return "error";

  }

}


/* =========================================================
   CREATE PUSH SUBSCRIPTION
========================================================= */

async function createHydroPushSubscription(){

  if(!("serviceWorker" in navigator)){

    console.warn(
      "Service Worker not supported"
    );

    return null;

  }


  if(!("PushManager" in window)){

    console.warn(
      "Push API not supported"
    );

    return null;

  }


  try{

    const registration =
      await navigator.serviceWorker.ready;


    let subscription =
      await registration.pushManager.getSubscription();


    if(subscription){

      console.log(
        "Existing Push subscription found"
      );

      return subscription;

    }


    /*
      IMPORTANT:

      The VAPID public key will be supplied
      by our Push Backend later.

      We intentionally do not insert a key here yet.
    */

    console.log(
      "Push subscription requires Backend VAPID key"
    );


    return null;

  }catch(error){

    console.error(
      "Push subscription error:",
      error
    );

    return null;

  }

}


/* =========================================================
   PREPARE NOTIFICATIONS
========================================================= */

async function prepareHydroNotifications(){

  const registration =
    await registerHydroServiceWorker();


  if(!registration)
    return;


  const permission =
    await requestHydroNotificationPermission();


  if(permission !== "granted"){

    console.log(
      "Hydro Farm notifications are not enabled"
    );

    return;

  }


  /*
    At this stage the Service Worker is ready.

    The actual Push subscription will be created
    after we add the Backend VAPID public key.
  */

  console.log(
    "Hydro Farm notification system ready"
  );

}


/* =========================================================
   START PWA
========================================================= */

window.addEventListener(
  "load",
  () => {

    prepareHydroNotifications();

  }
);
