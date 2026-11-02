/* Scanner Conte LIVE V0.9.7 — sola presentazione delle sezioni Storico e LAB.
 * Legge gli archivi pubblici gia prodotti da GitHub. Non crea/aggiorna test,
 * non tocca localStorage, non calcola nuove probabilita e non scrive REAL.
 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const dt=$('lab-daily-pnl'),dc=$('lab-daily-count'),ds=$('lab-daily-stamp');
 const at=$('lab-auto-pnl'),ac=$('lab-auto-count'),as=$('lab-auto-stamp');
 const note=$('archive-active-note');
 const notes={
  real:'REAL · giocate effettive registrate su questo dispositivo. Le quote Bet365 sono quelle inserite da te.',
  main:'Principale · simulazioni storiche locali. Non sono giocate con denaro reale.',
  lab:'LAB storico · sperimentazioni conservate sul dispositivo, separate da REAL e altri LAB.',
  auto:'LAB auto · test pubblici del laboratorio pilota precedente. Nessuna puntata REAL.',
  daily:'LAB 1X2 · test pubblici quotidiani sulle quote osservate. Nessuna puntata REAL.'
 };
 const showRegisterNote=tab=>{if(note&&notes[tab])note.textContent=notes[tab];};
 document.querySelectorAll('[data-register-tab]').forEach(b=>b.addEventListener('click',()=>showRegisterNote(b.dataset.registerTab)));
 // I collegamenti dal LAB selezionano il registro tramite lo script esistente,
 // senza simulare un clic sul tab: aggiorna comunque la descrizione visiva.
 document.querySelectorAll('[data-open-register]').forEach(b=>b.addEventListener('click',()=>showRegisterNote(b.dataset.openRegister)));

 if(!dt||!dc||!ds||!at||!ac||!as)return;
 const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
 const stamped=s=>{
  const time=Date.parse(s||'');
  return Number.isFinite(time)?new Date(time).toLocaleString('it-IT',{
   timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'
  }):'non disponibile';
 };
 const settled=r=>['won','lost','push','void'].includes(r.status);
 const configure=(pnl,count,stamp)=>({pnl,count,stamp});
 const datasets=[
  {url:'./data/daily_virtual_lab.json',schema:'scanner-conte-daily-virtual-v1',
   fields:configure(dt,dc,ds),date:'last_check'},
  {url:'./data/lab_auto.json',schema:'scanner-conte-lab-v1',
   fields:configure(at,ac,as),date:'last_run'}
 ];
 const updateOne=async ({url,schema,fields,date})=>{
  const {pnl,count,stamp}=fields;
  try{
   const res=await fetch(url+'?overview='+Date.now(),{cache:'no-store'});
   if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json();
   if(data.schema!==schema||!Array.isArray(data.records))throw Error('Archivio non compatibile');
   const records=data.records,done=records.filter(settled),pending=records.filter(x=>x.status==='pending');
   const total=done.reduce((n,x)=>n+(typeof x.pnl==='number'&&Number.isFinite(x.pnl)?x.pnl:0),0);
   pnl.textContent=(total>0?'+':'')+money(Math.round(total*100)/100);
   pnl.classList.toggle('positive',total>=0);
   pnl.classList.toggle('negative',total<0);
   count.textContent=records.length+' test · '+pending.length+' in attesa · '+done.length+' conclusi';
   stamp.textContent='Ultima acquisizione: '+stamped(data[date]);
  }catch(e){
   pnl.textContent='—';
   pnl.classList.remove('positive','negative');
   count.textContent='Dati del LAB non disponibili';
   stamp.textContent='Il registro storico non viene modificato.';
  }
 };
 let busy=false;
 const refresh=async()=>{
  if(busy)return;busy=true;
  await Promise.all(datasets.map(updateOne));
  busy=false;
 };
 window.addEventListener('focus',()=>{if(!document.hidden)refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 refresh();
})();
