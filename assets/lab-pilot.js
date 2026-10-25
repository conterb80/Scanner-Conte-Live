/* Scanner Conte LIVE V0.4 — mostra esperimenti pubblici del LAB pilota.
 * Lo storico REAL, PRINCIPALE e LAB preesistente rimane SOLO nel browser.
 */
(()=>{
'use strict';
const info=document.getElementById('lab-auto-info');
const list=document.getElementById('lab-auto-list');
const reload=document.getElementById('lab-auto-refresh');
if(!info||!list||!reload)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const date=s=>{try{return new Date(s).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '—';}};
const money=n=>(n>=0?'+':'')+Number(n).toFixed(2).replace('.',',')+' €';
const humanStrategy=s=>s==='FAVORITA_1X2_CONTROLLO'?'Favorita 1X2 (controllo)':s==='OVER25_CONTROLLO'?'Over 2,5 (controllo)':s;
async function refresh(){
 reload.disabled=true;info.textContent='Leggo gli esperimenti del motore…';list.innerHTML='';
 try{
  const [labReq,oddsReq]=await Promise.all([
    fetch('./data/lab_auto.json?t='+Date.now(),{cache:'no-store'}),
    fetch('./data/odds_latest.json?t='+Date.now(),{cache:'no-store'})
  ]);
  if(!labReq.ok||!oddsReq.ok)throw Error('File LAB o quote non disponibile');
  const lab=await labReq.json(),odds=await oddsReq.json();
  if(lab.schema!=='scanner-conte-lab-v1'||odds.schema!=='scanner-conte-odds-v1')throw Error('Formato LAB non valido');
  const records=Array.isArray(lab.records)?lab.records:[];
  const won=records.filter(x=>x.status==='won'),lost=records.filter(x=>x.status==='lost');
  const pending=records.filter(x=>x.status==='pending');
  const pnl=records.reduce((sum,x)=>sum+(Number.isFinite(x.pnl)?x.pnl:0),0);
  const settled=won.length+lost.length;
  const roi=settled?((pnl/settled)*100).toFixed(1).replace('.',',')+'%':'—';
  info.innerHTML='<div class="lab-auto-stats"><div><span>Test virtuali</span><strong>'+records.length+'</strong></div><div><span>In attesa</span><strong>'+pending.length+'</strong></div><div><span>Chiusi</span><strong>'+settled+'</strong></div><div><span>Risultato*</span><strong>'+money(pnl)+'</strong></div></div>'+
    '<p class="muted small">Ultimo controllo: '+esc(lab.last_run?date(lab.last_run):'non ancora eseguito')+
    ' · Campione quote: '+esc(odds.with_odds||0)+' / '+esc(odds.requested||0)+' incontri esaminati.</p>'+
    '<p class="muted small">ROI sperimentale '+roi+'. *Risultato su stake virtuale 1 € per test chiuso; non un guadagno reale. Quote della fonte indicata, non necessariamente Bet365.</p>'+
    '<p class="muted small">Le strategie sono baseline di confronto. Le probabilità derivano dal mercato e non rappresentano un vantaggio dimostrato.</p>';
  if(!records.length){list.innerHTML='<div class="surface pad muted small">Il LAB pilota è pronto ma non ha ancora registrato esperimenti. I test partiranno solo quando il motore trova quote valide prima del calcio d’inizio.</div>';return;}
  list.innerHTML=records.slice().reverse().slice(0,18).map(r=>{
    const result=r.status==='won'?'VINTA':r.status==='lost'?'PERSA':'IN ATTESA';
    const p=r.pnl===null?'—':money(r.pnl);
    return '<article class="candidate"><div class="ctop"><span class="tag lab">VIRTUALE · '+esc(r.status)+'</span><span class="muted small">'+esc(date(r.kickoff))+'</span></div><h3>'+esc(r.match)+'</h3>'+
      '<p class="muted small">'+esc(r.league)+' · '+esc(r.bookmaker)+'</p><div class="csel">'+esc(humanStrategy(r.strategy))+' · '+esc(r.selection)+' @'+esc(r.odds)+'</div>'+
      '<p class="muted small">Prepartita '+esc(date(r.captured_at))+' · Quota fissata · Stake 1 € virtuale · '+result+' '+p+(r.score?' · '+esc(r.score):'')+'</p></article>';
  }).join('');
 }catch(e){info.innerHTML='<strong>Archivio LAB pilota non disponibile.</strong><p class="muted small">'+esc(e.message)+'. Lo storico privato sul telefono non viene toccato.</p>';}
 finally{reload.disabled=false;}
}
reload.addEventListener('click',refresh);refresh();
})();