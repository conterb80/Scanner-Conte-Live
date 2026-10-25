/* Scanner Conte LIVE V0.3 — calendario pubblico con filtri.
 * Conserva l'intero feed e lo storico locale, non genera pronostici.
 */
(()=>{
'use strict';
const root=id=>document.getElementById(id);
const summary=root('feed-summary'),rows=root('feed-fixtures'),refresh=root('feed-refresh');
const scope=root('feed-scope'),day=root('feed-day'),country=root('feed-country'),league=root('feed-league');
if(!summary||!rows||!refresh||!scope||!day||!country||!league)return;
const PRIORITY={"Italy":["Serie A","Serie B","Serie C - Girone A","Serie C - Girone B","Serie C - Girone C"],"England":["Premier League","Championship","League One","League Two"],"Germany":["Bundesliga","2. Bundesliga","3. Liga"],"Spain":["La Liga","Segunda División"],"France":["Ligue 1","Ligue 2"],"Scotland":["Premiership","Championship","League One"],"Netherlands":["Eredivisie","Eerste Divisie"],"Portugal":["Primeira Liga","Segunda Liga"],"Belgium":["Jupiler Pro League","Challenger Pro League"],"Austria":["Bundesliga","2. Liga"],"Switzerland":["Super League","Challenge League"]};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const format=iso=>{try{return new Date(iso).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '—';}};
const dateRome=iso=>{try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}catch{return '';}};
const today=()=>dateRome(new Date().toISOString());
const tomorrow=()=>{const t=today();return new Date(Date.parse(t+'T12:00:00Z')+86400000).toISOString().slice(0,10);};
const isMain=m=>(PRIORITY[m.country]||[]).includes(m.league);
let feed=null;
function upcoming(){
  if(!feed)return[];
  const now=Date.now(), d=day.value, dateWanted=d==='today'?today():d==='tomorrow'?tomorrow():null;
  return (feed.fixtures||[]).filter(m=>['NS','TBD'].includes(m.status)&&m.kickoff&&Date.parse(m.kickoff)>now)
  .filter(m=>d==='all'||dateRome(m.kickoff)===dateWanted)
  .filter(m=>scope.value==='all'||isMain(m));
}
function makeOptions(node,values,label){
  const previous=node.value;node.innerHTML='<option value="all">'+esc(label)+'</option>'+
  values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
  node.value=values.includes(previous)?previous:'all';
}
function filters(){
  const basic=upcoming();
  makeOptions(country,[...new Set(basic.map(m=>m.country))].sort((a,b)=>a.localeCompare(b,'it')),'Tutti i paesi');
  const byCountry=basic.filter(m=>country.value==='all'||m.country===country.value);
  makeOptions(league,[...new Set(byCountry.map(m=>m.league))].sort((a,b)=>a.localeCompare(b,'it')),'Tutte le leghe');
  render(basic);
}
function render(basic){
  const shown=basic.filter(m=>(country.value==='all'||m.country===country.value)&&(league.value==='all'||m.league===league.value))
    .sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
  if(!feed||feed.status!=='ready'){rows.innerHTML='';return;}
  if(!shown.length){rows.innerHTML='<div class="surface pad muted small">Nessuna partita futura con questi filtri. Prova un altro giorno, paese oppure «Tutte le competizioni».</div>';return;}
  const limit=40, selected=shown.slice(0,limit);
  rows.innerHTML='<p class="muted small feed-count">'+shown.length+' partite future con i filtri selezionati. Ne mostro '+selected.length+'. Nessuna è ancora una selezione di scommessa.</p>'+
  selected.map(m=>'<article class="candidate"><div class="ctop"><span class="tag main">'+esc(m.country)+'</span><span class="muted small">'+esc(format(m.kickoff))+'</span></div><h3>'+esc(m.home)+' – '+esc(m.away)+'</h3><p class="muted small">'+esc(m.league)+' · Calendario verificato · Quota non disponibile</p></article>').join('');
}
async function load(){
 refresh.disabled=true;summary.textContent='Lettura del palinsesto automatico…';rows.innerHTML='';
 try{
  const response=await fetch('./data/fixtures_latest.json?fresh='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const next=await response.json();if(next.schema!=='scanner-conte-fixtures-v1')throw Error('Feed non riconosciuto');
  feed=next;
  if(feed.status!=='ready'){
   summary.innerHTML='<b>Motore in attesa della prima raccolta.</b><p class="muted small">Controlla la raccolta GitHub Actions. I dati del tuo storico restano sul dispositivo.</p>';
   return;
  }
  const info=feed.coverage||{};const prioritized=(feed.fixtures||[]).filter(isMain);
  const uniqueLeagues=new Set(prioritized.map(m=>m.country+'/'+m.league)).size;
  summary.innerHTML='<strong>'+esc(info.eligible_matches)+' partite raccolte</strong> da '+esc(info.eligible_competitions)+' competizioni nei paesi configurati.'+
    '<p class="muted small"><b>'+prioritized.length+' incontri</b> in <b>'+uniqueLeagues+' campionati prioritari</b> nel periodo coperto. Gli altri restano disponibili scegliendo «Tutte le competizioni».</p>'+
    '<p class="muted small">Ultimo aggiornamento: '+esc(format(feed.collected_at))+' · Date nel feed: '+esc((feed.dates||[]).join(', '))+'</p>'+
    '<p class="muted small">Solo calendari e risultati; quote, probabilità e simulazioni automatiche non sono ancora attive.</p>';
  filters();
 }catch(e){summary.innerHTML='<b>Feed non disponibile.</b><p class="muted small">'+esc(e.message)+' — i dati personali non sono interessati.</p>';}
 finally{refresh.disabled=false;}
}
scope.addEventListener('change',()=>{country.value='all';league.value='all';filters();});
day.addEventListener('change',()=>{country.value='all';league.value='all';filters();});
country.addEventListener('change',()=>{league.value='all';filters();});
league.addEventListener('change',()=>render(upcoming()));
refresh.addEventListener('click',load);
load();
})();