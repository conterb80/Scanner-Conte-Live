/* Archivio di sola lettura delle shortlist pubblicate. */
(()=>{
'use strict';
const panel=document.getElementById('candidate-history-panel');
const summary=document.getElementById('candidate-history-summary');
const refresh=document.getElementById('candidate-history-refresh');
if(!panel||!summary||!refresh)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&#39;':'&#39;'}[c]));
const date=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleDateString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric'}):String(s||'');};
const odd=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const fmtEuro=n=>typeof n==='number'&&Number.isFinite(n)?(n>0?'+':'')+n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':'—';
function status(r){
 if(r.result_status==='won')return '<span class="candidate-hist-status win">Vinta · fonte</span>';
 if(r.result_status==='lost')return '<span class="candidate-hist-status loss">Persa · fonte</span>';
 if(r.result_status==='pending')return '<span class="candidate-hist-status pending">In attesa</span>';
 return '<span class="candidate-hist-status pending">Esito da verificare</span>';
}
function card(r){
 const label=r.ever_primary?'PRINCIPALE':'SOLO ALTERNATIVA';
 const result=r.result_status==='won'||r.result_status==='lost'?fmtEuro(r.virtual_pnl)+' virtuali':'';
 const choice=r.selection==='Home'?'1':r.selection==='Away'?'2':r.selection==='Draw'?'X':String(r.selection||'');
 return '<div class="candidate-hist-item">'+
  '<div class="candidate-hist-item-head"><b>'+esc(r.match)+'</b>'+status(r)+'</div>'+
  '<div class="candidate-hist-item-meta"><span>'+esc(label)+' · '+esc(r.category||'')+'</span><span>'+esc(r.market||'')+' '+esc(choice)+' · quota '+odd(r.first_odds)+'</span></div>'+
  '<p class="candidate-hist-item-note">'+esc(r.appearances)+' presenza/e nei rapporti · prima pubblicazione '+esc(new Date(r.first_seen).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))+
  (result?' · '+esc(result):'')+'</p></div>';
}
function show(data){
 const s=data.stats||{},rows=Array.isArray(data.records)?data.records:[];
 summary.textContent=(s.total??rows.length)+' candidate distinte · '+(s.settled??0)+' con esito · '+(s.pending??0)+' in attesa';
 const groups=new Map();
 for(const r of [...rows].reverse()){if(!groups.has(r.day))groups.set(r.day,[]);groups.get(r.day).push(r);}
 let html='<p class="muted small">Archivio delle candidate pubblicate, anche se non giocate. Una partita mostrata più volte conta una sola volta. Le REAL rimangono private sul tuo telefono.</p>'+
 '<div class="candidate-hist-kpis"><div><strong>'+esc(String(s.total??0))+'</strong><span>Candidate</span></div><div><strong>'+esc(String(s.won??0))+' / '+esc(String(s.lost??0))+'</strong><span>Vinte / perse dalla fonte</span></div><div><strong>'+esc(fmtEuro(s.virtual_pnl))+'</strong><span>Bilancio virtuale teorico</span></div></div>'+
 '<p class="muted tiny">Quote di riferimento di altri bookmaker, non Bet365. Risultati forniti dal medesimo fornitore dei test LAB: non ancora verificati indipendentemente. Nessuna puntata REAL automatica.</p>';
 let first=true;
 for(const [day,items] of groups){html+='<details class="candidate-hist-day" '+(first?'open':'')+'><summary>'+esc(date(day))+' · '+items.length+' candidate</summary><div class="candidate-hist-items">'+items.map(card).join('')+'</div></details>';first=false;}
 if(!groups.size)html+='<p class="muted small">Nessuna candidata storica disponibile.</p>';
 panel.innerHTML=html;
}
async function load(){
 refresh.disabled=true;
 try{const res=await fetch('./data/scanner_candidate_history.json?t='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);
 const data=await res.json();if(data.schema!=='scanner-conte-candidate-history-v1'||!Array.isArray(data.records))throw Error('Formato inatteso');
 show(data);
 }catch(e){summary.textContent='Archivio momentaneamente non disponibile';panel.textContent='Impossibile leggere lo storico: '+String(e.message||e);}
 finally{refresh.disabled=false;}
}
refresh.addEventListener('click',load);load();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();
