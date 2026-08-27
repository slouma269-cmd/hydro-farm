const CACHE="hydro-farm-phase2-v6";
const ASSETS=["./","./index.html","./style.css","./app.js","./manifest.json","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
    const copy=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,copy));return r;
  }).catch(()=>caches.match("./index.html"))));
});
self.addEventListener("push",e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data?e.data.text():"تنبيه جديد"}}
  e.waitUntil(self.registration.showNotification(d.title||"Hydro Farm",{body:d.body||d.message||"تنبيه جديد من GH001",icon:"./icons/icon-192.png",badge:"./icons/icon-192.png",tag:d.tag||"hydro-farm-alert",data:{url:d.url||"./"}}));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if("focus" in c)return c.focus();}
    return self.clients.openWindow(e.notification.data?.url||"./");
  }));
});