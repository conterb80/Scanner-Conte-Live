/* Scanner Conte LIVE — Osservatorio REAL (osservazioni virtuali, non puntate). */
(()=>{
'use strict';
const todayEl=document.getElementById('real-watch-today');
const historyEl=document.getElementById('real-watch-history');
const statusEl=document.getElementById('real-watch-status');
const refreshEl=document.getElementById('real-watch-refresh');
if(!todayEl||!historyEl||!statusEl||!refreshEl)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const dt=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';};
const euro=x=>typeof x==='number'&&Number.isFinite(x)?(x>0?'+':'')+x.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'—';
const odd=x=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const pick=r=>r.selection==='Home'?'1':r.selection==='Away'?'2':r.selection==='Draw'?'X':r.selection||'—';
const validLink=x=>String(x||'').startsWith('https://tipsaudit.com/')?x:'https://tipsaudit.com/api';
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function realRecordExists(r){
 try{
  const db=JSON.parse(localStorage.getItem('scanner-conte-live-v01')||'{}');
  return Array.isArray(db.records)&&db.records.some(x=>x.book==='real'&&x.manual===true&&
   norm(x.match)===norm(r.match)&&x.date===r.scope_day&&
   (norm(x.selection)===norm(r.selection)||norm(x.selection)===norm(pick(r)));
 }catch{return false;}
}
function result(r){
 if(r.result_status==='won')return '<span class="tag main">VINTA VIRTUALE</span>';
 if(r.result_status==='lost')return '<span class="tag lab">PERSA VIRTUALE</span>';
 return '<span class="tag">ESITO IN ATTESA</span>';
}
function card(r){
 const placed=realRecordExists(r);
 return '<article class="surface pad candidate-review-card">'+
  '<div class="candidate-review-cardtop"><span class="tag '+(r.position==='PRINCIPALE'?'real':'lab')+'">'+esc(r.position)+'</span>'+
  '<span class="muted small">'+esc(dt(r.kickoff))+'</span></div>'+
  '<h3>'+esc(r.match)+'</h3>'+
  '<p class="muted small">'+esc(r.league)+' · '+esc(r.market)+' '+esc(pick(r))+' · '+esc(r.category)+'</p>'+
  '<div class="candidate-review-price"><span>Quota di riferimento (NON Bet365)</span><strong>'+esc(odd(r.reference_odds))+'</strong></div>'+
  '<p class="muted small">Fonte: '+esc(r.reference_bookmaker)+' · acquisita '+esc(dt(r.captured_at))+
   ' · <a href="'+esc(validLink(r.reference_link))+'" target="_blank" rel="noopener noreferrer">Verifica fonte</a></p>'+
  '<p class="muted small">'+result(r)+' · '+(placed?'<strong>Giocata REAL registrata su questo dispositivo</strong>':'Non registrata come puntata REAL su questo dispositivo')+
   (r.virtual_pnl!==null&&r.virtual_pnl!==undefined?' · rendimento ipotetico su 1 €: '+esc(euro(r.virtual_pnl)):'')+'</p>'+
  '<details><summary>Qualità della valutazione</summary><p class="muted small">Ranking da quota e benchmark della stessa fonte: scostamento '+esc(odd(r.external_reference_gap_pct))+'%. Non è probabilità indipendente né valore statistico dimostrato. xG e quota Bet365 non disponibili nel feed automatico.</p></details></article>';
}
function show(today,history){
 const rows=Array.isArray(history.records)?history.records:[];
 const main=Array.isArray(today.shortlist)?today.shortlist:[];
 const others=Array.isArray(today.alternatives)?today.alternatives:[];
 const all=[...main,...others];
 const stale=today.status==='SOURCE_STALE';
 statusEl.textContent='Scansione '+dt(today.generated_at)+' · '+(stale?'Fonte non aggiornata: non ci sono nuove selezioni affidabili.':
  main.length+' candidate principali, '+others.length+' riserve.')+
  ' · Quote Bet365 e xG non ancora disponibili automaticamente.';
 todayEl.innerHTML='<p class="muted small">REAL osservate ogni giorno, senza piazzare né registrare puntate. Le selezioni sono congelate prima del via e vengono valutate anche se non le giochi. Non sostituiscono il registro REAL né il LAB.</p>'+
  (all.length?'<div class="candidate-review-grid">'+all.map(card).join('')+'</div>':
   '<p class="surface pad muted small"><strong>Nessuna nuova candidata REAL osservata oggi.</strong> Il sistema non crea quote o partite artificiali: aspetta nuovi segnali validi dalla raccolta quotidiana.</p>');
 const s=history.stats||{};
 let html='<p class="muted small">Risultati esclusivamente simulati su 1 € per candidata principale, anche quando non giocata. Non modificano il saldo REAL.</p>'+
  '<div class="candidate-hist-kpis"><div><strong>'+esc(String(s.main??0))+'</strong><span>Candidate principali</span></div>'+
  '<div><strong>'+esc(String(s.won??0))+' / '+esc(String(s.lost??0))+'</strong><span>Vinte / perse virtuali</span></div>'+
  '<div><strong>'+esc(euro(s.theoretical_pnl))+'</strong><span>Saldo simulato</span></div></div>'+
  '<p class="muted tiny">Esiti dal registro della fonte TipsAudit, non verificati indipendentemente. ROI osservato '+
   (typeof s.theoretical_roi_pct==='number'?esc(odd(s.theoretical_roi_pct))+'%':'—')+
   '. Campioni piccoli e selezione non validata: non implica profittabilità futura.</p>';
 const byDay=new Map();
 for(const r of [...rows].reverse()){if(!byDay.has(r.scope_day))byDay.set(r.scope_day,[]);byDay.get(r.scope_day).push(r);}
 let i=0;
 for(const [d,items] of byDay){
  html+='<details class="candidate-hist-day" '+(i++===0?'open':'')+'><summary>'+esc(d)+' · '+items.length+' osservazioni</summary>'+
   '<div class="candidate-hist-items">'+items.map(r=>
    '<div class="candidate-hist-item"><div class="candidate-hist-item-head"><b>'+esc(r.match)+'</b>'+result(r)+'</div>'+
    '<div class="candidate-hist-item-meta"><span>'+esc(r.position)+' · '+esc(r.market)+' '+esc(pick(r))+'</span><span>@'+esc(odd(r.reference_odds))+' · '+(realRecordExists(r)?'REAL registrata':'Non registrata REAL')+'</span></div>'+
    '<p class="muted tiny">Scelta pubblicata '+esc(dt(r.first_seen))+(r.virtual_pnl!==null&&r.virtual_pnl!==undefined?' · esito virtuale '+esc(euro(r.virtual_pnl)):'')+'</p></div>').join('')+'</div></details>';
 }
 historyEl.innerHTML=html+(rows.length?'':'<p class="muted small">Lo storico comincia alla prima scansione valida, senza ricostruire selezioni passate a posteriori.</p>');
}
async function load(){
 refreshEl.disabled=true;
 try{
  const [a,b]=await Promise.all([
   fetch('./data/real_watch_today.json?t='+Date.now(),{cache:'no-store'}),
   fetch('./data/real_watch_history.json?t='+Date.now(),{cache:'no-store'})]);
  if(!a.ok||!b.ok)throw Error('Feed non ancora pubblicato ('+a.status+'/'+b.status+')');
  const [today,history]=await Promise.all([a.json(),b.json()]);
  if(today.schema!=='scanner-conte-real-watch-today-v1'||history.schema!=='scanner-conte-real-watch-history-v1'||!Array.isArray(history.records))
   throw Error('Formato feed non riconosciuto');
  show(today,history);
 }catch(e){
  statusEl.textContent='Osservatorio in attivazione: '+String(e.message||e);
  todayEl.innerHTML='<p class="muted small">Le giocate REAL già registrate e il LAB rimangono disponibili. Le nuove osservazioni compariranno dopo la prima esecuzione automatica.</p>';
  historyEl.innerHTML='';
 }finally{refreshEl.disabled=false;}
}
refreshEl.addEventListener('click',load);
window.addEventListener('focus',()=>{if(!document.hidden)load();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
load();
})();
