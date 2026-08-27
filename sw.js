/* =========================================================
   HYDRO FARM
   Service Worker
   PWA + Push Notifications
========================================================= */


/* =========================================================
   CACHE
========================================================= */

const CACHE_NAME =
  "hydro-farm-v4";


const ASSETS = [

  "./",

  "./index.html",

  "./style.css",

  "./app.js",

  "./pwa.js",

  "./firebase.js",

  "./manifest.json",

  "./icons/icon-192.png",

  "./icons/icon-512.png"

];


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE_NAME)
        .then(cache => {

          return cache.addAll(
            ASSETS
          );

        })
        .then(() => {

          return self.skipWaiting();

        })

    );

  }
);


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(keys => {

          return Promise.all(

            keys
              .filter(
                key =>
                  key !== CACHE_NAME
              )
              .map(
                key =>
                  caches.delete(key)
              )

          );

        })
        .then(() => {

          return self.clients.claim();

        })

    );

  }
);


/* =========================================================
   FETCH
========================================================= */

self.addEventListener(
  "fetch",
  event => {

    if(
      event.request.method !==
      "GET"
    ){

      return;

    }


    /*
      Do not cache external resources.
      MQTT and Firebase must remain online.
    */

    const url =
      new URL(
        event.request.url
      );


    if(
      url.origin !==
      self.location.origin
    ){

      return;

    }


    event.respondWith(

      caches
        .match(event.request)
        .then(cached => {

          if(cached){

            return cached;

          }


          return fetch(
            event.request
          )
          .then(response => {

            if(
              !response ||
              response.status !== 200 ||
              response.type !==
                "basic"
            ){

              return response;

            }


            const copy =
              response.clone();


            caches
              .open(CACHE_NAME)
              .then(cache => {

                cache.put(
                  event.request,
                  copy
                );

              });


            return response;

          })
          .catch(() => {

            return caches.match(
              "./index.html"
            );

          });

        })

    );

  }
);


/* =========================================================
   PUSH
========================================================= */

self.addEventListener(
  "push",
  event => {

    let data = {};


    try{

      if(event.data){

        data =
          event.data.json();

      }

    }catch(error){

      try{

        data = {

          message:
            event.data
              ? event.data.text()
              : "تنبيه جديد من Hydro Farm"

        };

      }catch(e){

        data = {};

      }

    }


    const notification =
      data.notification ||
      {};


    const customData =
      data.data ||
      data;


    const title =
      notification.title ||
      customData.title ||
      "🌱 Hydro Farm";


    const body =
      notification.body ||
      customData.body ||
      customData.message ||
      "يوجد تنبيه جديد في البيت المحمي";


    const severity =
      String(
        customData.severity ||
        "INFO"
      ).toUpperCase();


    let requireInteraction =
      false;


    if(
      severity === "HIGH" ||
      severity === "CRITICAL"
    ){

      requireInteraction =
        true;

    }


    const notificationOptions = {

      body:
        body,

      icon:
        "./icons/icon-192.png",

      badge:
        "./icons/icon-192.png",

      tag:
        customData.tag ||
        "hydro-farm-alert",

      renotify:
        true,

      requireInteraction:
        requireInteraction,

      vibrate:
        [200,100,200],

      data: {

        url:
          customData.url ||
          "./",

        greenhouse:
          customData.greenhouse ||
          "GH001",

        type:
          customData.type ||
          "ALERT",

        severity:
          severity

      }

    };


    event.waitUntil(

      self.registration.showNotification(

        title,

        notificationOptions

      )

    );

  }
);


/* =========================================================
   NOTIFICATION CLICK
========================================================= */

self.addEventListener(
  "notificationclick",
  event => {

    event.notification.close();


    const notificationData =
      event.notification.data ||
      {};


    const url =
      notificationData.url ||
      "./";


    event.waitUntil(

      self.clients
        .matchAll({

          type:
            "window",

          includeUncontrolled:
            true

        })

        .then(clients => {

          /*
            If Hydro Farm is already open,
            focus it.
          */

          for(
            const client of clients
          ){

            if(
              "focus" in client
            ){

              return client.focus();

            }

          }


          /*
            Otherwise open Hydro Farm.
          */

          if(
            self.clients.openWindow
          ){

            return self.clients.openWindow(
              url
            );

          }

        })

    );

  }
);


/* =========================================================
   NOTIFICATION CLOSE
========================================================= */

self.addEventListener(
  "notificationclose",
  event => {

    console.log(
      "Hydro Farm notification closed"
    );

  }
);
    if(event.data){
      data = event.data.json();
    }

  } catch(error) {

    try {

      data = {
        message: event.data
          ? event.data.text()
          : "تنبيه جديد من Hydro Farm"
      };

    } catch(e) {

      data = {};

    }

  }


  const title =
    data.title ||
    "Hydro Farm";

  const body =
    data.body ||
    data.message ||
    "يوجد تنبيه جديد في البيت المحمي";


  const severity =
    String(data.severity || "INFO")
      .toUpperCase();


  const notificationOptions = {

    body: body,

    icon: "./icons/icon-192.png",

    badge: "./icons/icon-192.png",

    tag:
      data.tag ||
      "hydro-farm-alert",

    renotify: true,

    requireInteraction:
      severity === "HIGH" ||
      severity === "CRITICAL",

    data: {

      url:
        data.url ||
        "./",

      greenhouse:
        data.greenhouse ||
        "GH001",

      type:
        data.type ||
        "ALERT",

      severity:
        severity

    }

  };


  event.waitUntil(

    self.registration.showNotification(
      title,
      notificationOptions
    )

  );

});


/* =========================================================
   NOTIFICATION CLICK
========================================================= */

self.addEventListener(
  "notificationclick",
  event => {

    event.notification.close();

    const url =
      event.notification?.data?.url ||
      "./";


    event.waitUntil(

      self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      })

      .then(clients => {

        for(const client of clients){

          if(
            "focus" in client
          ){

            client.focus();

            return client;

          }

        }

        if(
          self.clients.openWindow
        ){

          return self.clients.openWindow(url);

        }

      })

    );

  }
);


/* =========================================================
   NOTIFICATION CLOSE
========================================================= */

self.addEventListener(
  "notificationclose",
  event => {

    // لا نحتاج إلى إجراء إضافي حاليًا.

  }
);حتاج إلى إجراء إضافي حاليًا.

  }
);
