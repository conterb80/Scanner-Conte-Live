/* Scanner Conte LIVE - taccuino di osservazioni e semplice confronto tra quote.
   Solo appunti personali locali, nessun pronostico o conferma di puntata.
*/
(()=>{
'use strict';
const root=document.getElementById('quote-notebook');
if(!root)return;
const list=document.getElementById('quote-notebook-list');
const form=document.getElementById('quote-notebook-form');
const KEY='scanner-conte-quote-notebook-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const numeric=x=>{const n=Number(String(x??'').replace(',','.'));return Number.isFinite(n)&&n>=1.01&&n<=200?n:null;};
const decimal=n=>Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleString('it-IT',{timeZone:'Europe/Rome',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Data non valida';};
const load=()=>{try{const j=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(j)?j.filter(x=>x&&typeof x.id==='string'&&typeof x.match==='string').slice(0,20):[];}catch{return [];}};
let entries=load();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(entries));return true;}catch{window.alert('Impossibile salvare: archivio locale non disponibile.');return false;}};
function render(){
 if(!entries.length){list.innerHTML='<p class="muted small">Non ci sono ancora partite annotate. Puoi aggiungerne una e indicare la quota Bet365 quando la conosci.</p>';return;}
 list.innerHTML=entries.slice().sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)).map(x=>{
  const cutoff=Number.isFinite(Date.parse(x.kickoff))&&Date.now()>=Date.parse(x.kickoff);
  const observed=numeric(x.observed),reference=numeric(x.reference);
  const diff=observed!==null&&reference!==null?(100*(observed/reference-1)):null;
  const label=diff===null?'Quota Bet365 non annotata':Math.abs(diff)<0.005?'Uguale al riferimento':
   (diff<0?'Inferiore al riferimento di ':'Superiore al riferimento di ')+decimal(Math.abs(diff))+'%';
  return '<article class="quote-note-row">'+
   '<div class="quote-note-heading"><b>'+esc(x.match)+'</b><span class="muted small">'+(cutoff?'Incontro già iniziato / trascorso':esc(date(x.kickoff)))+'</span></div>'+
   '<div class="quote-note-details"><span>Mercato: '+esc(x.market)+'</span><span>Riferimento: <b>'+esc(decimal(reference??0))+'</b></span></div>'+
   (x.notes?'<p class="muted small">'+esc(x.notes)+'</p>':'')+
   '<label class="quote-note-odds">Quota Bet365 da te osservata <input type="number" min="1.01" max="200" step="0.01" inputmode="decimal" data-quote-input="'+esc(x.id)+'" value="'+(observed!==null?esc(observed):'')+'" placeholder="Inserisci quota"></label>'+
   '<div class="quote-note-bottom"><span class="muted small">'+esc(label)+'. Differenza descrittiva, non un via libera alla puntata.</span>'+
   '<div><button class="button secondary thin" type="button" data-quote-save="'+esc(x.id)+'">Salva quota</button> '+
   '<button class="button secondary thin" type="button" data-quote-remove="'+esc(x.id)+'">Rimuovi</button></div></div></article>';
 }).join('');
}
form?.addEventListener('submit',e=>{
 e.preventDefault();const f=new FormData(form);
 const match=String(f.get('match')||'').trim(),market=String(f.get('market')||'').trim(),
       kickoffRaw=String(f.get('kickoff')||''),reference=numeric(f.get('reference')),
       observedRaw=String(f.get('observed')||'').trim(),observed=observedRaw?numeric(observedRaw):null,
       notes=String(f.get('notes')||'').trim();
 const dt=new Date(kickoffRaw);
 if(!match||!market||reference===null||!Number.isFinite(dt.getTime())||(observedRaw&&observed===null)){
  window.alert('Inserisci partita, orario, mercato e quote corrette.');return;
 }
 if(entries.length>=20){window.alert('Limite di 20 osservazioni. Rimuovi una partita prima di aggiungerne un’altra.');return;}
 entries.push({id:'observation-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),match:match.slice(0,130),
  kickoff:dt.toISOString(),market:market.slice(0,80),reference,observed,notes:notes.slice(0,220),
  createdAt:new Date().toISOString()});
 if(save()){form.reset();render();const details=form.closest('details');if(details)details.open=false;}
});
list.addEventListener('click',e=>{
 const btn=e.target.closest('[data-quote-save],[data-quote-remove]');if(!btn)return;
 const deleteId=btn.getAttribute('data-quote-remove');
 if(deleteId){entries=entries.filter(x=>x.id!==deleteId);save();render();return;}
 const id=btn.getAttribute('data-quote-save');
 const row=entries.find(x=>x.id===id),field=[...list.querySelectorAll('[data-quote-input]')].find(x=>x.getAttribute('data-quote-input')===id);
 if(!row||!field)return;
 const raw=String(field.value||'').trim(),n=raw?numeric(raw):null;
 if(raw&&n===null){window.alert('La quota deve essere compresa tra 1,01 e 200.');return;}
 row.observed=n;row.updatedAt=new Date().toISOString();save();render();
});
window.addEventListener('focus',render);
render();
})();
