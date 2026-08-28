/* =========================================================
   HYDRO FARM
   PWA
========================================================= */

let deferredPrompt = null;


/* =========================================================
   INSTALL BUTTON
========================================================= */

const installBtn =
  document.getElementById(
    "installApp"
  );


window.addEventListener(
  "beforeinstallprompt",
  event => {

    event.preventDefault();

    deferredPrompt =
      event;


    if(installBtn)
      installBtn.hidden =
        false;

  }
);


installBtn?.addEventListener(
  "click",
  async () => {

    if(!deferredPrompt)
      return;


    deferredPrompt.prompt();


    await deferredPrompt.userChoice;


    deferredPrompt =
      null;


    installBtn.hidden =
      true;

  }
);


window.addEventListener(
  "appinstalled",
  () => {

    if(installBtn)
      installBtn.hidden =
        true;

  }
);


/* =========================================================
   SERVICE WORKER
========================================================= */

async function registerHydroServiceWorker(){

  if(
    !("serviceWorker" in navigator)
  ){

    console.warn(
      "Service Worker not supported"
    );

    return null;

  }


  try {

    const registration =
      await navigator.serviceWorker
        .register(
          "./sw.js",
          {
            scope: "./"
          }
        );


    console.log(
      "Hydro Farm Service Worker registered"
    );


    return registration;

  } catch(error){

    console.error(
      "Service Worker registration failed:",
      error
    );


    return null;

  }

}


/* =========================================================
   NOTIFICATION SETUP
========================================================= */

async function prepareHydroNotifications(){

  const registration =
    await registerHydroServiceWorker();


  if(!registration)
    return;


  /*
    ننتظر Firebase حتى يصبح جاهزًا
  */

  let attempts = 0;


  while(
    !window.HydroFirebase &&
    attempts < 50
  ){

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );


    attempts++;

  }


  if(
    !window.HydroFirebase
  ){

    console.warn(
      "Firebase not ready"
    );

    return;

  }


  /*
    في هذه المرحلة لا نطلب الإذن
    تلقائيًا عند فتح الصفحة.

    سيتم طلبه عند ضغط المستخدم
    على زر تفعيل الإشعارات.
  */

  console.log(
    "Hydro Farm FCM ready"
  );

}


/* =========================================================
   START
========================================================= */

window.addEventListener(
  "load",
  () => {

    prepareHydroNotifications();

  }
);
