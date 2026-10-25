/* Scanner Conte LIVE V0.6 — cruscotto statistiche mobile-first.
 * Legge lo storico locale (solo lettura) e il LAB automatico pubblico.
 * Non crea, modifica, pubblica o sincronizza giocate REAL.
 */
(()=>{
 'use strict';
 const STORE='scanner-conte-live-v01';
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const valid=n=>typeof n==='number'&&Number.isFinite(n);
 const num=n=>valid(n)?n:0;
 const eur=n=>(n>0?'+':'')+new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
 const formatInt=n=>new Intl.NumberFormat('it-IT').format(n);
 const pct=n=>Number.isFinite(n)?n.toLocaleString('it-IT',{maximumFractionDigits:1,minimumFractionDigits:1})+'%':'—';
 const readableDate=s=>{try{return new Date(s).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '—';}};
 const titles={real:'REAL · Bet365',main:'Virtuale principale',lab:'LAB storico',auto:'LAB automatico'};
 let selection='all',auto=null,autoError=null;
 const snapStats=(s={})=>({
  total:num(s.total),wins:num(s.wins),losses:num(s.losses),pushes:num(s.pushes),pnl:num(s.pnl),
  stake:valid(s.stake_total)?s.stake_total:null,bankroll:valid(s.bankroll)?s.bankroll:null
 });
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 function readDB(){try{const d=JSON.parse(localStorage.getItem(STORE)||'null');return d?.snapshots&&Array.isArray(d.records)?d:null;}catch{return null;}}
 function statsFromRows(rows){
  const done=rows.filter(r=>['won','lost','push'].includes(r.result));
  return {
   total:rows.length,wins:rows.filter(r=>r.result==='won').length,
   losses:rows.filter(r=>r.result==='lost').length,pushes:rows.filter(r=>r.result==='push').length,
   pnl:round(done.reduce((sum,r)=>sum+(valid(r.pnl)?r.pnl:0),0)),
   stake:done.every(r=>valid(r.stake))?round(done.reduce((sum,r)=>sum+r.stake,0)):null,
   pending:rows.filter(r=>r.result==='pending').length
  };
 }
 function combined(base,plus){
  return{
   total:base.total+plus.total,wins:base.wins+plus.wins,losses:base.losses+plus.losses,
   pushes:base.pushes+plus.pushes,pnl:round(base.pnl+plus.pnl),
   stake:base.stake===null||plus.stake===null?null:round(base.stake+plus.stake),
   bankroll:base.bankroll===null?null:round(base.bankroll+plus.pnl),
   pending:plus.pending||0
  };
 }
 function historical(d,book){
  if(!d)return{total:0,wins:0,losses:0,pushes:0,pnl:0,stake:null,bankroll:null,pending:0};
  const base=snapStats(d.snapshots[book]);
  const newer=d.records.filter(r=>r.book===book&&r.manual&&r.date>d.snapshots.as_of);
  return combined(base,statsFromRows(newer));
 }
 function fromAuto(){
  const rows=Array.isArray(auto?.records)?auto.records:[];
  const done=rows.filter(r=>r.status==='won'||r.status==='lost'||r.status==='push');
  return {
   total:rows.length,wins:rows.filter(r=>r.status==='won').length,
   losses:rows.filter(r=>r.status==='lost').length,pushes:rows.filter(r=>r.status==='push').length,
   pending:rows.filter(r=>r.status==='pending').length,
   pnl:round(done.reduce((a,r)=>a+(valid(r.pnl)?r.pnl:0),0)),
   stake:done.every(r=>valid(r.stake_virtual))?round(done.reduce((a,r)=>a+r.stake_virtual,0)):null,
   bankroll:null
  };
 }
 function summary(d){
  return {real:historical(d,'real'),main:historical(d,'main'),lab:historical(d,'lab'),auto:fromAuto()};
 }
 function winRate(s){const n=s.wins+s.losses;return n?100*s.wins/n:NaN;}
 function roi(s){return s.stake!==null&&s.stake>0?100*s.pnl/s.stake:NaN;}
 function card(label,value,note,cls=''){
  return '<div class="analytic-kpi"><span>'+escape(label)+'</span><strong class="'+cls+'">'+escape(value)+'</strong>'+(note?'<small>'+escape(note)+'</small>':'')+'</div>';
 }
 function pnlBars(items){
  const max=Math.max(...items.map(x=>Math.abs(x.pnl)),0.01);
  return '<div class="analytic-chart-label">Profitto / perdita per archivio</div><div class="analytic-bars">'+items.map(x=>{
   const width=round(Math.abs(x.pnl)/max*46);
   const left=x.pnl<0?50-width:50;
   return '<div class="analytic-bar-row"><span>'+escape(x.label)+'</span><div class="analytic-axis" role="img" aria-label="'+escape(x.label+' '+eur(x.pnl))+'"><i class="analytic-midline"></i>'+
   (x.pnl===0?'': '<i class="analytic-bar '+(x.pnl<0?'is-negative':'is-positive')+'" style="left:'+left+'%;width:'+width+'%"></i>')+
   '</div><b class="'+(x.pnl<0?'negative':'positive')+'">'+escape(eur(x.pnl))+'</b></div>';
  }).join('')+'</div>';
 }
 function rateBars(items){
  return '<div class="analytic-chart-label">Percentuale vinte (solo esiti conclusi)</div><div class="analytic-rates">'+items.map(x=>{
   const done=x.s.wins+x.s.losses,p=winRate(x.s);
   return '<div class="analytic-rate-row"><span>'+escape(x.label)+'</span><div class="analytic-rate-track">'+(Number.isFinite(p)?'<i style="width:'+p+'%"></i>':'')+'</div><b>'+escape(pct(p))+'</b><small>'+formatInt(done)+' valutate</small></div>';
  }).join('')+'</div>';
 }
 function mainSplit(d){
  const s=d?.snapshots?.main;
  if(!s?.core||!s?.value)return[];
  const recent=d.records.filter(r=>r.book==='main'&&r.manual&&r.date>d.snapshots.as_of);
  return [{label:'CORE',s:combined(snapStats(s.core),statsFromRows(recent.filter(r=>String(r.category||'').toUpperCase()==='CORE')))},
  {label:'VALUE',s:combined(snapStats(s.value),statsFromRows(recent.filter(r=>String(r.category||'').toUpperCase()==='VALUE')))}];
 }
 function realSplit(d){
  if(!d?.snapshots?.real)return[];
  const snap=d.snapshots.real,prior=d.records.filter(r=>r.book==='real'&&!r.manual&&r.date<=d.snapshots.as_of);
  const recent=d.records.filter(r=>r.book==='real'&&r.manual&&r.date>d.snapshots.as_of);
  const cats=['CORE','VALUE'];
  // Se tutti gli esiti storici sono ricostruiti e conciliati, calcoliamo il dettaglio.
  const ok=prior.length===num(snap.total)&&prior.every(r=>cats.includes(String(r.category||'').toUpperCase())&&
    ['won','lost','push'].includes(r.result)&&valid(r.pnl)&&valid(r.stake))&&
    Math.abs(round(prior.reduce((n,r)=>n+r.pnl,0))-num(snap.pnl))<0.015;
  if(ok)return cats.map(label=>({label,s:{
    ...statsFromRows(prior.filter(r=>String(r.category||'').toUpperCase()===label)
      .concat(recent.filter(r=>String(r.category||'').toUpperCase()===label))),
    bankroll:null
  }}));
  // Se esistono riepiloghi di categoria espliciti, utilizziamoli senza deduzioni.
  const split=snap.core_value_split;
  if(!split||typeof split!=='object')return[];
  const first=split.core||split.CORE,second=split.value||split.VALUE;
  if(!first||!second||!valid(first.total)||!valid(second.total))return[];
  return [{label:'CORE',s:combined(snapStats(first),statsFromRows(recent.filter(r=>String(r.category||'').toUpperCase()==='CORE')))},
  {label:'VALUE',s:combined(snapStats(second),statsFromRows(recent.filter(r=>String(r.category||'').toUpperCase()==='VALUE')))}];
 }
 function autoSplit(){
  const rows=Array.isArray(auto?.records)?auto.records:[];
  return [
   {label:'Favorita 1X2',strategy:'FAVORITA_1X2_CONTROLLO'},
   {label:'Over 2,5',strategy:'OVER25_CONTROLLO'}
  ].map(({label,strategy})=>{
   const selected=rows.filter(r=>r.strategy===strategy);
   const closed=selected.filter(r=>['won','lost','push'].includes(r.status));
   return {label,s:{
    total:selected.length,wins:selected.filter(r=>r.status==='won').length,
    losses:selected.filter(r=>r.status==='lost').length,pushes:selected.filter(r=>r.status==='push').length,
    pending:selected.filter(r=>r.status==='pending').length,
    pnl:round(closed.reduce((x,r)=>x+num(r.pnl),0)),
    stake:closed.every(r=>valid(r.stake_virtual))?round(closed.reduce((x,r)=>x+r.stake_virtual,0)):null,
    bankroll:null
   }};
  });
 }
 function trend(d,book){
  if(book==='auto'){
   const closed=(auto?.records||[]).filter(r=>valid(r.pnl)&&r.settled_at).sort((a,b)=>String(a.settled_at).localeCompare(String(b.settled_at)));
   return trendMarkup(closed.map(r=>num(r.pnl)),'Andamento LAB automatico (solo test chiusi)',0,closed.length);
  }
  if(!d)return '';
  const rows=d.records.filter(r=>r.book===book&&r.manual&&r.date>d.snapshots.as_of&&['won','lost','push'].includes(r.result))
   .sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
  return trendMarkup(rows.map(r=>num(r.pnl)),'Variazione dalle nuove registrazioni (dopo il '+String(d.snapshots.as_of).split('-').reverse().join('/')+')',num(d.snapshots[book]?.pnl),rows.length);
 }
 function trendMarkup(changes,title,base,count){
  if(count<2)return '<p class="muted small analytic-empty-chart">Il grafico cronologico apparirà dopo almeno due esiti nuovi registrati con data. Il bilancio consolidato precedente è già incluso nei totali.</p>';
  const points=[base],series=[];for(const x of changes){points.push(round(points[points.length-1]+x));}
  const min=Math.min(...points),max=Math.max(...points),range=Math.max(max-min,0.5),n=points.length;
  for(let i=0;i<n;i++){const x=8+(i/(n-1))*84,y=86-(points[i]-min)/range*72;series.push(x.toFixed(2)+','+y.toFixed(2));}
  const zeroY=86-(0-min)/range*72;
  return '<div class="analytic-chart-label">'+escape(title)+'</div><div class="analytic-line-wrap">'+
   '<svg class="analytic-spark" viewBox="0 0 100 100" role="img" aria-label="'+escape(title)+': da '+eur(points[0])+' a '+eur(points[points.length-1])+'">'+
   (zeroY>=7&&zeroY<=90?'<line x1="8" y1="'+zeroY.toFixed(2)+'" x2="92" y2="'+zeroY.toFixed(2)+'" stroke="#536471" stroke-width="0.5" stroke-dasharray="2 2"/>':'')+
   '<polyline fill="none" stroke="#58e6ac" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" vector-effect="non-scaling-stroke" points="'+series.join(' ')+'"/>'+
   '</svg><div class="analytic-ends"><span>'+eur(points[0])+' · inizio</span><strong>'+eur(points[points.length-1])+' · ultimo</strong></div></div>';
 }
 function render(){
  const box=$('analytics-content');
  if(!box)return;
  document.querySelectorAll('[data-analytics-tab]').forEach(b=>{
    const active=b.dataset.analyticsTab===selection;
    b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
  });
  const d=readDB(),all=summary(d),autoStats=all.auto;
  if(selection==='all'){
   const items=['real','main','lab','auto'].map(k=>({key:k,label:titles[k],s:all[k],pnl:all[k].pnl}));
   box.innerHTML='<div class="analytic-compact-note">Archivi separati: i profitti non si sommano perché REAL e virtuali hanno capitali diversi.</div>'+
   '<div class="analytic-grid">'+
    card('REAL · concluse',formatInt(all.real.wins+all.real.losses+all.real.pushes),all.real.pending+' in attesa')+
    card('Principale · concluse',formatInt(all.main.wins+all.main.losses+all.main.pushes),all.main.pending+' in attesa')+
    card('LAB storico · concluse',formatInt(all.lab.wins+all.lab.losses+all.lab.pushes),all.lab.pending+' in attesa')+
    card('LAB auto · test',formatInt(autoStats.total),autoStats.pending+' in attesa')+
   '</div>'+pnlBars(items)+rateBars(items);
   if(autoError)box.innerHTML+='<p class="muted small">Impossibile aggiornare il LAB automatico: '+escape(autoError)+'. I dati locali restano disponibili.</p>';
   return;
  }
  const s=all[selection],closed=s.wins+s.losses+s.pushes;
  const title=titles[selection];
  let html='<div class="analytic-selected-title">'+escape(title)+'</div><div class="analytic-grid">'+
   card('Totale giocate',formatInt(s.total),s.pending+' in attesa')+
   card('Vinte / Perse',formatInt(s.wins)+' / '+formatInt(s.losses),s.pushes+' rimborsate')+
   card('Profitto / perdita',eur(s.pnl),'Solo esiti contabilizzati',s.pnl<0?'negative':'positive')+
   card('ROI',pct(roi(s)),Number.isFinite(roi(s))?'Su puntate con esito chiuso':'Puntate totali non verificabili')+
   '</div>'+rateBars([{label:title,s}]);
  if(s.bankroll!==null)html+='<p class="muted small">Bankroll di riferimento: <b>'+escape(eur(s.bankroll))+'</b>. I movimenti nuovi con esito vengono aggiunti al dato consolidato.</p>';
  const breakdown=selection==='main'?mainSplit(d):selection==='real'?realSplit(d):selection==='auto'?autoSplit():[];
  if(breakdown.length){
   html+='<div class="analytic-divider"></div><div class="analytic-chart-label">'+
     (selection==='main'?'CORE e VALUE · principale':selection==='real'?'CORE e VALUE · REAL':'Confronto strategie · LAB automatico')+'</div>'+
     pnlBars(breakdown.map(x=>({...x,pnl:x.s.pnl})))+rateBars(breakdown);
  }else if(selection==='real'){
   html+='<p class="muted small">Dettaglio CORE/VALUE non ancora riconciliato nei record storici: non mostro percentuali parziali come definitive.</p>';
  }
  html+='<div class="analytic-divider"></div>'+trend(d,selection);
  if(selection==='lab')html+='<p class="muted small">Il LAB storico è separato dai test del motore automatico.</p>';
  if(selection==='auto')html+='<p class="muted small">Dati del motore pubblico, solo test virtuali; aggiornamento '+escape(auto?.last_run?readableDate(auto.last_run):'non disponibile')+'.</p>';
  box.innerHTML=html;
 }
 async function fetchAuto(){
  try{
   const res=await fetch('./data/lab_auto.json?fresh='+Date.now(),{cache:'no-store'});
   if(!res.ok)throw Error('HTTP '+res.status);
   const d=await res.json();if(d.schema!=='scanner-conte-lab-v1'||!Array.isArray(d.records))throw Error('Formato non riconosciuto');
   auto=d;autoError=null;
  }catch(e){autoError=e.message;}
  render();
 }
 document.querySelectorAll('[data-analytics-tab]').forEach(b=>b.addEventListener('click',()=>{selection=b.dataset.analyticsTab;render();}));
 window.addEventListener('scanner-conte:records-changed',render);
 window.addEventListener('focus',()=>{fetchAuto();});
 const btn=$('analytics-refresh');if(btn)btn.addEventListener('click',fetchAuto);
 render();fetchAuto();
})();
