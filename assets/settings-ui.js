/* Scanner Conte LIVE V0.9.8
 * SOLO presentazione: modalità semplice/completa e stato dei rapporti pubblici.
 * Non legge né modifica registrazioni, strategie, quote o esiti REAL/LAB.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const KEY='scanner-conte-ui-view-mode-v1';
const options=[...document.querySelectorAll('[data-ui-mode]')];
const description=$('settings-mode-description');
const labels={
 simple:'Vista semplice: prima le informazioni essenziali. Gli approfondimenti si aprono quando vuoi.',
 full:'Vista completa: mostra inizialmente anche i pannelli tecnici, senza cambiare dati o calcoli.'
};
let mode='simple';
try{mode=localStorage.getItem(KEY)==='full'?'full':'simple';}catch{}
function applyMode(next,save){
 mode=next==='full'?'full':'simple';
 document.documentElement.dataset.uiView=mode;
 options.forEach(b=>{
  const chosen=b.dataset.uiMode===mode;
  b.classList.toggle('active',chosen);
  b.setAttribute('aria-pressed',String(chosen));
 });
 if(description)description.textContent=labels[mode];
 // I dettagli non vengono cancellati; il cambio vista regola solo
 // l'apertura iniziale di alcune sezioni tecniche già presenti.
 document.querySelectorAll('[data-mode-open="full"]').forEach(details=>{
  details.open=mode==='full';
 });
 if(save){try{localStorage.setItem(KEY,mode);}catch{}}
}
options.forEach(button=>button.addEventListener('click',()=>applyMode(button.dataset.uiMode,true)));
applyMode(mode,false);

const refresh=$('data-status-refresh');
const indicators={
 lab:$('settings-lab-indicator'),
 candidates:$('settings-scanner-indicator'),
 results:$('settings-results-indicator')
};
const targets={
 lab:$('settings-lab-status'),
 candidates:$('settings-scanner-status'),
 results:$('settings-results-status')
};
const sources=$('settings-source-details');
if(!refresh||!sources||Object.values(targets).some(x=>!x))return;
const fmt=s=>{
 const n=Date.parse(s||'');
 return Number.isFinite(n)?new Date(n).toLocaleString('it-IT',{
  timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'
 }):'non disponibile';
};
const current=s=>{
 const diff=Date.now()-Date.parse(s||'');
 return Number.isFinite(diff)&&diff>=-120000&&diff<=36*3600000;
};
const recentResult=s=>{
 const diff=Date.now()-Date.parse(s||'');
 return Number.isFinite(diff)&&diff>=-120000&&diff<=48*3600000;
};
const set=(name,message,state='neutral')=>{
 const item=targets[name],indicator=indicators[name];
 if(item)item.textContent=message;
 if(indicator){
  indicator.classList.remove('ok','warn','neutral');
  indicator.classList.add(state);
  indicator.setAttribute('aria-label',state==='ok'?'Rapporto recente':state==='warn'?'Aggiornamento da verificare':'Stato non verificabile');
 }
};
async function get(path){
 try{
  const response=await fetch(path+'?status='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  return await response.json();
 }catch{return null;}
}
let busy=false;
async function update(){
 if(busy)return;busy=true;refresh.disabled=true;
 set('lab','Lettura dati pubblicati…');
 set('candidates','Lettura rapporto candidate…');
 set('results','Lettura feed esiti…');
 const [lab,candidates,fixtures,espn,football]=await Promise.all([
  get('./data/daily_virtual_lab.json'),
  get('./data/candidate_review.json'),
  get('./data/fixtures_latest.json'),
  get('./data/fallback_status.json'),
  get('./data/football_data_status.json')
 ]);
 if(lab?.schema==='scanner-conte-daily-virtual-v1'&&Array.isArray(lab.records)){
  const last=lab.last_check;
  const pending=lab.records.filter(x=>x.status==='pending').length;
  set('lab',fmt(last)+' · '+lab.records.length+' test, '+pending+' in attesa'+
      (current(last)?'':' · raccolta non recente'),current(last)?'ok':'warn');
 }else set('lab','Dati LAB non disponibili; lo storico salvato rimane intatto.','neutral');

 if(candidates?.schema==='scanner-conte-candidate-review-v1'&&
   Array.isArray(candidates.shortlist)&&Array.isArray(candidates.alternatives)){
  const checked=candidates.generated_at;
  const fresh=current(checked)&&current(candidates.source_last_check);
  if(!fresh||candidates.status==='SOURCE_STALE')
   set('candidates','Rapporto del '+fmt(checked)+' · dati da aggiornare.','warn');
  else if(candidates.status==='NO_ELIGIBLE_OBSERVATIONS')
   set('candidates','Screening del '+fmt(checked)+' · nessuna candidata idonea.','ok');
  else if(candidates.status==='PRELIMINARY_CANDIDATES'){
   const n=candidates.shortlist.length,a=candidates.alternatives.length;
   set('candidates','Rapporto del '+fmt(checked)+' · '+n+' principali, '+a+' alternative (verifica orario nello Scanner).','ok');
  }else set('candidates','Rapporto del '+fmt(checked)+' · nessuna selezione attiva.','neutral');
 }else set('candidates','Rapporto candidate non disponibile; nessuna quota viene inventata.','neutral');

 if(fixtures?.schema==='scanner-conte-fixtures-v1'){
  const stamp=fixtures.last_result_refresh||fixtures.collected_at;
  set('results','Ultimo aggiornamento: '+fmt(stamp)+
   (recentResult(stamp)?'':' · feed non recente; non conferma nuovi esiti.'),recentResult(stamp)?'ok':'warn');
 }else set('results','Feed esiti non verificabile; esiti locali invariati.','neutral');

 const bits=[];
 if(espn?.provider?.includes('ESPN'))bits.push('ESPN (risultati alternativi): '+fmt(espn.checked_at));
 else bits.push('ESPN: ultima verifica non disponibile');
 if(football?.provider?.includes('Football-Data'))bits.push('Football-Data: '+fmt(football.updated_at));
 else bits.push('Football-Data: ultima verifica non disponibile');
 bits.push('TipsAudit: osservazioni LAB; quote Bet365 sempre inserite da te');
 sources.textContent=bits.join(' · ');
 busy=false;refresh.disabled=false;
}
refresh.addEventListener('click',update);
// Carica questi metadati soltanto all'apertura di Dati, non in tutte le schermate.
document.querySelectorAll('[data-goto="settings"]').forEach(button=>button.addEventListener('click',update));
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&$('view-settings')?.classList.contains('active'))update();
});
if($('view-settings')?.classList.contains('active'))update();
})();
