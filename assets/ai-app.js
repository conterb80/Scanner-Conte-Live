(()=>{
 'use strict';
 const ORIGIN='http://127.0.0.1:39765',CONNECTION='scanner-conte-ai-connection-v1',CACHE='scanner-conte-ai-cache-v1',PENDING='scanner-conte-ai-pending-v1';
 const el=id=>document.getElementById(id),date=t=>t?new Date(t).toLocaleString('it-IT'):'—';let endpoint=null,popup=null,nonce=null,shown='',timer,lastContact=null;
 const add=(parent,tag,value)=>{const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;};
 function validEndpoint(value){try{const u=new URL(value);return u.origin===ORIGIN&&/^\/[A-Za-z0-9_-]{32}\/integration\.json$/.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password;}catch{return false;}}
 function validPayload(p){try{return p?.schema==='scanner-conte-app-bridge-v1'&&typeof p.status==='object'&&p.status!==null&&(!p.report||(p.report.schema==='scanner-conte-ai-integration-v1'&&p.report.evidence?.status==='WEB_SEARCH_CONFIRMED'&&typeof p.report.evidence.text==='string'&&Array.isArray(p.report.input?.items)))&&JSON.stringify(p).length<400000;}catch{return false;}}
 function render(p,live){
  if(!validPayload(p))throw Error('Rapporto locale non valido');const s=p.status,r=p.report;
  const active=live&&s.phase!=='STOPPED'&&Date.now()-Date.parse(s.last_heartbeat_at||0)<90000;
  el('ai-connection-state').textContent=active?'Motore collegato sul telefono':live?'Motore da controllare in Termux':'Copia salvata · collegamento da verificare';
  el('ai-connection-state').className=active?'ai-badge connected':'ai-badge';
  el('ai-times').textContent='Ultimo controllo: '+date(s.last_check_at)+' · Prossimo: '+date(s.next_check_at)+' · Collegamento: '+date(lastContact);
  el('ai-home-state').textContent=active?'IA collegata · ultimo rapporto '+date(r?.generated_at):r?'Rapporto salvato del '+date(r.generated_at)+' · verifica collegamento':'IA locale · collega il motore per leggere i rapporti';
  el('ai-engine-error').textContent=s.error||'';
  if(!r){el('ai-report-heading').textContent='Nessun rapporto ancora disponibile';return;}
  el('ai-report-age').textContent='Prodotto il '+date(r.generated_at)+'. Le quote sono acquisizioni storiche; questo rapporto non è un controllo live. Ambito: '+(r.input.scope||'rapporto di una versione precedente, controlla le date degli eventi')+'.';
  if(shown!==r.run_id){shown=r.run_id;el('ai-report-heading').textContent='Verifica IA del '+date(r.generated_at);el('ai-observations').replaceChildren();
   for(const item of r.input.items.slice(0,3)){const d=add(el('ai-observations'),'div','');add(d,'strong',item.match||'Evento');add(d,'p','Acquisizione '+date(item.captured_at)+' · quota storica '+(item.reference_odds??'non disponibile')+' ('+(item.reference_bookmaker||'fonte non indicata')+').');}
   window.ScannerAIReport.render(r.evidence,el('ai-report-body'));
   el('ai-report-meta').textContent=(r.model||'')+' · '+(r.evidence.completed_search_actions||0)+' ricerche · '+(r.evidence.citation_count||0)+' citazioni. La verifica del calendario non dimostra un vantaggio quantitativo.';
  }
 }
 function accept(p){lastContact=new Date().toISOString();render(p,true);try{localStorage.setItem(CACHE,JSON.stringify({payload:p,last_contact:lastContact}));}catch{}el('ai-feedback').textContent='Rapporti e stato letti dal motore. Nessuna nuova richiesta IA viene avviata da questa pagina.';}
 async function refresh(){if(!endpoint)return;try{const r=await fetch(endpoint,{mode:'cors',cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();accept(await r.json());}catch{el('ai-connection-state').textContent='Collegamento non raggiungibile';el('ai-connection-state').className='ai-badge';el('ai-feedback').textContent='Apri Termux e avvia scanner-conte. Se il browser blocca il collegamento locale, usa Collega / aggiorna IA per trasferire il rapporto.';el('ai-home-state').textContent='Collegamento IA da verificare · ultimo rapporto salvato disponibile';}}
 function connect(){
  if(popup&&!popup.closed){popup.focus();return;}
  nonce=crypto.randomUUID();try{localStorage.setItem(PENDING,JSON.stringify({nonce,at:Date.now()}));}catch{}
  popup=window.open(ORIGIN+'/connect?state='+nonce,'scanner-ia-'+nonce,'popup');
  if(!popup){el('ai-feedback').textContent='Consenti l’apertura della pagina di collegamento, poi riprova.';return;}
  el('ai-feedback').textContent='Apri la pagina locale e conferma il collegamento. Se non si apre, avvia scanner-conte in Termux.';
  clearTimeout(timer);timer=setTimeout(()=>{el('ai-feedback').textContent='Collegamento non completato. Controlla che il motore v1.3 sia avviato e riprova nello stesso browser.';if(popup&&!popup.closed)popup.close();popup=null;nonce=null;},90000);
 }
 window.addEventListener('message',e=>{
  if(e.origin!==ORIGIN||!popup||e.source!==popup||!nonce||e.data?.nonce!==nonce)return;
  if(e.data.type==='scanner-ai-ready'){popup.postMessage({type:'scanner-ai-request',nonce},ORIGIN);return;}
  if(e.data.type!=='scanner-ai-connected'||!validEndpoint(e.data.endpoint)||!validPayload(e.data.payload))return;
  endpoint=e.data.endpoint;try{localStorage.setItem(CONNECTION,endpoint);}catch{}
  accept(e.data.payload);try{localStorage.removeItem(PENDING);}catch{}clearTimeout(timer);popup.postMessage({type:'scanner-ai-received',nonce},ORIGIN);popup=null;nonce=null;refresh();
 });
 el('ai-connect').addEventListener('click',connect);el('ai-refresh').addEventListener('click',()=>endpoint?refresh():connect());
 el('ai-disconnect').addEventListener('click',()=>{endpoint=null;shown='';lastContact=null;try{localStorage.removeItem(CONNECTION);localStorage.removeItem(CACHE);}catch{}el('ai-report-body').replaceChildren();el('ai-observations').replaceChildren();el('ai-report-heading').textContent='Collegamento rimosso da questo browser';el('ai-report-age').textContent='';el('ai-report-meta').textContent='';el('ai-times').textContent='';el('ai-connection-state').textContent='Non collegato';el('ai-home-state').textContent='IA locale · collega il motore';});
 try{const saved=localStorage.getItem(CONNECTION);if(validEndpoint(saved))endpoint=saved;const cache=JSON.parse(localStorage.getItem(CACHE)||'null');if(cache&&validPayload(cache.payload)){lastContact=cache.last_contact;render(cache.payload,false);}}catch{}
 if(location.hash.startsWith('#scanner-ia=')){
  const fragment=location.hash;history.replaceState(null,'',location.pathname+location.search);
  try{const data=JSON.parse(decodeURIComponent(fragment.slice(12))),pending=JSON.parse(localStorage.getItem(PENDING)||'null');
   if(!pending||Date.now()-pending.at>300000||data.nonce!==pending.nonce||!validEndpoint(data.endpoint)||!validPayload(data.payload))throw Error();
   endpoint=data.endpoint;localStorage.setItem(CONNECTION,endpoint);localStorage.removeItem(PENDING);accept(data.payload);if(typeof window.goto==='function')window.goto('ai');
  }catch{el('ai-feedback').textContent='Ritorno non riconosciuto o scaduto. Riprova Collega IA nello stesso browser.';}
 }
 if(endpoint)refresh();setInterval(()=>{if(endpoint&&!document.hidden)refresh();},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&endpoint)refresh();});
})();
