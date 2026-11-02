/* Scanner Conte LIVE — Home compatta V0.9.4.
 * Sola lettura dei rapporti GitHub gia pubblicati. Nessun cambio a motore,
 * quote, strategie o archivi REAL/LAB. Pulsante REAL riusa il dialog esistente.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const scan=$('home-scan-count'),main=$('home-candidates-count'),
 alternatives=$('home-alternatives-count'),source=$('home-scan-state'),
 lab=$('home-lab-pulse'),stamp=$('home-scan-updated'),refresh=$('home-scan-refresh');
const register=$('home-quick-real');
if(!scan||!main||!alternatives||!source||!lab||!stamp)return;
const tz='Europe/Rome';
const dateKey=s=>{try{return new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));}catch{return ''}};
const nice=s=>{const t=Date.parse(s||'');return Number.isFinite(t)?new Date(t).toLocaleString('it-IT',{timeZone:tz,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'non disponibile'};
const fresh=s=>{const age=Date.now()-Date.parse(s||'');return Number.isFinite(age)&&age>=-120000&&age<=36*3600000;};
const future=x=>Date.parse(x?.kickoff||'')>Date.now()+15*60000;
const minutesRome=()=>{
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const h=Number(p.find(x=>x.type==='hour')?.value),m=Number(p.find(x=>x.type==='minute')?.value);
 return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;
};
let busy=false;
const read=async path=>{
 const r=await fetch(path+'?ui='+Date.now(),{cache:'no-store'});
 if(!r.ok)throw Error('HTTP '+r.status);
 return r.json();
};
async function update(){
 if(busy)return;busy=true;if(refresh)refresh.disabled=true;
 let issues=[],notices=[];
 try{
  const d=await read('./data/daily_virtual_lab.json');
  if(d.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(d.checks)||!Array.isArray(d.records))throw Error('Registro LAB non valido');
  const today=dateKey(new Date().toISOString());
  const scansToday=d.checks.filter(x=>x.day===today).length;
  scan.textContent=String(scansToday);
  lab.textContent='LAB 1X2 · '+d.records.length+' test registrati, '+d.records.filter(x=>x.status==='pending').length+' in attesa';
  stamp.textContent='Ultima raccolta: '+nice(d.last_check);
  if(!fresh(d.last_check))issues.push('raccolta LAB non recente');
  else if(!scansToday){
   const minutes=minutesRome();
   if(minutes!==null&&minutes<8*60+50)notices.push('prima scansione programmata alle 08:50');
   else if(minutes!==null&&minutes<15*60+50)notices.push('in attesa della raccolta programmata');
   else issues.push('nessuna scansione pubblicata oggi');
  }
 }catch(e){
  scan.textContent='—';lab.textContent='LAB 1X2: dati non disponibili';
  stamp.textContent='Ultima raccolta: non verificabile';
  issues.push('registro LAB non raggiungibile');
 }
 try{
  const d=await read('./data/candidate_review.json');
  if(d.schema!=='scanner-conte-candidate-review-v1'||!Array.isArray(d.shortlist)||!Array.isArray(d.alternatives))throw Error('Rapporto candidato non valido');
  const recent=fresh(d.generated_at)&&fresh(d.source_last_check);
  const active=recent&&d.status==='PRELIMINARY_CANDIDATES';
  const n=active?d.shortlist.filter(future).length:0;
  const a=active?d.alternatives.filter(future).length:0;
  main.textContent=String(n);
  alternatives.textContent=String(a);
  if(!recent||d.status==='SOURCE_STALE')issues.push('rapporto candidate da aggiornare');
  else if(d.status==='NO_ELIGIBLE_OBSERVATIONS')notices.push('nessuna candidata idonea al momento');
  else if(!active)issues.push('rapporto candidate non disponibile');
  else if(!n&&!a)notices.push('nessuna candidata prepartita attiva');
 }catch(e){
  main.textContent='—';alternatives.textContent='—';issues.push('rapporto candidate non raggiungibile');
 }
 source.textContent=[...issues,...notices].join(' · ')||'Rapporti aggiornati. Apri Scanner per confrontare le quote.';
 source.classList.toggle('is-warning',issues.length>0);
 busy=false;if(refresh)refresh.disabled=false;
}
refresh?.addEventListener('click',update);
register?.addEventListener('click',()=>{
 const existing=$('add-record'),form=$('record-form'),dialog=$('record-dialog');
 if(!existing||!form||!dialog)return;
 existing.click(); // stesso modulo e stessi controlli di registrazione esistenti
 if(dialog.open){
  const book=form.elements.namedItem('book');
  if(book)book.value='real';
  const result=form.elements.namedItem('result');
  if(result)result.value='pending';
 }
});
window.addEventListener('focus',()=>{if(!document.hidden)update();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
update();
})();
