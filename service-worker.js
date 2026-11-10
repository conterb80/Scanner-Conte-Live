const CACHE='scanner-conte-v0.11.8-auto-sources';
const STATIC=['./assets/ai-app.css?v=2','./assets/ai-report-render.js?v=1','./assets/ai-app.js?v=2','./','./index.html','./assets/style.css?v=0.9.8','./assets/app.js?v=0.11.5','./assets/home-overview.js','./assets/feed.js','./assets/lab-pilot.js','./assets/daily-virtual.js','./assets/weekly-lab.js','./assets/scan-audit.js','./assets/quote-notebook.js','./assets/ai-candidate-bridge.js?v=1','./assets/candidate-review.js?v=3','./assets/candidate-history.js?v=1','./assets/real-conte-chat.js?v=3','./assets/real-conte-chat.css?v=2','./data/real_conte_chat.json','./assets/fixture-radar.js?v=2','./assets/fixture-radar.css?v=1','./assets/real-watch.js?v=1','./assets/archive-public.js?v=2','./assets/archive-lab-overview.js','./assets/install.js','./assets/bet365.js','./assets/analytics.js','./assets/provider-status.js?v=3','./assets/settings-ui.js?v=0.9.9','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./data/seed.js','./manifest.webmanifest'];
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