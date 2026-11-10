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
const pending=x=>x==='won'?'Vinta virtuale':x==='lost'?'Persa virtuale':x==='void'?'Rimborsata virtuale':'Da verificare';
const state=x=>x==='won'?'main':x==='lost'?'lab':'';
const stat=(label,note)=>'<div class="chat-analysis-kpi"><strong>'+esc(label)+'</strong><span>'+esc(note)+'</span></div>';
function pickCard(p){
 const stake=Number(p.stake)||0,odds=Number(p.odds)||0,isControl=p.kind==='CONTROLLO';
 const pnl=p.status==='won'?stake*(odds-1):p.status==='lost'?-stake:p.status==='void'?0:null;
 return '<article class="surface pad chat-analysis-pick">'+
 '<div class="chat-analysis-pick-head"><span class="tag '+(isControl?'lab':'main')+'">'+esc(isControl?'SOLO CONTROLLO':'VIRTUALE · SIMULAZIONE')+'</span><span class="muted tiny">'+esc(stamp(p.kickoff))+'</span></div>'+
 '<h3>'+esc(p.match)+'</h3><div class="chat-analysis-line"><strong>'+esc(p.pick)+'</strong><span>Quota riferimento '+esc(number(odds))+'</span></div>'+
 '<p class="muted small">'+esc(isControl?'Nessuna puntata':'Puntata ipotetica: '+number(stake)+' €')+' · <span class="tag '+state(p.status)+'">'+esc(pending(p.status))+'</span>'+
 (pnl!==null?' · P/L simulato '+esc(number(pnl))+' €':'')+'</p>'+
 '<details><summary>Motivi, rischi e fonte della quota</summary><p class="muted small">'+esc(p.reason)+'</p><p class="muted tiny">Fonte quota: '+esc(p.oddsSource)+' — non prezzo Bet365 aggiornato.</p></details>'+
 '</article>';
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
 root.innerHTML=tabs+
  '<p class="muted small">Fotografia dell\'analisi in chat alle '+esc(stamp(s.snapshot))+' · Nessuna sincronizzazione automatica dalla conversazione.</p>'+
  '<div class="chat-analysis-kpis">'+stat(s.checked,'Partite nel censimento')+stat(bets.length,'Test virtuali')+stat(controls.length,'Controlli non giocati')+'</div>'+
  '<p class="muted tiny">'+competitions+'</p>'+
  '<div class="sectionbar"><h3>'+esc(s.title)+'</h3></div><p class="muted small">'+esc(s.method)+'</p>'+
  '<div class="chat-analysis-picks">'+(s.picks||[]).map(pickCard).join('')+'</div>'+
  '<details class="ui-drawer chat-analysis-register"><summary><span><strong>Palinsesto e motivi delle esclusioni</strong><small>Elenco delle partite esaminate, con lo stato del filtro</small></span></summary><div class="ui-drawer-content">'+fixtureSection(s)+'</div></details>'+
  '<p class="muted tiny chat-analysis-caution">'+esc(s.verification)+' I risultati dei test non vengono aggiornati automaticamente; nessun dato entra nei saldi REAL o LAB.</p>';
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