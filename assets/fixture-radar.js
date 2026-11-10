/* Radar di osservazione: calendario indipendente, non suggerimenti di puntata. */
(()=>{
'use strict';
const status=document.getElementById('fixture-radar-status');
const target=document.getElementById('fixture-radar-list');
const refresh=document.getElementById('fixture-radar-refresh');
if(!status||!target||!refresh)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=x=>{let d=new Date(x);return Number.isFinite(d.getTime())?
 d.toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'};
const day=x=>{let d=new Date(x);return Number.isFinite(d.getTime())?
 d.toLocaleDateString('it-IT',{timeZone:'Europe/Rome',weekday:'long',day:'numeric',month:'long'}):'—'};
const euroOdd=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const validLink=url=>{try{const u=new URL(url);return u.protocol==='https:'&&
 ['www.espn.com','espn.com','www.football-data.co.uk'].includes(u.hostname)?u.href:null;}catch{return null}};
function render(data){
 const rows=Array.isArray(data.fixtures)?data.fixtures:[];
 const fresh=Number.isFinite(Date.parse(data.generated_at))&&Date.now()-Date.parse(data.generated_at)<18*3600000;
 const upcoming=rows.filter(r=>Number.isFinite(Date.parse(r.kickoff))&&Date.parse(r.kickoff)>Date.now()+5*60000);
 const nWithSnapshot=upcoming.filter(r=>r.quote_status==='HISTORICAL_SNAPSHOT_NOT_LIVE').length;
 const src=data.source_status||{},additional=src.additional_sources||{};
 const sources=['OpenLigaDB','TheSportsDB'].map((name,i)=>{
  const v=additional[i===0?'openligadb':'thesportsdb'];
  return v?name+' '+(v.ok||0)+'/'+(v.requests||0)+' risposte · '+(v.fixtures||0)+' gare':' '+name+' non ancora verificata';
 });
 status.textContent='Calendario '+(fresh?'aggiornato':'non recente')+' · '+upcoming.length+' incontri futuri · '+nWithSnapshot+' con quote storiche NON live · Ultima raccolta '+stamp(data.generated_at)+'. Fonti aggiuntive: '+sources.join('; ')+'.';
 if(!upcoming.length){
  target.innerHTML='<p class="muted small">Nessuna partita futura rilevata dalle fonti coperte in questa finestra. Non significa che non si giochi altrove. Nessuna candidata o quota viene creata artificialmente.</p>';return;
 }
 const groups=new Map();
 for(const r of upcoming){const k=day(r.kickoff);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 let html='<p class="muted small"><strong>Calendario per lo scouting, non pronostici.</strong> Le fonti coprono soltanto alcuni tornei. Nessuna stima di probabilità indipendente o quota Bet365 corrente è disponibile in questa sezione.</p>';
 for(const [k,values] of groups){
  const perLeague=new Map();for(const r of values){const league=r.league||'Competizione non indicata';if(!perLeague.has(league))perLeague.set(league,[]);perLeague.get(league).push(r)}
  html+='<h3 class="fixture-radar-day">'+esc(k)+' · '+values.length+' partite</h3>';
  for(const [league,items] of perLeague){
   html+='<details class="fixture-radar-league"><summary>'+esc(league)+' <span class="muted small">· '+items.length+'</span></summary><div class="fixture-radar-fixtures">';
   for(const r of items){
    const odds=r.odds&&typeof r.odds==='object'?r.odds:null;
    const quoteText=odds&&Object.keys(odds).length?
     'Snapshot NON live: '+Object.entries(odds).slice(0,5).map(([key,n])=>esc(key)+' '+esc(euroOdd(n))).join(' · ')+
     (r.quote_snapshot_at?' (raccolto '+esc(stamp(r.quote_snapshot_at))+')':''):'Nessuna quota verificata';
    const u=validLink(r.source_url);
    html+='<article class="fixture-radar-row"><div><strong>'+esc(r.match)+'</strong><small>'+esc(stamp(r.kickoff))+' · '+esc(r.source||'Fonte non indicata')+'</small>'+
     '<small>'+quoteText+'</small></div>'+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">Fonte</a>':'')+'</article>';
   }
   html+='</div></details>';
  }
 }
 target.innerHTML=html;
}
async function load(){
 refresh.disabled=true;
 try{
  const res=await fetch('./data/fixture_radar.json?t='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw Error('Feed non ancora pubblicato');
  const data=await res.json();
  if(data.schema!=='scanner-conte-fixture-radar-v1')throw Error('Formato non compatibile');
  render(data);
 }catch(e){
  status.textContent='Radar in attesa del primo aggiornamento';
  target.innerHTML='<p class="muted small">'+esc(e.message)+'. Lo Scanner e gli archivi esistenti continuano a funzionare separatamente.</p>';
 }finally{refresh.disabled=false;refresh.textContent='Aggiorna'}
}
refresh.addEventListener('click',load);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
load();
})();
