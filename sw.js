/* =========================================================
   HYDRO FARM
   SERVICE WORKER
   PWA + FCM + PUSH
========================================================= */

const CACHE_NAME =
  "hydro-farm-v4";


const ASSETS = [

  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase.js",
  "./pwa.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"

];


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener(
  "install",
  event => {

    console.log(
      "Hydro SW installing..."
    );


    event.waitUntil(

      caches.open(
        CACHE_NAME
      )

      .then(
        cache =>
          cache.addAll(
            ASSETS
          )
      )

      .then(
        () =>
          self.skipWaiting()
      )

    );

  }
);


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener(
  "activate",
  event => {

    console.log(
      "Hydro SW activated"
    );


    event.waitUntil(

      caches.keys()

      .then(
        keys =>

          Promise.all(

            keys

              .filter(
                key =>
                  key !==
                  CACHE_NAME
              )

              .map(
                key =>
                  caches.delete(
                    key
                  )
              )

          )

      )

      .then(
        () =>
          self.clients.claim()
      )

    );

  }
);


/* =========================================================
   FETCH
========================================================= */

self.addEventListener(
  "fetch",
  event => {

    if (
      event.request.method !==
      "GET"
    )
      return;


    /*
      لا نحاول تخزين طلبات خارج
      نطاق التطبيق.
    */

    const url =
      new URL(
        event.request.url
      );


    if (
      url.origin !==
      self.location.origin
    )
      return;


    event.respondWith(

      caches.match(
        event.request
      )

      .then(
        cached => {

          if (cached)
            return cached;


          return fetch(
            event.request
          )

          .then(
            response => {

              if (
                !response ||
                response.status !==
                200
              )
                return response;


              const copy =
                response.clone();


              caches.open(
                CACHE_NAME
              )

              .then(
                cache =>
                  cache.put(
                    event.request,
                    copy
                  )
              );


              return response;

            }
          )

          .catch(
            () =>
              caches.match(
                "./index.html"
              )
          );

        }
      )

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


    try {

      if (event.data) {

        data =
          event.data.json();

      }

    } catch (error) {

      try {

        data = {

          message:
            event.data
              ? event.data.text()
              : "تنبيه جديد من Hydro Farm"

        };

      } catch (e) {

        data = {};

      }

    }


    const title =
      data.title ||
      data.notification?.title ||
      "Hydro Farm";


    const body =
      data.body ||
      data.notification?.body ||
      data.message ||
      "يوجد تنبيه جديد في البيت المحمي";


    const severity =
      String(
        data.severity ||
        "INFO"
      ).toUpperCase();


    const options = {

      body:
        body,

      icon:
        "./icon-192.png",

      badge:
        "./icon-192.png",

      tag:
        data.tag ||
        "hydro-farm-alert",

      renotify:
        true,

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

        severity:
          severity

      }

    };


    console.log(
      "Hydro SW PUSH:",
      data
    );


    event.waitUntil(

      self.registration.showNotification(
        title,
        options
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


    const url =
      event.notification?.data?.url ||
      "./";


    event.waitUntil(

      self.clients.matchAll({

        type:
          "window",

        includeUncontrolled:
          true

      })

      .then(
        clients => {

          for (
            const client
            of clients
          ) {

            if (
              "focus"
              in client
            ) {

              client.focus();

              return client;

            }

          }


          if (
            self.clients.openWindow
          ) {

            return self.clients.openWindow(
              url
            );

          }

        }
      )

    );

  }
);


/* =========================================================
   MESSAGE FROM APP
========================================================= */

self.addEventListener(
  "message",
  event => {

    if (
      event.data?.type ===
      "HYDRO_DEBUG"
    ) {

      console.log(
        "Hydro SW:",
        event.data.message
      );

    }

  }
);
