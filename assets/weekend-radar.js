/* Scanner Conte LIVE — Radar weekend, sola osservazione dei test già acquisiti.
 * Fonti quote: TipsAudit (https://tipsaudit.com/api).
 * Non prevede vincite, non inserisce scommesse REAL, non scrive sullo storico.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const panel=$('weekend-radar-list'),status=$('weekend-radar-status'),
      count=$('weekend-radar-count'),mode=$('weekend-radar-mode'),
      refresh=$('weekend-radar-refresh'),savedBox=$('weekend-radar-saved');
if(!panel||!status||!mode||!refresh||!savedBox||!count)return;
const STORE='scanner-conte-weekend-observation-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const dateFmt=s=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const day=s=>new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Rome',weekday:'short'}).format(new Date(s));
const weekend=s=>['Sat','Sun'].includes(day(s));
const euro=n=>Number(n).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const ageLabel=s=>{const h=(Date.now()-Date.parse(s||''))/3600000;
 return !Number.isFinite(h)?'Orario non disponibile':h<0?'Data futura':h<1?'meno di 1 ora fa':h<24?Math.floor(h)+' ore fa':Math.floor(h/24)+' giorni fa';};
const safeURL=s=>typeof s==='string'&&s.startsWith('https://tipsaudit.com/')?s:'https://tipsaudit.com/api';
const idOf=x=>String(x.id||'');
const isUCL=x=>/champions league|uefa champions|ucl/i.test(x.league||'');
const nameChoice=s=>s==='Home'?'1 · Casa':s==='Draw'?'X · Pareggio':s==='Away'?'2 · Trasferta':String(s||'—');
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const featured=new Set(['bolognamonza','astonvillafulham']);
let data=null,error=null,inFlight=false,modeValue='weekend';
const loadMarked=()=>{try{const x=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(x)?x.filter(y=>typeof y==='string'):[];}catch{return [];}};
let marked=new Set(loadMarked());
const saveMarked=()=>{try{localStorage.setItem(STORE,JSON.stringify([...marked]));}catch(e){status.textContent='Non riesco a salvare sul dispositivo: memoria piena o accesso negato.';}};
function matches(){
 if(!data?.records)return[];
 const now=Date.now();
 const records=data.records.filter(x=>x.status==='pending'&&
  Number.isFinite(Date.parse(x.kickoff))&&Date.parse(x.kickoff)>now+10*60000&&
  Date.parse(x.kickoff)<now+72*3600000&&
  Number.isFinite(x.odds)&&x.odds>1.01&&x.bookmaker&&x.captured_at&&
  (modeValue==='champions'?isUCL(x):weekend(x.kickoff))).
  sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
 const seen=new Set();return records.filter(x=>{
  const k=normalize(x.match)+'-'+x.kickoff.slice(0,10);
  if(seen.has(k))return false;seen.add(k);return true;
 });
}
function draw(){
 if(!data){status.textContent=error?'Archivio non disponibile: '+error:'Caricamento…';return;}
 const all=data.records||[];
 const finished=all.filter(x=>['won','lost'].includes(x.status)),pnl=finished.reduce((n,x)=>n+(Number(x.pnl)||0),0);
 const scanned=data.last_check?dateFmt(data.last_check):'non disponibile';
 const old=Date.now()-Date.parse(data.last_check||'');
 status.innerHTML='<b>Motore LAB: '+all.length+' test acquisiti, '+finished.length+' conclusi</b> · risultato teorico '+esc(euro(pnl))+
  ' · Ultima scansione '+esc(scanned)+
  (old>30*3600000?'<p class="muted small">Ultima scansione datata: il calendario potrebbe non essere aggiornato.</p>':'')+
  '<p class="muted small">Questa schermata legge i test pubblici; non analizza autonomamente infortuni o formazioni e non convalida quote Bet365.</p>';
 const rows=matches();
 count.textContent=rows.length+' eventi disponibili in osservazione';
 panel.innerHTML=rows.length?rows.map(x=>{
  const chosen=marked.has(idOf(x));
  const discut=featured.has(normalize(x.match));
  const timeLeft=(Date.parse(x.kickoff)-Date.now())/3600000;
  const age=(Date.now()-Date.parse(x.captured_at))/3600000;
  return '<article class="surface pad weekend-radar-card">'+
   '<div class="weekend-radar-top"><span class="muted small">'+esc(dateFmt(x.kickoff))+'</span>'+
    (discut?'<span class="tag main">Discussa in chat</span>':'<span class="tag lab">LAB · 1X2</span>')+'</div>'+
   '<h3>'+esc(x.match)+'</h3><p class="muted small">'+esc(x.league)+' · '+esc(x.bookmaker)+'</p>'+
   '<div class="weekend-radar-quote"><span>Segnale esterno: <b>'+esc(nameChoice(x.selection))+'</b></span><strong>@'+esc(x.odds)+'</strong></div>'+
   '<p class="muted small">Quota osservata '+esc(ageLabel(x.captured_at))+
    (age>24?' · <b>Datata, da ricontrollare</b>':'')+
    ' · Inizio fra '+(timeLeft<1?'meno di un’ora':Math.floor(timeLeft)+' ore')+
    ' · <a href="'+esc(safeURL(x.reference))+'" target="_blank" rel="noopener noreferrer">Fonte</a></p>'+
   '<button type="button" class="button secondary thin" data-observe-id="'+esc(idOf(x))+'">'+
   (chosen?'Rimuovi dall’osservazione':'Segui questa partita')+'</button>'+
   '</article>';
 }).join(''):'<p class="surface pad muted small">Nessun evento futuro del '+(modeValue==='champions'?'turno Champions':'weekend')+' nel LAB salvato. Non genero incontri o quote mancanti.</p>';
 const saved=all.filter(x=>marked.has(idOf(x))).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
 savedBox.innerHTML=saved.length?saved.map(x=>'<div class="weekend-radar-saved-row"><span><b>'+esc(x.match)+'</b><small>'+esc(dateFmt(x.kickoff))+' · '+esc(nameChoice(x.selection))+' @'+esc(x.odds)+'</small></span>'+
   '<button class="button secondary thin" data-observe-id="'+esc(idOf(x))+'" type="button">Rimuovi</button></div>').join(''):
  '<p class="muted small">Non hai ancora salvato partite in osservazione su questo dispositivo.</p>';
}
async function load(){
 if(inFlight)return;inFlight=true;refresh.disabled=true;status.textContent='Aggiornamento dati dal LAB pubblico…';
 try{const r=await fetch('./data/daily_virtual_lab.json?observed='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();if(d.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(d.records))throw Error('Formato non riconosciuto');
  data=d;error=null;
 }catch(e){error=String(e.message||e);}finally{refresh.disabled=false;inFlight=false;draw();}
}
function toggle(event){
 const button=event.target.closest('[data-observe-id]');if(!button)return;
 const id=button.getAttribute('data-observe-id');if(!id||!data?.records?.some(x=>idOf(x)===id))return;
 if(marked.has(id))marked.delete(id);else marked.add(id);
 saveMarked();draw();
}
panel.addEventListener('click',toggle);savedBox.addEventListener('click',toggle);
refresh.addEventListener('click',load);
mode.addEventListener('change',()=>{modeValue=mode.value;draw();});
window.addEventListener('focus',()=>{if(!document.hidden)load();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
load();
})();
