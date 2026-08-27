const CACHE = "hydro-farm-v3-push";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./pwa.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* =========================================================
   INSTALL
========================================================= */

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );

});


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()
      .then(keys =>

        Promise.all(

          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))

        )

      )
      .then(() => self.clients.claim())

  );

});


/* =========================================================
   FETCH
========================================================= */

self.addEventListener("fetch", event => {

  if(event.request.method !== "GET")
    return;

  event.respondWith(

    caches.match(event.request)
      .then(cached => {

        if(cached)
          return cached;

        return fetch(event.request)
          .then(response => {

            const copy = response.clone();

            caches.open(CACHE)
              .then(cache =>
                cache.put(event.request, copy)
              );

            return response;

          })
          .catch(() =>
            caches.match("./index.html")
          );

      })

  );

});


/* =========================================================
   PUSH NOTIFICATION
========================================================= */

self.addEventListener("push", event => {

  let data = {};

  try {

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
