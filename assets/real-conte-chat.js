/* Archivio REAL CONTE in chat — consultazione pubblica; nessuna modifica al motore né ai saldi. */
(()=>{
'use strict';
const root=document.getElementById('chat-analysis-content');
const refresh=document.getElementById('chat-analysis-refresh');
if(!root||!refresh)return;
let sessions=[],selected='';
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const number=x=>Number(x).toLocaleString('it-IT',{maximumFractionDigits:2});
const day=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x))?String(x).split('-').reverse().join('/'):'—';
const stamp=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';};
const pending=p=>p.status==='won'?'Vinta virtuale':p.status==='lost'?'Persa virtuale':p.status==='void'?'Rimborsata virtuale':Date.parse(p.kickoff)<Date.now()-3*3600000?'Esito non ancora verificato':'In programma';
const state=x=>x==='won'?'main':x==='lost'?'lab':'';
const stat=(label,note)=>'<div class="chat-analysis-kpi"><strong>'+esc(label)+'</strong><span>'+esc(note)+'</span></div>';
function pickCard(p){
 const stake=Number(p.stake)||0,odds=Number(p.odds)||0,isControl=p.kind==='CONTROLLO';
 const pnl=p.status==='won'?stake*(odds-1):p.status==='lost'?-stake:p.status==='void'?0:null;
 return '<article class="surface pad chat-analysis-pick">'+
 '<div class="chat-analysis-pick-head"><span class="tag '+(isControl?'lab':'main')+'">'+esc(isControl?'SOLO CONTROLLO':'VIRTUALE · SIMULAZIONE')+'</span><span class="muted tiny">'+esc(stamp(p.kickoff))+'</span></div>'+
 '<h3>'+esc(p.match)+'</h3><div class="chat-analysis-line"><strong>'+esc(p.pick)+'</strong><span>Quota riferimento '+esc(number(odds))+'</span></div>'+
 '<p class="muted small">'+esc(isControl?'Nessuna puntata':'Puntata ipotetica: '+number(stake)+' €')+' · <span class="tag '+state(p.status)+'">'+esc(pending(p))+'</span>'+
 (pnl!==null?' · P/L simulato '+esc(number(pnl))+' €':'')+'</p>'+
 (p.score?'<p class="muted small"><strong>Finale '+esc(p.score)+'</strong> · '+esc(p.result_source||'Fonte non indicata')+'</p>':'')+
 '<details><summary>Motivi, rischi e fonte della quota</summary><p class="muted small">'+esc(p.reason)+'</p><p class="muted tiny">Fonte quota: '+esc(p.oddsSource)+' — non prezzo Bet365 aggiornato.</p></details>'+
 '</article>';
}

const fmtEuro=v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
function calculateBalance(items){
 const real=items.filter(p=>p.kind!=='CONTROLLO'&&Number(p.stake)>0);
 const closed=real.filter(p=>['won','lost','void'].includes(p.status));
 const stake=closed.reduce((n,p)=>n+Number(p.stake),0);
 const pnl=closed.reduce((n,p)=>n+(p.status==='won'?Number(p.stake)*(Number(p.odds)-1):p.status==='lost'?-Number(p.stake):0),0);
 return {closed:closed.length,wins:closed.filter(p=>p.status==='won').length,
  losses:closed.filter(p=>p.status==='lost').length,
  pending:real.length-closed.length,stake,pnl:Math.round(pnl*100)/100,
  roi:stake>0?(pnl/stake)*100:null};
}
function balanceView(title,items){
 const b=calculateBalance(items);
 const positive=b.pnl>0,negative=b.pnl<0;
 const cls=b.closed?(positive?'positive':negative?'negative':'neutral'):'neutral';
 const roi=b.roi===null?'—':(b.roi>0?'+':b.roi<0?'−':'')+Math.abs(b.roi).toLocaleString('it-IT',{maximumFractionDigits:1})+'%';
 return '<section class="surface pad chat-analysis-balance"><div class="chat-analysis-balance-head"><strong>'+esc(title)+'</strong>'+
   '<span>'+b.pending+' test in attesa</span></div>'+
   '<div class="chat-analysis-balance-grid">'+
   '<div class="chat-analysis-balance-value"><span>Giocate vinte</span><strong>'+b.wins+'/'+b.closed+'</strong></div>'+
   '<div class="chat-analysis-balance-value '+cls+'"><span>Profitto netto</span><strong>'+(b.closed?esc(fmtEuro(b.pnl)):'—')+'</strong></div>'+
   '<div class="chat-analysis-balance-value '+cls+'"><span>ROI virtuale</span><strong>'+esc(roi)+'</strong></div>'+
   '</div><p class="muted tiny">'+(b.closed?esc(b.stake.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' € virtuali puntati sulle '+b.closed+' giocate concluse. '):'Nessuna giocata conclusa da contabilizzare. ')+
   'Le partite di controllo sono escluse e i test in attesa non incidono su profitto o ROI.</p></section>';
}
function fixtureSection(s){
 if(!Array.isArray(s.fixtures)||!s.fixtures.length)return '<p class="muted small">Elenco completo non contenuto nel registro congelato di questa giornata. Non ricostruito a posteriori.</p>';
 const byCompetition=new Map();
 for(const item of s.fixtures){
  const [competition,match,label,reason]=item;
  if(!byCompetition.has(competition))byCompetition.set(competition,[]);
  byCompetition.get(competition).push([match,label,reason]);
 }
 let out='';
 for(const [competition,items] of byCompetition){
  out+='<details class="chat-analysis-league"><summary>'+esc(competition)+' <span class="muted small">· '+items.length+' partite</span></summary>'+
   '<div class="chat-analysis-matches">'+items.map(([match,label,reason])=>'<div class="chat-analysis-match"><strong>'+esc(match)+'</strong><span>'+esc(label)+'</span><small>'+esc(reason)+'</small></div>').join('')+'</div></details>';
 }
 return out;
}
function show(){
 const s=sessions.find(x=>x.date===selected)||sessions[0];
 if(!s){root.innerHTML='<p class="muted small">Archivio analisi non ancora disponibile.</p>';return;}
 const tabs='<div class="chat-analysis-tabs" role="group" aria-label="Scegli giornata">'+sessions.map(x=>
  '<button type="button" data-chat-day="'+esc(x.date)+'" aria-pressed="'+(s.date===x.date)+'" class="'+(s.date===x.date?'active':'')+'">'+esc(day(x.date))+'</button>').join('')+'</div>';
 const competitions=Array.isArray(s.competitions)&&s.competitions.length?s.competitions.map(x=>esc(x[0])+': '+esc(x[1])).join(' · '):'Elenco competizioni non consolidato nel registro di questa data';
 const bets=(s.picks||[]).filter(x=>x.kind!=='CONTROLLO'), controls=(s.picks||[]).filter(x=>x.kind==='CONTROLLO');
 const historyPicks=[...new Map(sessions.flatMap(x=>x.picks||[]).filter(p=>p.id).map(p=>[p.id,p])).values()];
 root.innerHTML=balanceView('Bilancio virtuale complessivo',historyPicks)+tabs+
  balanceView('Bilancio del '+day(s.date),bets)+
  '<p class="muted small">Fotografia dell\'analisi in chat alle '+esc(stamp(s.snapshot))+' · Nessuna sincronizzazione automatica dalla conversazione.</p>'+
  '<div class="chat-analysis-kpis">'+stat(s.checked,'Partite nel censimento')+stat(bets.length,'Test virtuali')+stat(controls.length,'Controlli non giocati')+'</div>'+
  '<p class="muted tiny">'+competitions+'</p>'+
  '<div class="sectionbar"><h3>'+esc(s.title)+'</h3></div><p class="muted small">'+esc(s.method)+'</p>'+
  '<div class="chat-analysis-picks">'+(s.picks||[]).map(pickCard).join('')+'</div>'+
  '<details class="ui-drawer chat-analysis-register"><summary><span><strong>Palinsesto e motivi delle esclusioni</strong><small>Elenco delle partite esaminate, con lo stato del filtro</small></span></summary><div class="ui-drawer-content">'+fixtureSection(s)+'</div></details>'+
  '<p class="muted tiny chat-analysis-caution">'+esc(s.verification)+' Le scansioni effettuate in chat vengono importate manualmente; gli esiti si verificano automaticamente quando disponibili nel feed pubblico, altrimenti servono verifiche documentate. Nessun risultato entra nei saldi REAL o LAB.</p>';
 root.querySelectorAll('[data-chat-day]').forEach(btn=>btn.addEventListener('click',()=>{selected=btn.getAttribute('data-chat-day');show();}));
}
async function load(){
 refresh.disabled=true;refresh.textContent='Caricamento…';
 try{
  const res=await fetch('data/real_conte_chat.json?refresh='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw new Error('HTTP '+res.status);
  const data=await res.json();
  if(!Array.isArray(data.sessions))throw new Error('Formato non valido');
  sessions=data.sessions;
  if(!selected||!sessions.some(x=>x.date===selected))selected=sessions[0]?.date||'';
  show();
 }catch(e){root.innerHTML='<p class="muted small">Non riesco a caricare lo storico delle analisi in chat. Controlla la connessione e riprova. ('+esc(e.message)+')</p>';}
 finally{refresh.disabled=false;refresh.textContent='Aggiorna';}
}
refresh.addEventListener('click',load);
load();
})();