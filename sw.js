const VERSION='pallanguzhi-3.28.0';
const FILES=['./','index.html','game.css','app.js','cloud-room.js','testing.js','quality.js','visual.js','rules.js','guidance.js','locale.js','physics.js','presentation.js','features.js','menu.js','clock.js','session.js','comfort.js','playback.js','reliability.js','home-background.webp','native-bridge.js','reference-board.webp','royal-board.webp','cowrie-shell.webp','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(async cache=>{for(const path of FILES){const request=new Request(new URL(path,self.registration.scope),{cache:'reload'});const response=await fetch(request);if(!response.ok)throw Error('Offline cache incomplete');await cache.put(request,response);}}));});
// Waiting worker activates after existing game tabs close; never interrupt an active match.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pallanguzhi-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(VERSION).then(c=>c.match(new URL('index.html',self.registration.scope),{ignoreSearch:true}))));return;}
 if(!FILES.some(f=>new URL(f,self.registration.scope).pathname===u.pathname))return;
 // A newer HTML release must never receive old cached JavaScript or styles.
 if(u.searchParams.has('v')&&u.searchParams.get('v')!=='3.28.0'){event.respondWith(fetch(event.request));return;}
 event.respondWith(caches.open(VERSION).then(async cache=>(await cache.match(event.request,{ignoreSearch:true}))||fetch(event.request)));
});


