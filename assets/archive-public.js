/* Scanner Conte LIVE V0.8.4 — registri indipendenti, sola lettura dei LAB pubblici.
 * REAL, principale e LAB storico rimangono nel localStorage esistente (gestito da app.js).
 * LAB auto e LAB 1X2 sono letti separatamente da GitHub: nessuna somma e nessuna scrittura.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('[data-register-tab]')];
const local=$('archive-local-panel'),publicPanel=$('archive-public-panel');
const summary=$('archive-public-summary'),results=$('archive-public-results');
const statusFilter=$('public-status-filter'),dayFilter=$('public-day-filter');
const refreshButton=$('public-archive-refresh'),bookSelect=$('book-filter');
if(!tabs.length||!local||!publicPanel||!summary||!results||!statusFilter||!dayFilter||!bookSelect)return;
const endpoints={
 auto:{url:'./data/lab_auto.json',schema:'scanner-conte-lab-v1',title:'LAB automatico · pilota 1X2 e Over 2,5'},
 daily:{url:'./data/daily_virtual_lab.json',schema:'scanner-conte-daily-virtual-v1',title:'LAB quotidiano · quote 1X2'}
};
const cache={auto:null,daily:null},errors={auto:null,daily:null};
let current='real',requestId=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const num=n=>typeof n==='number'&&Number.isFinite(n);
const money=n=>(n>0?'+':'')+new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const romeDay=s=>{try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));}catch{return ''; }};
const today=()=>romeDay(new Date());
const shiftDay=d=>{const value=new Date(today()+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+d);return value.toISOString().slice(0,10);};
const stamp=s=>{const d=new Date(s);return Number.isFinite(d.valueOf())?d.toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';};
const dateTitle=d=>{
 const todayKey=today(),prefix=d===todayKey?'Oggi':d===shiftDay(-1)?'Ieri':d===shiftDay(1)?'Domani':null;
 const date=new Date(d+'T12:00:00Z');
 const pretty=Number.isFinite(date.valueOf())?new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(date):d;
 return prefix?prefix+' · '+pretty:pretty;
};
const settled=r=>['won','lost','push','void'].includes(r.status);
const statusText=r=>r.status==='won'?'VINTA':r.status==='lost'?'PERSA':r.status==='push'||r.status==='void'?'RIMBORSATA':'IN ATTESA';
const statusStyle=r=>r.status==='won'?'reg-won':r.status==='lost'?'reg-lost':'reg-pending';
const strategy=r=>r.strategy==='FAVORITA_1X2_CONTROLLO'?'Favorita 1X2':r.strategy==='OVER25_CONTROLLO'?'Over 2,5':r.market==='1X2'?'1X2':String(r.strategy||r.market||'Test');
const selection=r=>r.selection==='Home'?'1 (casa)':r.selection==='Away'?'2 (trasferta)':r.selection==='Draw'?'X (pareggio)':String(r.selection||'—');
const safeURL=u=>typeof u==='string'&&/^https:\/\/(tipsaudit\.com\/|www\.tipsaudit\.com\/)/.test(u)?u:null;
const kickoffTime=r=>Number.isFinite(Date.parse(r.kickoff||''))?Date.parse(r.kickoff):0;
function recordCard(r){
 const isDone=settled(r),isPast=kickoffTime(r)<Date.now();
 const note=!isDone&&isPast?'Esito ancora da verificare':isDone?'Conclusa':'Da disputare';
 const source=safeURL(r.reference);
 const score=r.score?'<span>Risultato '+esc(r.score)+'</span>':r.verified_ft_result?'<span>Esito 1X2: '+esc(r.verified_ft_result)+'</span>':'';
 const settledValue=isDone&&num(r.pnl)?'<strong class="'+(r.pnl>=0?'positive':'negative')+'">'+esc(money(r.pnl))+'</strong>':'';
 return '<article class="surface pad register-record">'+
   '<div class="reg-record-top"><span class="reg-status '+statusStyle(r)+'">'+statusText(r)+'</span>'+
   '<span class="muted small">'+esc(stamp(r.kickoff))+'</span></div>'+
   '<h3>'+esc(r.match||'Partita non specificata')+'</h3>'+
   '<p class="muted small">'+esc(r.league||'')+' · '+esc(r.bookmaker||'Bookmaker non specificato')+'</p>'+
   '<div class="reg-record-pick"><b>'+esc(strategy(r))+'</b> · '+esc(selection(r))+
     ' <strong>@'+esc(r.odds??'—')+'</strong> · '+esc(money(num(r.stake_virtual)?r.stake_virtual:1).replace('+',''))+' virtuale</div>'+
   '<div class="reg-record-bottom"><span>'+esc(note)+'</span>'+score+settledValue+
   (source?'<a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">Fonte quota</a>':'')+
   '</div><p class="muted tiny">Registrata prima della partita: '+esc(stamp(r.captured_at))+'</p></article>';
}
function dateGroups(rows){
 let last='',html='';
 for(const r of rows){
  const day=romeDay(r.kickoff)||'Data sconosciuta';
  if(day!==last){html+='<h4 class="reg-date-heading">'+esc(dateTitle(day))+'</h4>';last=day;}
  html+=recordCard(r);
 }
 return html;
}
function renderPublic(){
 if(!endpoints[current])return;
 const d=cache[current],error=errors[current];
 if(!d){
  summary.innerHTML='<strong>'+esc(endpoints[current].title)+'</strong><p class="muted small">'+(error?'Impossibile caricare i dati: '+esc(error):'Caricamento archivio da GitHub…')+'</p>';
  results.innerHTML='';return;
 }
 const all=d.records,done=all.filter(settled),pending=all.filter(r=>r.status==='pending');
 const profit=done.reduce((n,r)=>n+(num(r.pnl)?r.pnl:0),0);
 const checked=current==='daily'?d.last_check:d.last_run;
 const origin=current==='daily'?'Fonte quote: TipsAudit (non necessariamente Bet365).':'LAB pilota precedente: quote registrate in origine da fonti diverse.';
 summary.innerHTML='<strong>'+esc(endpoints[current].title)+'</strong>'+
  '<div class="reg-summary-grid"><div><span>Totale</span><b>'+all.length+'</b></div><div><span>In attesa</span><b>'+pending.length+'</b></div>'+
  '<div><span>Concluse</span><b>'+done.length+'</b></div><div><span>Bilancio virtuale</span><b class="'+(profit>=0?'positive':'negative')+'">'+esc(money(profit))+'</b></div></div>'+
  '<p class="muted small">'+esc(origin)+' Ultima acquisizione quote: '+esc(checked?stamp(checked):'non disponibile')+'.</p>'+
  (error?'<p class="muted small">Visualizzo l’ultima copia caricata. Aggiornamento non riuscito: '+esc(error)+'</p>':'');
 const day=dayFilter.value,allowed=day==='all'?null:day==='today'?today():day==='yesterday'?shiftDay(-1):shiftDay(1);
 const allowedRows=allowed?all.filter(r=>romeDay(r.kickoff)===allowed):all;
 const upcoming=allowedRows.filter(r=>r.status==='pending').sort((a,b)=>kickoffTime(a)-kickoffTime(b));
 const finished=allowedRows.filter(settled).sort((a,b)=>kickoffTime(b)-kickoffTime(a));
 let html='';
 if(statusFilter.value!=='closed'){
  html+='<div class="reg-group-title"><h3>In attesa</h3><span>'+upcoming.length+' test</span></div>'+
  (upcoming.length?dateGroups(upcoming):'<p class="surface pad muted small">Nessuna giocata in attesa con questi filtri.</p>');
 }
 if(statusFilter.value!=='pending'){
  html+='<div class="reg-group-title"><h3>Concluse</h3><span>'+finished.length+' test</span></div>'+
  (finished.length?dateGroups(finished):'<p class="surface pad muted small">Nessuna giocata conclusa con questi filtri.</p>');
 }
 results.innerHTML=html;
}
async function loadPublic(force=false){
 if(!endpoints[current])return;
 const tab=current,token=++requestId;
 if(cache[tab]&&!force){renderPublic();return;}
 if(cache[tab])renderPublic();
 else{summary.textContent='Caricamento registro '+endpoints[tab].title+'…';results.innerHTML='';}
 refreshButton.disabled=true;
 try{
  const res=await fetch(endpoints[tab].url+'?t='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const d=await res.json();
  if(d.schema!==endpoints[tab].schema||!Array.isArray(d.records))throw Error('Archivio non valido');
  cache[tab]=d;errors[tab]=null;
 }catch(e){errors[tab]=String(e.message||e);}
 if(current===tab&&token===requestId){refreshButton.disabled=false;renderPublic();}
}
function select(tab){
 if(!['real','main','lab','auto','daily'].includes(tab))return;
 current=tab;
 tabs.forEach(b=>{let chosen=b.dataset.registerTab===tab;b.classList.toggle('active',chosen);b.setAttribute('aria-pressed',String(chosen));});
 const isPublic=Boolean(endpoints[tab]);
 local.hidden=isPublic;publicPanel.hidden=!isPublic;
 if(isPublic){
  statusFilter.value='all';dayFilter.value='all';
  loadPublic();
 }else{
  requestId++;
  bookSelect.value=tab;
  bookSelect.dispatchEvent(new Event('change',{bubbles:true}));
 }
}
tabs.forEach(button=>button.addEventListener('click',()=>select(button.dataset.registerTab)));
statusFilter.addEventListener('change',renderPublic);
dayFilter.addEventListener('change',renderPublic);
refreshButton.addEventListener('click',()=>loadPublic(true));
document.querySelectorAll('[data-open-register]').forEach(button=>button.addEventListener('click',()=>{
 const tab=button.dataset.openRegister;
 const nav=document.querySelector('.bottomnav [data-goto="archive"]');
 nav?.click();select(tab);
}));
window.addEventListener('focus',()=>{if(endpoints[current]&&!publicPanel.hidden)loadPublic(true);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&endpoints[current]&&!publicPanel.hidden)loadPublic(true);});
select('real');
})();
