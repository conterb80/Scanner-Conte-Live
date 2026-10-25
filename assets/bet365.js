/* Quote Bet365 da API-Football, snapshot pubblico; mai quote live garantite. */
(()=>{
'use strict';
const root=id=>document.getElementById(id);
const summary=root('bet365-summary'),list=root('bet365-list'),refresh=root('bet365-refresh');
if(!summary||!list||!refresh)return;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const time=s=>{try{return new Date(s).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '—';}};
const dec=n=>Number(n).toFixed(2).replace('.',',');
function extract(row){
 if(row.bet365?.markets?.length)return row.bet365.markets;
 // Compatibilità con la prima raccolta V0.4: solo prezzi delle strategie TEST,
 // senza inventare altre linee o la restante lavagna Bet365.
 if(/bet365/i.test(row.bookmaker||'')&&Array.isArray(row.markets)){
   return row.markets.map(m=>({
     market:m.strategy==='OVER25_CONTROLLO'?'Under/Over 2,5':'1X2',
     selection:m.strategy==='OVER25_CONTROLLO'?'Over 2,5':m.selection==='Home'?'1':m.selection==='Away'?'2':m.selection,
     odds:m.price
   }));
 }
 return[];
}
async function load(){
 refresh.disabled=true;summary.textContent='Lettura delle quote registrate…';list.innerHTML='';
 try{
  const response=await fetch('./data/odds_latest.json?fresh='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(data.schema!=='scanner-conte-odds-v1')throw Error('Formato quote non valido');
  const samples=(data.samples||[]).filter(r=>extract(r).length);
  const cutoff=Date.now();
  const future=samples.filter(r=>Date.parse(r.kickoff)>cutoff).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
  const generated=data.generated_at?Date.parse(data.generated_at):null;
  const old=generated!==null?Date.now()-generated>3*3600000:true;
  summary.innerHTML='<b>'+samples.length+' incontri con almeno una quota Bet365 attribuita dal provider</b> su '+escape(data.requested||0)+' interrogati.'+
   '<p class="muted small">Rilevazione: '+escape(data.generated_at?time(data.generated_at):'non ancora effettuata')+
   (old?' · <strong>Quote potenzialmente datate</strong>':' · Raccolta recente')+'</p>'+
   '<p class="muted small">API-Football aggiorna le quote periodicamente e la disponibilità varia. Questi prezzi non sono una garanzia della quota attuale sul tuo conto Bet365. Nessuna REAL automatica.</p>';
  if(!future.length){list.innerHTML='<div class="surface pad muted small">Nessuna quota Bet365 per incontri ancora da iniziare tra quelli campionati. Allarga il prossimo campione o verifica dopo una nuova raccolta.</div>';return;}
  list.innerHTML=future.slice(0,15).map(s=>{
   const markets=extract(s).slice(0,9);
   return '<article class="candidate"><div class="ctop"><span class="tag real">Bet365 via API</span><span class="muted small">'+escape(time(s.kickoff))+'</span></div><h3>'+escape(s.match)+'</h3><p class="muted small">'+escape(s.league)+' · Rilevata '+escape(time(s.captured_at))+'</p>'+
   '<div class="bet365-lines">'+markets.map(m=>'<div class="bet365-quote"><span>'+escape(m.market)+' · '+escape(m.selection)+'</span><b>'+escape(dec(m.odds))+'</b></div>').join('')+'</div></article>';
  }).join('');
 }catch(e){summary.innerHTML='<b>Quote non disponibili.</b><p class="muted small">'+escape(e.message)+'</p>';}
 finally{refresh.disabled=false;}
}
refresh.addEventListener('click',load);load();
})();