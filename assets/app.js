(()=>{'use strict';
const SEED=window.SCANNER_CONTE_SEED;
const STORE='scanner-conte-live-v01';
const clone=x=>JSON.parse(JSON.stringify(x));
let db;
try{const cached=localStorage.getItem(STORE);db=cached?JSON.parse(cached):clone(SEED);if(!db||!db.snapshots||!Array.isArray(db.records))throw Error('Invalid store')}catch(e){db=clone(SEED)}
const money=n=>n===null||n===undefined?'—':new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(n);
const dec=(n,d=2)=>n===null||n===undefined?'—':Number(n).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d});
const dateStr=s=>s?new Date(`${s}T12:00:00`).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}):'—';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const books={real:'REAL',main:'PRINCIPALE',lab:'LAB'};
const labelResults={won:'VINTA',lost:'PERSA',push:'RIMBORSO',pending:'IN ATTESA',unknown:'NON NOTO'};
const resultClass={won:'win',lost:'loss',push:'push',pending:'push',unknown:'push'};
const root=id=>document.getElementById(id);
function persist(){try{localStorage.setItem(STORE,JSON.stringify(db))}catch(e){toast('Memoria del browser piena: esporta un backup')}}
let tToast;function toast(s){let t=root('toast');t.textContent=s;t.classList.add('visible');clearTimeout(tToast);tToast=setTimeout(()=>t.classList.remove('visible'),3100)}
function goto(page){if(!root('view-'+page))return;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+page));document.querySelectorAll('.navitem').forEach(v=>v.classList.toggle('active',v.dataset.goto===page));window.scrollTo({top:0,behavior:'auto'});if(page==='archive')renderArchive();if(page==='settings')renderMigration()}
document.querySelectorAll('[data-goto]').forEach(el=>el.addEventListener('click',()=>goto(el.dataset.goto)));
function freshStats(book){let list=db.records.filter(r=>r.book===book&&r.manual&&r.date>db.snapshots.as_of);return{n:list.length,pnl:round(list.reduce((a,r)=>a+(r.pnl||0),0))}}
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function renderHome(){const sc=root('summary-cards');sc.innerHTML=['real','main','lab'].map(k=>{let s=db.snapshots[k],x=freshStats(k),current=round(s.pnl+x.pnl),str=k==='real'?'REAL · BET365':k==='main'?'VIRTUALE PRINCIPALE':'LAB · ESPERIMENTI';return `<div class="stat-card"><div class="stat-top">${str}</div><div class="stat-value ${current>=0?'positive':'negative'}">${current>0?'+':''}${money(current)}</div><div class="stat-bottom">${s.total+x.n} giocate · ${x.n?'incluse '+x.n+' nuove':'bilancio consolidato'}</div></div>`}).join('');
root('coverage').innerHTML=['real','main','lab'].map(k=>{let s=db.snapshots[k],n=db.records.filter(r=>r.book===k&&!r.manual).length,p=s.total?100*Math.min(1,n/s.total):0;return `<div class="coverage-row"><div class="covline"><strong>${escape(s.label)}</strong><span>${n}/${s.total} schede recuperate</span></div><div class="track"><div class="trackfill" style="width:${p}%"></div></div></div>`}).join('')+'<p class="muted tiny" style="margin:13px 0 0">Copertura delle schede, non grado di verifica degli esiti. Alcune righe sono incomplete o discordanti.</p>';
const newest=[...db.records].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);root('home-latest').innerHTML=newest.map(rowHtml).join('')}
function rowHtml(r){const pl=r.pnl===null||r.pnl===undefined?'Da verificare':`${r.pnl>0?'+':''}${money(r.pnl)}`;let extra=r.quality==='conflitto'?'<span class="tag conflitto">CONFLITTO</span>':r.quality==='parziale'?'<span class="tag parziale">PARZIALE</span>':'';if(r.origin_candidate_id)extra+=' <span class="tag real">DA SCANNER</span>';return `<div class="rowitem"><div><div class="rowtitle">${escape(r.match)}</div><div class="rowsub">${dateStr(r.date)} · ${escape(r.selection)} · @${dec(r.odds)} · ${money(r.stake)}<br><span class="tag ${r.book}">${books[r.book]||r.book}</span> <span class="tag">${escape(r.category)}</span> ${extra}</div></div><div class="rightr"><div class="profit ${resultClass[r.result]||'push'}">${escape(labelResults[r.result]||'—')}</div><div class="rowsub">${pl}</div></div></div>`}
function renderArchive(){let book=root('book-filter').value,qual=root('quality-filter').value,q=root('archive-search').value.toLowerCase().trim(),status=root('archive-local-status')?.value||'all';let a=db.records.filter(r=>(book==='all'||r.book===book)&&(qual==='all'||r.quality===qual)&&(status==='all'||(status==='pending'&&r.result==='pending')||(status==='closed'&&['won','lost','push'].includes(r.result)))&&(!q||[r.match,r.selection,r.note,r.category].join(' ').toLowerCase().includes(q))).sort((x,y)=>y.date.localeCompare(x.date)||y.id.localeCompare(x.id));const name={real:'REAL Bet365',main:'Virtuale principale',lab:'LAB storico',all:'Archivio locale'};root('archive-label').textContent=`${name[book]||'Archivio'} · ${a.length} schede`;root('archive-list').innerHTML=a.length?a.map(rowHtml).join(''):'<div class="empty">Nessuna scheda con questi filtri.</div>'}
['book-filter','quality-filter','archive-search','archive-local-status'].forEach(i=>root(i).addEventListener(i==='archive-search'?'input':'change',renderArchive));
function renderLab(){const s=db.snapshots;let strats=[{name:'CORE',s:s.main.core,caption:'Virtuale principale'},{name:'VALUE',s:s.main.value,caption:'Virtuale principale'},{name:'LAB',s:s.lab,caption:'Laboratorio separato'}];root('strategy-cards').innerHTML=strats.map(x=>`<div class="surface"><div class="st-label">${x.caption} · ${x.name}</div><div class="st-title" style="color:${x.s.pnl>=0?'var(--mint)':'var(--red)'}">${x.s.pnl>0?'+':''}${money(x.s.pnl)}</div><div class="st-foot">${x.s.total} giocate · ${x.s.wins}V / ${x.s.losses}P${x.s.pushes?' / '+x.s.pushes+'R':''}</div></div>`).join('');root('audit-list').innerHTML=db.notes.audit.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class="audit-row"><span>${dateStr(x.date)}</span><div>${escape(x.text)}</div></div>`).join('')}
function renderScanner(){const list=db.candidates||[];let filtered=list.slice().sort((a,b)=>a.category.localeCompare(b.category));root('scanner-meta').innerHTML=`<b>${list.length}</b> candidate storiche recuperate · <b>${list.filter(x=>x.status==='scartata').length}</b> scartate alla quota. <b>0</b> selezioni del 25/10 confermate come puntate reali. Nessun palinsesto live caricato.`;root('candidate-list').innerHTML=filtered.map(x=>{let pass=x.minimum_odds!=null&&x.bookmaker_odds!=null&&x.bookmaker_odds>=x.minimum_odds;let cls=x.status==='scartata'?'rejected':x.status.startsWith('candidata')?'ok':'';return `<article class="candidate"><div class="ctop"><span class="tag ${x.category==='LAB'?'lab':x.category==='CORE'?'main':'real'}">${escape(x.category)}</span><span class="status ${cls}">${escape(x.status).toUpperCase()}</span></div><h3>${escape(x.match)}</h3><div class="csel">${escape(x.selection)}</div><div class="cprices"><div><span>Quota rilevata</span><strong>${dec(x.bookmaker_odds)}</strong></div><div><span>Quota minima fissata</span><strong>${dec(x.minimum_odds)}</strong></div><div><span>Supera il filtro?</span><strong style="color:${pass?'var(--mint)':'var(--soft)'}">${x.minimum_odds==null?'—':pass?'Sì':'No'}</strong></div></div><p>${escape(x.reason)}</p></article>`}).join('')}
function renderMigration(){let qs={ricostruito:0,parziale:0,conflitto:0,manuale:0};db.records.forEach(x=>{qs[x.quality]=(qs[x.quality]||0)+1});root('migration-stats').innerHTML=`<div class="audit-row"><span>Schede</span><div>${db.records.length} totali · ${qs.ricostruito} ricostruite · ${qs.parziale} parziali · ${qs.conflitto} conflittuali · ${qs.manuale||0} aggiunte manualmente.</div></div><div class="audit-row"><span>Bilanci</span><div>Congelati al 24/10; nuovi movimenti contabilizzati solo se successivi alla data e inseriti manualmente.</div></div><div class="audit-row"><span>Qualità</span><div>${db.snapshots.real.total?'La voce REAL su Osasuna–Racing richiede verifica; cinque esiti LAB del 23/10 e dettagli parziali sono ancora da completare. Il bilancio PRINCIPALE risulta riconciliato.':'Archivio vuoto di partenza. Importa il backup JSON privato per ripristinare il tuo storico.'}</div></div>`}
function download(name,body,mime){let blob=new Blob([body],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function exportJson(){download('ScannerConteLIVE-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({...db,exported_at:new Date().toISOString()},null,2),'application/json');toast('Backup pronto: conservalo fuori dal browser')}
root('export-top').addEventListener('click',exportJson);root('export-json').addEventListener('click',exportJson);
root('export-csv').addEventListener('click',()=>{let fields=['id','date','book','category','match','selection','odds','stake','result','pnl','score','quality','source','note'];let quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';let csv='\uFEFF'+fields.map(quote).join(';')+'\n'+db.records.map(r=>fields.map(k=>quote(r[k])).join(';')).join('\n');download('ScannerConteLIVE-storico.csv',csv,'text/csv;charset=utf-8')});
root('import-file').addEventListener('change',async e=>{let file=e.target.files[0];if(!file)return;try{let obj=JSON.parse(await file.text());if(!obj.snapshots||!Array.isArray(obj.records)||!Array.isArray(obj.candidates)||!obj.notes||!obj.snapshots.real||!obj.snapshots.main||!obj.snapshots.lab)throw Error('Struttura backup non riconosciuta');if(confirm(`Il backup contiene ${obj.records.length} registrazioni. Sostituire i dati attuali? Prima esporta un backup se hai aggiunto informazioni.`)){db=obj;persist();renderAll();toast('Backup importato correttamente')}}catch(err){alert('Impossibile importare: '+err.message)}finally{e.target.value=''}});
root('reset-local').addEventListener('click',()=>{if(confirm('Ripristinare la versione iniziale? Le modifiche locali andranno perse se non hai un backup.')){db=clone(SEED);persist();renderAll();toast('Storico iniziale ripristinato')}});
/* Preparazione della registrazione REAL da shortlist oppure alternative.
   I dati del LAB non scrivono mai da soli nello Storico: serve la conferma dell'utente. */
let candidatePrefill=null;
root('add-record').addEventListener('click',()=>{
 candidatePrefill=null;
 const form=root('record-form');form.reset();delete form.dataset.candidateId;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 form.elements.namedItem('date').value=today;
 root('record-dialog').showModal();
});
root('close-dialog').addEventListener('click',()=>root('record-dialog').close());
window.addEventListener('scanner-conte:prefill-real',event=>{
 const d=event.detail;
 if(!d||typeof d.id!=='string'||!d.id.startsWith('tipsaudit-')||
    typeof d.match!=='string'||d.match.length>150||!['CORE','VALUE'].includes(d.category)||
    !['Home','Away','Draw'].includes(d.selection)||!Number.isFinite(Number(d.odds))||
    Number(d.odds)<1.01||Number(d.odds)>200)return;
 const kickoff=new Date(d.kickoff);
 if(!Number.isFinite(kickoff.getTime()))return;
 if(db.records.some(r=>r.book==='real'&&r.origin_candidate_id===d.id)){
   alert('Questa candidata risulta già registrata nello Storico REAL. Controlla la scheda prima di inserirla di nuovo.');
   return;
 }
 const form=root('record-form');
 form.reset();
 const field=name=>form.elements.namedItem(name);
 const matchDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(kickoff);
 field('date').value=matchDay;
 field('book').value='real';
 field('category').value=d.category;
 field('match').value=d.match;
 field('selection').value=d.selection==='Home'?'1':d.selection==='Away'?'2':'X';
 field('odds').value=String(d.odds);
 field('result').value='pending';
 const reference=Number(d.reference_odds);
 field('note').value='Da screening LAB prepartita · riferimento '+(Number.isFinite(reference)?reference:'non disponibile')+
   ' ('+String(d.reference_bookmaker||'fonte esterna').slice(0,70)+'). Quota Bet365 e importo confermati dall’utente.';
 form.dataset.candidateId=d.id;
 candidatePrefill={id:d.id,reference_odds:Number.isFinite(reference)?reference:null,
   reference_link:String(d.reference_link||'').startsWith('https://tipsaudit.com/')?d.reference_link:null,
   source_bookmaker:String(d.reference_bookmaker||'').slice(0,70)};
 root('record-dialog').showModal();
});
root('record-form').addEventListener('submit',e=>{
 e.preventDefault();
 let f=new FormData(e.target),v=k=>String(f.get(k)||'').trim(),
 od=Number(v('odds')),st=Number(v('stake')),rs=v('result'),date=v('date');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!v('match')||!v('selection')||
    !Number.isFinite(od)||od<1.01||!Number.isFinite(st)||st<=0){
  alert('Compila tutti i campi correttamente.');return;
 }
 const candidateId=e.target.dataset.candidateId||null;
 if(candidateId&&v('book')==='real'&&db.records.some(r=>r.book==='real'&&r.origin_candidate_id===candidateId)){
  alert('Questa candidata è già registrata nello Storico REAL: nessun duplicato creato.');return;
 }
 if(v('book')==='real'&&!confirm('Confermi di avere GIÀ effettivamente piazzato questa scommessa REAL su Bet365, alla quota e all’importo inseriti?'))return;
 let pnl=rs==='won'?round((od-1)*st):rs==='lost'?-st:rs==='push'?0:null;
 let r={
  id:'manual-'+Date.now(),date,book:v('book'),category:v('category'),match:v('match'),
  selection:v('selection'),odds:od,stake:st,result:rs,pnl,score:'',
  quality:'manuale',source:candidateId&&v('book')==='real'?'Da scanner LAB, inserimento manuale REAL':'Inserimento manuale V0.1',
  note:v('note'),manual:true,recorded_before_kickoff:null
 };
 if(candidateId&&v('book')==='real'&&candidatePrefill?.id===candidateId){
   r.origin_candidate_id=candidateId;
   r.reference_odds=candidatePrefill.reference_odds;
   r.reference_link=candidatePrefill.reference_link;
   r.reference_bookmaker=candidatePrefill.source_bookmaker;
 }
 db.records.push(r);persist();
 root('record-dialog').close();e.target.reset();delete e.target.dataset.candidateId;candidatePrefill=null;
 renderAll();toast('REAL registrata manualmente sul dispositivo');
 if(r.book==='real'&&candidateId){
   document.querySelector('[data-register-tab="real"]')?.click();
   goto('archive');
 }
});


/* V0.7 — verifica esiti delle registrazioni locali, soltanto su risultato FT
   e coincidenza esatta della partita/data. NON trasferisce i record a GitHub. */
const normalizeTeamName=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\bgiuliano\b/g,'giugliano')
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
function localDateInRome(iso){
 try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso))}
 catch{return ''}
}
function scoreSelection(selection,home,away){
 const name=String(selection??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .replace(/,/g,'.').replace(/\s+/g,' ').trim();
 const total=home+away;
 let m;
 if((m=name.match(/^over\s*(\d+(?:\.5)?)(?:\s*(?:gol|goal|goals|reti))?$/)))return total>Number(m[1]);
 if((m=name.match(/^under\s*(\d+(?:\.5)?)(?:\s*(?:gol|goal|goals|reti))?$/)))return total<Number(m[1]);
 if(['1','casa','home','vittoria casa','vittoria catania'].includes(name))return home>away;
 if(['2','trasferta','away','vittoria ospite'].includes(name))return away>home;
 if(['x','pareggio','draw'].includes(name))return home===away;
 if(name==='1x')return home>=away;
 if(name==='x2')return away>=home;
 if(name==='12')return home!==away;
 if(['gg','goal','gol','entrambe segnano','entrambe segnano si'].includes(name))return home>0&&away>0;
 if(['ng','nogol','no gol','no goal','entrambe segnano no'].includes(name))return home===0||away===0;
 return null;
}
// Feed pubblico FT: ESPN gratuito + risultati ufficiali verificati.
const canonicalTeam=s=>{
 const n=normalizeTeamName(s);
 const aliases={
  'hamburg':'hamburger sv',
  'hamburg sv':'hamburger sv',
  'hsv':'hamburger sv',
  'amburgo':'hamburger sv',
  'frankfurt':'eintracht frankfurt',
  'eintrach':'eintracht frankfurt',
  'eintracht':'eintracht frankfurt',
  'cd tenerife':'tenerife',
  'andorra':'fc andorra',
  // Nomi storici, abbreviazioni e forme dei bookmaker. I due club e la data
  // devono comunque coincidere: nessun abbinamento con una sola squadra.
  'vitoria guimaraes':'vitoria sc',
  'vitoria de guimaraes':'vitoria sc',
  'vitoria sport clube':'vitoria sc',
  'guimaraes':'vitoria sc',
  'vitoria':'vitoria sc',
  'porto':'fc porto',
  'fc porto':'fc porto',
  'portogallo fc porto':'fc porto',
  'ce sabadell':'sabadell',
  'cd sabadell':'sabadell',
  'real sociedad ii':'real sociedad b',
  'real sociedad b':'real sociedad b',
  '1 fc union berlin':'union berlin',
  'sc freiburg':'freiburg'
 };
 return aliases[n]||n;
};
function sameFixture(record,fixture){
 if(!fixture.kickoff||
    (localDateInRome(fixture.kickoff)!==record.date&&fixture.original_local_date!==record.date))return false;
 const parts=String(record.match||'').split(/\s+(?:-|–|—|vs\.?)\s+/i);
 if(parts.length===2){
  return canonicalTeam(parts[0])===canonicalTeam(fixture.home)&&
    canonicalTeam(parts[1])===canonicalTeam(fixture.away);
 }
 // Vecchi record ricostruiti senza separatore: mantiene il confronto rigoroso precedente.
 return normalizeTeamName(record.match).replace(/\bvs\b/g,' ')===
   normalizeTeamName(fixture.home+' '+fixture.away);
}
let resultSyncBusy=false;
async function reconcilePendingFixtures(){
 if(resultSyncBusy)return;
 const status=root('settle-status'),btn=root('settle-refresh');
 const pending=db.records.filter(r=>r.manual&&r.result==='pending'&&['real','main','lab'].includes(r.book));
 if(!pending.length){if(status)status.textContent='Nessuna registrazione locale in attesa.';return}
 resultSyncBusy=true;if(btn)btn.disabled=true;
 if(status)status.textContent='Verifica risultati delle '+pending.length+' giocate in attesa…';
 const load=async(path,schema)=>{
  try{
   const response=await fetch(path+'?settle='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const value=await response.json();
   return value.schema===schema&&Array.isArray(value.fixtures)?value:null;
  }catch{return null}
 };
 try{
  // Il vecchio archivio API-Football e' usato solo per match storici gia presenti:
  // non costituisce piu' una fonte aggiornata.
  const [publicFeed,legacyFeed]=await Promise.all([
   load('./data/results_public.json','scanner-conte-results-public-v1'),
   load('./data/fixtures_latest.json','scanner-conte-fixtures-v1')
  ]);
  if(!publicFeed&&!legacyFeed)throw Error('Nessuna fonte di esiti raggiungibile');
  let updated=0,unsupported=0,postponed=0,ambiguous=0;
  for(const record of pending){
   const available=publicFeed?.fixtures?.filter(f=>sameFixture(record,f))||[];
   // Se il feed nuovo ha una partita, non usare in contrasto il vecchio feed.
   const matches=available.length?available:
     legacyFeed?.fixtures?.filter(f=>sameFixture(record,f))||[];
   // Priorita al risultato definitivo di un recupero, se esiste:
   // la scheda originale rinviata rimane come informazione storica.
   const finalResults=matches.filter(f=>f.status==='FT');
   if(finalResults.length>1){ambiguous++;continue}
   if(finalResults.length===0){
    if(matches.some(f=>['PST','POSTPONED','CANC','CANCELLED'].includes(f.status)))postponed++;
    continue;
   }
   const fixture=finalResults[0];
   // Anche con una fonte che sbaglia lo stato, non chiudere una partita
   // ancora in programma o troppo vicina all'orario di inizio.
   if(fixture.verification!=='official'&&
      Date.parse(fixture.kickoff)>Date.now()-115*60000)continue;
   if(!Number.isInteger(fixture.home_goals)||!Number.isInteger(fixture.away_goals))continue;
   const won=scoreSelection(record.selection,fixture.home_goals,fixture.away_goals);
   if(won===null){unsupported++;continue}
   // Solo risultati FT e solo registrazioni ancora in attesa: mai riscrivere un esito.
   if(record.result!=='pending')continue;
   record.result=won?'won':'lost';
   record.score=fixture.home_goals+'-'+fixture.away_goals;
   record.pnl=won?round((Number(record.odds)-1)*Number(record.stake)):-Number(record.stake);
   record.settlement_source=fixture.source||
     (available.length?publicFeed?.source:legacyFeed?.source)||'Risultato FT verificato';
   record.settlement_fixture_id=String(fixture.id);
   if(typeof fixture.source_url==='string'&&/^https:\/\/(profis\.eintracht\.de|www\.espn\.com)\//.test(fixture.source_url)){
    record.settlement_reference_url=fixture.source_url;
   }
   record.settled_at=new Date().toISOString();
   updated++;
  }
  if(updated){persist();renderAll()}
  if(status){
   const checked=publicFeed?.checked_at;
   const label=checked?'Ultimo controllo ESPN '+new Date(checked).toLocaleString('it-IT',{
    timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'
   }):publicFeed?'Risultati ufficiali verificati disponibili':'Archivio storico API-Football';
   status.textContent=(updated?updated+' esito/i aggiornato/i. ':'Nessun nuovo esito FT verificabile. ')+
    label+'.'+(postponed?' '+postponed+' partita/e rinviata/e: controlla le regole del bookmaker.':'')+
    (ambiguous?' '+ambiguous+' corrispondenza/e ambigue lasciate in attesa.':'')+
    (unsupported?' '+unsupported+' mercato/i da verificare manualmente.':'');
  }
 }catch(e){
  if(status)status.textContent='Verifica esiti non disponibile: '+e.message+'. Le registrazioni sono intatte.';
 }finally{
  resultSyncBusy=false;if(btn)btn.disabled=false;
 }
}

function renderAll(){renderHome();renderArchive();renderLab();renderScanner();renderMigration();window.dispatchEvent(new Event('scanner-conte:records-changed'))}
renderAll();
root('settle-refresh')?.addEventListener('click',reconcilePendingFixtures);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcilePendingFixtures()});
window.addEventListener('focus',reconcilePendingFixtures);
// Se l'app resta aperta, ricontrolla il feed pubblico ogni 5 minuti.
// Non richiama API-Football dal telefono e non consuma quote del piano API.
setInterval(()=>{if(!document.hidden)reconcilePendingFixtures()},5*60*1000);
reconcilePendingFixtures();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();
