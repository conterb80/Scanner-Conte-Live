/* Scanner Conte LIVE — nuovo archivio forward virtuale 1X2, separato dallo storico.
 * Attribuzione obbligatoria: TipsAudit https://tipsaudit.com/api
 */
(()=>{
'use strict';
const box=document.getElementById('daily-virtual-panel');
if(!box)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fmt=s=>{try{return new Date(s).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '—';}};
const eur=n=>(n>0?'+':'')+Number(n).toFixed(2).replace('.',',')+' €';
async function refresh(){
 box.innerHTML='<div class="muted small">Aggiorno i test virtuali quotidiani…</div>';
 try{
  const r=await fetch('./data/daily_virtual_lab.json?t='+Date.now(),{cache:'no-store'});
  if(r.status===404){box.innerHTML='<p class="muted small">Raccolta giornaliera appena configurata: nessuna quota ancora registrata. Storico precedente invariato.</p>';return;}
  if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();
  if(d.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(d.records))throw Error('Formato archivio non compatibile');
  const records=d.records,pending=records.filter(x=>x.status==='pending').length,
   done=records.filter(x=>['won','lost'].includes(x.status));
  const pnl=done.reduce((n,x)=>n+Number(x.pnl||0),0);
  const latest=d.checks?.[d.checks.length-1];
  let html='<p class="muted small"><b>1X2 — benchmark esterno TipsAudit</b> · Solo virtuali, indipendenti dai 30 test precedenti. '+
   'Dati: <a href="https://tipsaudit.com/api" target="_blank" rel="noopener noreferrer">TipsAudit</a> (attribuzione). Le quote mostrate potrebbero non essere disponibili su Bet365.</p>'+
   '<div class="lab-auto-stats"><div><span>Test registrati</span><strong>'+records.length+'</strong></div>'+
   '<div><span>In attesa</span><strong>'+pending+'</strong></div><div><span>Chiusi</span><strong>'+done.length+'</strong></div>'+
   '<div><span>Risultato teorico</span><strong>'+eur(pnl)+'</strong></div></div>'+
   '<p class="muted small">Ultimo controllo: '+esc(latest?fmt(latest.checked_at):'—')+
   ' · Candidati verificabili: '+esc(latest?.eligible_actionable??'—')+
   ' · Nuovi test: '+esc(latest?.created??'—')+'.</p>';
  if(!records.length){html+='<p class="muted small">Nessuna quota idonea registrata prima del via. Non sono state create simulazioni inventate.</p>';}
  else html+=records.slice().reverse().slice(0,15).map(x=>
   '<article class="candidate"><div class="ctop"><span class="tag lab">TEST · '+esc(x.status==='pending'?'IN ATTESA':x.status==='won'?'VINTA':'PERSA')+
   '</span><span class="muted small">'+esc(fmt(x.kickoff))+'</span></div>'+
   '<h3>'+esc(x.match)+'</h3><p class="muted small">'+esc(x.league)+' · '+esc(x.bookmaker)+'</p>'+
   '<div class="csel">1X2 '+esc(x.selection)+' @'+esc(x.odds)+' · 1 € virtuale</div>'+
   '<p class="muted small">Quota osservata: '+esc(fmt(x.captured_at))+
   (x.score?' · FT '+esc(x.score):'')+
   (x.status!=='pending'&&x.pnl!==null?' · '+esc(eur(x.pnl)):'')+
   ' · <a href="'+(String(x.reference||'').startsWith('https://tipsaudit.com/')?esc(x.reference):'https://tipsaudit.com/api')+'" target="_blank" rel="noopener noreferrer">Fonte</a></p></article>'
  ).join('');
  box.innerHTML=html;
 }catch(e){box.innerHTML='<p class="muted small">Nuovo laboratorio momentaneamente non leggibile: '+esc(e.message)+'. Lo storico resta disponibile.</p>';}
}
document.getElementById('lab-auto-refresh')?.addEventListener('click',refresh);
refresh();
})();
