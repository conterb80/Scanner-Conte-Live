/* Scanner Conte LIVE V0.9.2 — registro trasparente delle acquisizioni LAB.
 * Le scansioni riportano SEGNALAZIONI del feed (possono ripetersi), mentre i
 * campionati si riferiscono ai TEST acquisiti e salvati, non all'intero feed.
 * Non esegue ricerche di quote, non altera il LAB e non registra scommesse REAL.
 * Fonte dati: TipsAudit — https://tipsaudit.com/api
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const home=$('scan-audit-home'), status=$('scan-audit-status'), chooser=$('scan-audit-day'),
 summary=$('scan-audit-summary'), checksBox=$('scan-audit-checks'), leaguesBox=$('scan-audit-leagues'),
 refreshBtn=$('scan-audit-refresh');
if(!status||!chooser||!summary||!checksBox||!leaguesBox||!refreshBtn)return;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const localDay=s=>{try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));}catch{return '';}};
const localTime=s=>{try{return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(s));}catch{return '—';}};
const localDateTime=s=>{try{return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(s));}catch{return '—';}};
const labelDay=s=>{try{return new Date(s+'T12:00:00Z').toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});}catch{return s;}};
const n=v=>Number.isFinite(Number(v))&&Number(v)>=0?Number(v):0;
const number=v=>n(v).toLocaleString('it-IT');
const latestCheck=data=>[...data.checks].filter(c=>Number.isFinite(Date.parse(c.checked_at||''))).sort((a,b)=>Date.parse(b.checked_at)-Date.parse(a.checked_at))[0]||null;
let dataset=null,selected='';
function filterDay(day){
 const checks=dataset.checks.filter(x=>x.day===day).sort((a,b)=>Date.parse(a.checked_at)-Date.parse(b.checked_at));
 const records=dataset.records.filter(x=>(x.capture_day||localDay(x.captured_at))===day);
 const uniqueFixtures=new Set(records.map(x=>String(x.match||'')+'|'+String(x.kickoff||'')));
 const leagueCounts=new Map();
 for(const x of records){const league=String(x.league||'Campionato non indicato').trim()||'Campionato non indicato';
  leagueCounts.set(league,(leagueCounts.get(league)||0)+1);}
 const leagues=[...leagueCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'it'));
 return {checks,records,uniqueFixtures:uniqueFixtures.size,leagues,
  scanSignals:checks.reduce((a,c)=>a+n(c.scanned_predictions),0),
  eligible:checks.reduce((a,c)=>a+n(c.eligible_actionable),0),
  created:checks.reduce((a,c)=>a+n(c.created),0)};
}
function homeRender(){
 if(!home||!dataset)return;
 const today=localDay(new Date().toISOString()),todayData=filterDay(today),last=latestCheck(dataset);
 const textDate=last?localDateTime(last.checked_at):'nessuna';
 home.innerHTML='<div class="scan-audit-home-top"><strong>Raccolta automatica · LAB 1X2</strong>'+
  '<span class="muted small">Ultima acquisizione '+escape(textDate)+'</span></div>'+
  '<div class="scan-audit-home-stats"><span>Oggi: <b>'+number(todayData.checks.length)+'</b> scansioni</span>'+
  '<span><b>'+number(todayData.scanSignals)+'</b> segnali letti</span>'+
  '<span><b>'+number(todayData.records.length)+'</b> nuovi test</span></div>'+
  (!todayData.checks.length?'<p class="muted small scan-audit-warn">Non è ancora pubblicata una raccolta per oggi. Il motore è programmato, ma l’aggiornamento odierno non è verificato.</p>':'')+
  '<p class="muted tiny">Per i campionati e i dettagli di ogni passaggio, apri LAB → Registro scansioni.</p>';
}
function render(){
 if(!dataset)return;
 const days=[...new Set([...dataset.checks.map(x=>x.day),...dataset.records.map(x=>x.capture_day||localDay(x.captured_at))].filter(Boolean))].sort((a,b)=>b.localeCompare(a));
 if(!days.includes(selected))selected=days[0]||'';
 chooser.innerHTML=days.map(x=>'<option value="'+escape(x)+'">'+escape(labelDay(x))+'</option>').join('');
 chooser.value=selected;
 const last=latestCheck(dataset),now=Date.now(),age=last?(now-Date.parse(last.checked_at))/3600000:null;
 const old=age===null||!Number.isFinite(age)||age>26;
 status.innerHTML='<b>Fonte: <a href="https://tipsaudit.com/api" target="_blank" rel="noopener noreferrer">TipsAudit</a> · 1X2</b> '+
  '<span class="muted small">Ultima raccolta pubblicata: '+escape(last?localDateTime(last.checked_at):'non disponibile')+'.</span>'+
  (old?'<p class="muted small scan-audit-warn">Dati non recenti o scansione recente non ancora pubblicata: controllare prima di considerarli attuali.</p>':'');
 if(!selected){summary.innerHTML='<p class="muted small">Nessuna scansione storica disponibile.</p>';checksBox.innerHTML='';leaguesBox.innerHTML='';homeRender();return;}
 const d=filterDay(selected);
 summary.innerHTML=
 '<div class="scan-audit-stat"><span>Scansioni completate</span><strong>'+number(d.checks.length)+'</strong></div>'+
 '<div class="scan-audit-stat"><span>Segnalazioni lette (somma)</span><strong>'+number(d.scanSignals)+'</strong></div>'+
 '<div class="scan-audit-stat"><span>Idonee nei singoli passaggi</span><strong>'+number(d.eligible)+'</strong></div>'+
 '<div class="scan-audit-stat"><span>Partite LAB registrate</span><strong>'+number(d.uniqueFixtures)+'</strong></div>'+
 '<div class="scan-audit-stat"><span>Campionati dei test registrati</span><strong>'+number(d.leagues.length)+'</strong></div>';
 const rows=d.checks.map((x,i)=>'<tr><td>'+escape(localTime(x.checked_at))+'</td>'+
  '<td>'+number(x.scanned_predictions)+'</td><td>'+number(x.eligible_actionable)+'</td><td>'+number(x.created)+'</td></tr>').join('');
 checksBox.innerHTML=d.checks.length?
  '<div class="scan-audit-scroll"><table class="scan-audit-table"><thead><tr><th>Ora</th><th>Segnali letti</th><th>Idonei</th><th>Nuovi test</th></tr></thead><tbody>'+rows+'</tbody></table></div>':
  '<p class="muted small">Nessun passaggio registrato per questa data.</p>';
 leaguesBox.innerHTML=d.leagues.length?
  '<div class="scan-audit-league-list">'+d.leagues.map(([league,count])=>'<div class="scan-audit-league"><span>'+escape(league)+'</span><strong>'+number(count)+'</strong></div>').join('')+'</div>':
  '<p class="muted small">Nessun campionato disponibile: non sono stati registrati nuovi test in questa data.</p>';
 homeRender();
}
async function load(){
 refreshBtn.disabled=true;status.textContent='Verifico i dati pubblicati delle scansioni…';
 try{
  const res=await fetch('./data/daily_virtual_lab.json?a='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const data=await res.json();
  if(data.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(data.records)||!Array.isArray(data.checks))throw Error('Archivio non compatibile');
  dataset=data;render();
 }catch(e){
  status.textContent='Non riesco a leggere il registro delle scansioni: '+String(e.message||e);
  if(!dataset&&home)home.textContent='Raccolta LAB: dati momentaneamente non disponibili.';
 }finally{refreshBtn.disabled=false;}
}
chooser.addEventListener('change',()=>{selected=chooser.value;render();});
refreshBtn.addEventListener('click',load);
window.addEventListener('focus',()=>{if(!document.hidden)load();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
load();
})();
