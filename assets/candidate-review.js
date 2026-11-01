/* Scanner Conte LIVE — rapporto automatico sperimentale CORE/VALUE.
 * SOLO lettura di data/candidate_review.json; non registra né piazza giocate REAL.
 * Le quote Bet365 annotate dall'utente restano in localStorage nel dispositivo.
 */
(()=>{
'use strict';
const panel=document.getElementById('candidate-review-panel');
const status=document.getElementById('candidate-review-status');
const btn=document.getElementById('candidate-review-refresh');
if(!panel||!status||!btn)return;
const KEY='scanner-conte-candidate-review-odds-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const num=n=>typeof n==='number'&&Number.isFinite(n);
const validOdds=x=>{const n=Number(String(x??'').replace(',','.'));return Number.isFinite(n)&&n>=1.01&&n<=200?n:null;};
const fmt=n=>num(n)?n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const date=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?
 d.toLocaleString('it-IT',{timeZone:'Europe/Rome',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Data non valida';};
const minutesUntil=s=>(Date.parse(s||'')-Date.now())/60000;
const quoteFreshness=s=>{const m=(Date.now()-Date.parse(s||''))/60000;if(!Number.isFinite(m))return 'orario sconosciuto';if(m<60)return 'meno di 1 ora';return m<1440?Math.floor(m/60)+' h':Math.floor(m/1440)+' giorni';};
let feed=null,error=null;
let saved={};
try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))saved=value;}catch{}
function store(){
 try{localStorage.setItem(KEY,JSON.stringify(saved));return true;}
 catch(e){window.alert('Impossibile salvare sul dispositivo. Il rapporto automatico resta consultabile.');return false;}
}
const readable=s=>String(s||'').replace(/[<>]/g,'').slice(0,220);
function comparison(record){
 const raw=saved[record.id]?.quote;
 const actual=validOdds(raw);
 if(actual===null)return '<span class="muted small">Inserisci la quota Bet365 che hai visto per confrontarla con il riferimento esterno.</span>';
 const base=record.reference_odds,fair=record.external_fair_odds;
 const diff=num(base)&&base>0?100*(actual/base-1):null;
 const gap=num(fair)&&fair>0?100*(actual/fair-1):null;
 return '<div class="candidate-compare">'+
  '<span>Rispetto alla quota registrata: <b class="'+(diff>=0?'positive':'negative')+'">'+
   (diff>0?'+':'')+fmt(diff)+'%</b></span>'+
  '<span>Rispetto alla stima equa della fonte: <b class="'+(gap>=0?'positive':'negative')+'">'+
   (gap>0?'+':'')+fmt(gap)+'%</b></span>'+
  '</div><p class="muted tiny">Differenze descrittive, non una stima indipendente di valore. Nessuna soglia approva automaticamente una puntata.</p>';
}
function row(record,secondary=false){
 const savedValue=validOdds(saved[record.id]?.quote);
 const before=minutesUntil(record.kickoff)>15;
 const intro=secondary?'ALTERNATIVA · '+record.category:record.category+' · SCREENING';
 const evidence=(Array.isArray(record.why)?record.why:[]).slice(0,3);
 return '<article class="surface pad candidate-review-card">'+
  '<div class="candidate-review-cardtop"><span class="tag '+(record.category==='CORE'?'main':'lab')+'">'+esc(intro)+'</span>'+
   '<span class="muted small">'+esc(date(record.kickoff))+'</span></div>'+
  '<h3>'+esc(record.match)+'</h3>'+
  '<p class="muted small">'+esc(record.league)+' · 1X2 '+esc(record.selection==='Home'?'1 (casa)':record.selection==='Away'?'2 (trasferta)':'X (pareggio)')+'</p>'+
  '<div class="candidate-review-stats"><div><span>Quota della fonte</span><strong>'+esc(fmt(record.reference_odds))+'</strong></div>'+
   '<div><span>Bookmaker fonte</span><strong class="candidate-bookmaker">'+esc(record.reference_bookmaker)+'</strong></div>'+
   '<div><span>Benchmark esterno</span><strong>'+esc(fmt(record.external_fair_odds))+'</strong></div></div>'+
  '<p class="muted small">Quota osservata '+esc(quoteFreshness(record.captured_at))+' fa. L’analisi è basata sulla fonte esterna, non su un modello indipendente o su Bet365.</p>'+
  '<details class="candidate-review-why"><summary>Perché è stata evidenziata?</summary>'+
   '<ul>'+evidence.map(x=>'<li>'+esc(readable(x))+'</li>').join('')+'</ul>'+
   '<p class="muted small">Il punteggio tecnico ordina le osservazioni; non indica la probabilità di vincita. I risultati passati non provano che il metodo funzioni.</p>'+
   '<a href="'+(String(record.reference_link||'').startsWith('https://tipsaudit.com/')?esc(record.reference_link):'https://tipsaudit.com/api')+'" target="_blank" rel="noopener noreferrer">Fonte della quota</a></details>'+
  '<div class="candidate-review-manual">'+
   '<label for="review-quote-'+esc(record.id)+'">Quota Bet365 osservata da te</label>'+
   '<div class="candidate-review-inputrow"><input id="review-quote-'+esc(record.id)+'" type="number" min="1.01" max="200" step="0.01" inputmode="decimal" '+
    'data-review-input="'+esc(record.id)+'" value="'+(savedValue!==null?esc(String(savedValue)):'')+'" placeholder="Es. 1,90" '+(!before?'disabled':'')+'/>'+
    '<button type="button" class="button secondary thin" data-review-save="'+esc(record.id)+'" '+(!before?'disabled':'')+'>Salva quota</button></div>'+
   '<div class="candidate-review-comparison" data-review-comparison="'+esc(record.id)+'">'+comparison(record)+'</div>'+
   '<div class="candidate-review-record"><button type="button" class="button secondary thin" data-review-register="'+esc(record.id)+'" '+(!before?'disabled':'')+'>Ho già piazzato · registra REAL</button>'+ 
   '<p class="muted tiny">Apre il modulo precompilato. Non salva alcuna puntata senza la tua conferma.</p></div></div>'+
  (!before?'<p class="muted small">Partita iniziata o imminente: confronto bloccato per evitare l’uso di riferimenti prepartita non più validi.</p>':'')+
 '</article>';
}
function show(){
 if(!feed){status.textContent=error?'Rapporto non disponibile: '+error:'Caricamento rapporto automatico…';panel.innerHTML='';return;}
 const age=Date.now()-Date.parse(feed.generated_at||'');
 const stale=!(age>=-120000&&age<=36*3600000);
 const sourceAge=Date.now()-Date.parse(feed.source_last_check||'');
 const validFeed=feed.status==='PRELIMINARY_CANDIDATES'&&!stale&&sourceAge>=-120000&&sourceAge<=36*3600000;
 const allShort=validFeed?(feed.shortlist||[]).filter(r=>minutesUntil(r.kickoff)>15):[];
 const alternatives=validFeed?(feed.alternatives||[]).filter(r=>minutesUntil(r.kickoff)>15):[];
 const normalStatus=feed.status==='SOURCE_STALE'?'Dati LAB troppo vecchi: nessuna candidata attiva.':
  feed.status==='NO_ELIGIBLE_OBSERVATIONS'?'Il filtro non ha trovato osservazioni valide per il prossimo weekend.':
  stale?'Rapporto scaduto: attendo una nuova scansione, senza mostrare candidate superate.':
  !validFeed?'Dati non sufficienti per visualizzare nuove candidate.':
  'Rapporto sperimentale del '+date(feed.generated_at)+' · '+feed.scan_stats.eligible_observations+' osservazioni idonee.';
 status.innerHTML='<strong>'+esc(normalStatus)+'</strong>'+
  '<p class="muted small">Ultima raccolta LAB: '+esc(feed.source_last_check?date(feed.source_last_check):'non disponibile')+
  '. Mercato coperto: 1X2. I gruppi CORE e VALUE sono fasce di quota, non garanzie di sicurezza.</p>'+
  (error?'<p class="muted small">Visualizzo l’ultima copia caricata. Aggiornamento fallito: '+esc(error)+'</p>':'');
 const alternativesWereOpen=Boolean(panel.querySelector('.candidate-review-others')?.open);
 let html='<div class="candidate-review-emphasis"><strong>Analisi automatica preliminare, nessuna giocata REAL.</strong>'+
  '<p class="muted small">Il motore usa quote LAB prepartita e il benchmark della fonte. Per ora NON confronta ancora forma, infortuni o formazioni: non è una raccomandazione validata.</p></div>';
 if(!allShort.length)html+='<p class="muted small candidate-review-empty">Nessuna candidata attiva in questo momento. Non vengono mostrate partite iniziate o dati scaduti.</p>';
 else html+='<div class="candidate-review-grid">'+allShort.map(x=>row(x)).join('')+'</div>';
 if(alternatives.length)html+='<details class="candidate-review-others"><summary>Altre '+alternatives.length+' osservazioni del LAB</summary>'+
  '<p class="muted small">Alternative ordinate dal filtro: non sono scelte approvate.</p>'+
  '<div class="candidate-review-grid">'+alternatives.slice(0,6).map(x=>row(x,true)).join('')+'</div></details>';
 html+='<p class="muted tiny">I confronti inseriti qui rimangono solo in questo browser. Le REAL restano separate nello Storico e richiedono registrazione esplicita dopo un’eventuale puntata effettuata.</p>';
 panel.innerHTML=html;
 if(alternativesWereOpen)panel.querySelector('.candidate-review-others')?.setAttribute('open','');
}
async function load(){
 btn.disabled=true;status.textContent='Lettura nuova analisi del motore…';
 try{
  const r=await fetch('./data/candidate_review.json?c='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const next=await r.json();
  if(next.schema!=='scanner-conte-candidate-review-v1'||!Array.isArray(next.shortlist)||!Array.isArray(next.alternatives))throw Error('Schema non valido');
  feed=next;error=null;
 }catch(e){error=String(e.message||e);}
 finally{btn.disabled=false;show();}
}
panel.addEventListener('click',event=>{
 const button=event.target.closest('[data-review-save],[data-review-register]');
 if(!button||!feed)return;
 const registration=button.hasAttribute('data-review-register');
 const id=button.getAttribute(registration?'data-review-register':'data-review-save');
 const candidate=[...feed.shortlist,...feed.alternatives].find(r=>r.id===id);
 if(!candidate||minutesUntil(candidate.kickoff)<=15)return;
 const i=[...panel.querySelectorAll('[data-review-input]')].find(el=>el.getAttribute('data-review-input')===id);
 if(!i)return;
 const raw=String(i.value??'').trim();
 const price=raw?validOdds(raw):null;
 if(raw&&price===null){window.alert('Inserisci una quota Bet365 valida tra 1,01 e 200.');return;}
 if(registration){
  if(price===null){window.alert('Prima di registrare una REAL già piazzata, inserisci la quota effettiva Bet365.');return;}
  window.dispatchEvent(new CustomEvent('scanner-conte:prefill-real',{
   detail:{id:candidate.id,match:candidate.match,category:candidate.category,
    kickoff:candidate.kickoff,selection:candidate.selection,market:candidate.market,
    odds:price,reference_odds:candidate.reference_odds,
    reference_bookmaker:candidate.reference_bookmaker,reference_link:candidate.reference_link}
  }));
  return;
 }
 if(price===null)delete saved[id];else saved[id]={quote:price,updated_at:new Date().toISOString()};
 if(store())show();
});
btn.addEventListener('click',load);
window.addEventListener('focus',()=>{if(!document.hidden)load();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
load();
})();
