const CACHE='scanner-conte-v0.4.0';
const STATIC=['./','./index.html','./assets/style.css','./assets/app.js','./assets/feed.js','./assets/lab-pilot.js','./assets/icon.svg','./data/seed.js','./manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith(fetch(req).then(res=>{
    if(res.ok&&new URL(req.url).pathname.indexOf('/data/fixtures_latest.json')===-1){
      const copy=res.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
    }
    return res;
  }).catch(()=>caches.match(req)));
});