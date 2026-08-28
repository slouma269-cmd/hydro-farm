/* =========================================================
   HYDRO FARM
   SERVICE WORKER
   PWA + FCM
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

    event.waitUntil(

      caches
        .open(CACHE_NAME)
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

    event.waitUntil(

      caches
        .keys()
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

    if(
      event.request.method !==
      "GET"
    )
      return;


    /*
      لا نعترض طلبات MQTT/WebSocket.
    */

    if(
      event.request.url.startsWith(
        "wss://"
      )
    )
      return;


    event.respondWith(

      caches
        .match(
          event.request
        )
        .then(
          cached => {

            if(cached)
              return cached;


            return fetch(
              event.request
            )
            .then(
              response => {

                if(
                  !response ||
                  response.status !== 200 ||
                  response.type ===
                    "opaque"
                ){

                  return response;

                }


                const copy =
                  response.clone();


                caches
                  .open(
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
   FCM / PUSH
========================================================= */

self.addEventListener(
  "push",
  event => {

    let data = {};


    try {

      if(event.data){

        data =
          event.data.json();

      }

    } catch(error){

      console.warn(
        "Push JSON parsing failed"
      );


      try {

        data = {

          body:
            event.data
              ? event.data.text()
              : "تنبيه جديد من Hydro Farm"

        };

      } catch(e){

        data = {};

      }

    }


    const notification =
      data.notification ||
      {};


    const dataPayload =
      data.data ||
      {};


    const title =
      notification.title ||
      data.title ||
      dataPayload.title ||
      "Hydro Farm";


    const body =
      notification.body ||
      data.body ||
      data.message ||
      dataPayload.body ||
      dataPayload.message ||
      "يوجد تنبيه جديد في البيت المحمي";


    const severity =
      String(
        data.severity ||
        dataPayload.severity ||
        "INFO"
      ).toUpperCase();


    const url =
      data.url ||
      dataPayload.url ||
      "./";


    const options = {

      body:
        body,

      icon:
        "./icon-192.png",

      badge:
        "./icon-192.png",

      tag:
        data.tag ||
        dataPayload.tag ||
        "hydro-farm-alert",

      renotify:
        true,

      data: {

        url:
          url,

        greenhouse:
          data.greenhouse ||
          dataPayload.greenhouse ||
          "GH001",

        type:
          data.type ||
          dataPayload.type ||
          "ALERT",

        severity:
          severity

      }

    };


    if(
      severity === "HIGH" ||
      severity === "CRITICAL"
    ){

      options.requireInteraction =
        true;

    }


    event.waitUntil(

      self.registration
        .showNotification(
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


    const targetUrl =
      event.notification?.data?.url ||
      "./";


    event.waitUntil(

      self.clients
        .matchAll(
          {
            type: "window",
            includeUncontrolled: true
          }
        )
        .then(
          clients => {

            /*
              فتح التطبيق الموجود مسبقًا
            */

            for(
              const client of clients
            ){

              if(
                "focus" in client
              ){

                client.focus();

                /*
                  إرسال رسالة إلى التطبيق
                */

                client.postMessage({

                  type:
                    "HYDRO_NOTIFICATION_CLICK",

                  url:
                    targetUrl

                });


                return client;

              }

            }


            /*
              فتح التطبيق إذا لم يكن موجودًا
            */

            if(
              self.clients.openWindow
            ){

              return self.clients
                .openWindow(
                  targetUrl
                );

            }

          }
        )

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
