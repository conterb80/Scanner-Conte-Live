/* V0.8 — stato delle fonti gratuite, sola lettura. */
(()=>{
 const box=document.getElementById('data-sources-status');
 if(!box)return;
 const fmt=s=>{try{return new Date(s).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '—';}};
 const fetchJSON=async path=>{try{const r=await fetch(path+'?t='+Date.now(),{cache:'no-store'});return r.ok?await r.json():null;}catch{return null;}};
 async function show(){
  const [espn,csv]=await Promise.all([fetchJSON('./data/fallback_status.json'),fetchJSON('./data/football_data_status.json')]);
  if(!espn&&!csv){box.textContent='Fonti alternative: controllo non disponibile, storico conservato.';return;}
  const bits=[];
  if(espn?.provider?.includes('ESPN'))bits.push('Risultati: ESPN senza chiave · '+fmt(espn.checked_at));
  if(csv?.provider?.includes('Football-Data'))bits.push('Quote/campionati: Football-Data · '+fmt(csv.updated_at)+' · 2 raccolte/settimana massimo');
  bits.push('API-Football sospesa, non utilizzata');
  box.textContent=bits.join('   •   ');
 }
 show();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)show()});
})();
