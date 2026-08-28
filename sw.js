/* =========================================================
   HYDRO FARM SERVICE WORKER
========================================================= */

const CACHE_NAME =
    "hydro-farm-phase2-v1";


const FILES = [

    "./",

    "./index.html",

    "./style.css",

    "./app.js",

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

            caches.open(
                CACHE_NAME
            )
            .then(
                cache =>
                    cache.addAll(
                        FILES
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

        if(
            event.request.method !==
            "GET"
        )
            return;


        /*
          لا نخزن MQTT/WebSocket
        */

        if(
            event.request.url.includes(
                "hivemq.cloud"
            )
        )
            return;


        event.respondWith(

            caches.match(
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


        try{

            if(event.data)
                data =
                    event.data.json();

        }catch(error){

            data = {

                title:
                    "Hydro Farm",

                body:
                    event.data
                        ? event.data.text()
                        : "تنبيه جديد"

            };

        }


        const title =
            data.title ||
            "Hydro Farm";


        const body =
            data.body ||
            data.message ||
            "يوجد تنبيه جديد";


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

            data:{

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


        const url =
            event.notification?.data?.url ||
            "./";


        event.waitUntil(

            self.clients.matchAll({

                type:"window",

                includeUncontrolled:true

            })

            .then(
                clients => {

                    for(
                        const client
                        of clients
                    ){

                        if(
                            "focus"
                            in client
                        ){

                            client.focus();

                            return client;

                        }

                    }


                    if(
                        self.clients.openWindow
                    ){

                        return self.clients
                            .openWindow(
                                url
                            );

                    }

                }
            )

        );

    }
);
