/* Stato reale delle fonti: distingue calendario, quote e risultati. Solo lettura. */
(()=>{
 'use strict';
 const box=document.getElementById('data-sources-status');
 if(!box)return;
 const fmt=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?
  d.toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';};
 const get=async path=>{try{const r=await fetch(path+'?s='+Date.now(),{cache:'no-store'});return r.ok?await r.json():null;}catch{return null}};
 async function show(){
  const [radar,csv,results,daily]=await Promise.all([
   get('./data/fixture_radar.json'),get('./data/football_data_status.json'),
   get('./data/results_public.json'),get('./data/daily_virtual_lab.json')
  ]);
  if(!radar&&!csv&&!results&&!daily){box.textContent='Fonti: controllo non disponibile. Nessun archivio è stato alterato.';return}
  const parts=[];
  if(radar?.schema==='scanner-conte-fixture-radar-v1'){
   const future=radar.fixtures.filter(x=>Date.parse(x.kickoff)>Date.now()).length;
   parts.push('CALENDARIO ESPN · '+future+' incontri futuri nella copertura · controllato '+fmt(radar.generated_at));
  }else parts.push('CALENDARIO · in attesa di verifica');
  if(daily?.schema==='scanner-conte-daily-virtual-v1'){
   const checks=Array.isArray(daily.checks)?daily.checks:[];
   const last=checks.at(-1);
   parts.push('QUOTE PER LAB 1X2 · '+(last?.scanned_predictions??'—')+
    ' eventi nel feed della giornata ('+(last?.eligible_actionable??'—')+
    ' idonei) · '+fmt(last?.checked_at||daily.last_check));
  }
  if(csv?.provider==='Football-Data.co.uk')parts.push(
   'FOOTBALL-DATA · '+fmt(csv.updated_at)+' · aggiornamento max 2 volte/settimana');
  if(results?.schema==='scanner-conte-results-public-v1')
   parts.push('RISULTATI ESPN · '+fmt(results.checked_at)+' · copertura parziale');
  parts.push('API-FOOTBALL · acquisizione automatica sospesa');
  box.textContent=parts.join('   •   ');
 }
 show();document.addEventListener('visibilitychange',()=>{if(!document.hidden)show()});
})();
