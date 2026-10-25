/**
 * Scanner Conte LIVE V0.4 — laboratorio pilota, SOLO VIRTUALE.
 * Osserva quote vere prima del calcio d'inizio, registra esperimenti
 * senza hindsight e li liquida sui risultati FT pubblici. Nessuna REAL.
 */
import {readFile,writeFile} from 'node:fs/promises';
const key=(process.env.API_FOOTBALL_KEY||'').trim();
if(!key)throw new Error('Secret API_FOOTBALL_KEY assente.');
const TZ='Europe/Rome',MAX_CALLS=12,MIN_BEFORE_MS=45*60000,MAX_AHEAD_MS=36*3600000;
const priority={
 Italy:['Serie A','Serie B','Serie C - Girone A','Serie C - Girone B','Serie C - Girone C'],
 England:['Premier League','Championship','League One','League Two'],
 Germany:['Bundesliga','2. Bundesliga','3. Liga'],
 Spain:['La Liga','Segunda División'],
 France:['Ligue 1','Ligue 2'],
 Scotland:['Premiership','Championship','League One'],
 Netherlands:['Eredivisie','Eerste Divisie'],
 Portugal:['Primeira Liga','Segunda Liga'],
 Belgium:['Jupiler Pro League','Challenger Pro League'],
 Austria:['Bundesliga','2. Liga'],
 Switzerland:['Super League','Challenge League']
};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const validOdds=x=>{const n=Number(x);return Number.isFinite(n)&&n>=1.01&&n<=100?n:null;};
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const isMain=m=>priority[m.country]?.includes(m.league)===true;
const statuses=new Set(['FT']);
let remaining=null;

async function fetchOdds(id){
 const url=new URL('https://v3.football.api-sports.io/odds');
 url.searchParams.set('fixture',id);
 const res=await fetch(url,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(24000)});
 remaining=Number(res.headers.get('x-ratelimit-requests-remaining'));
 if(!res.ok)throw new Error('HTTP '+res.status);
 const data=await res.json();
 if(data.errors && Object.keys(data.errors).length)throw new Error('Errore API nel recupero quote');
 if(!Array.isArray(data.response))throw new Error('Risposta odds non valida');
 return data.response;
}
function market(book,id){
 const b=book?.bets?.find(x=>Number(x.id)===id);
 return b&&Array.isArray(b.values)?b.values:[];
}
function findValue(values,names){
 return validOdds(values.find(v=>names.some(n=>String(v.value||'').toLowerCase().trim()===n))?.odd);
}
function choices(book){
 const winner=market(book,1),goals=market(book,5);
 const home=findValue(winner,['home','1']),draw=findValue(winner,['draw','x']),away=findValue(winner,['away','2']);
 const over=findValue(goals,['over 2.5','over 2,5']),under=findValue(goals,['under 2.5','under 2,5']);
 const result=[];
 if(home&&draw&&away){
  const price=Math.min(home,away);
  if(price>=1.45&&price<=2.1&&price<draw){
   const p=(1/price)/((1/home)+(1/draw)+(1/away));
   result.push({strategy:'FAVORITA_1X2_CONTROLLO',selection:home<=away?'Home':'Away',price,market_probability:round(p*100)});
  }
 }
 if(over&&under&&over>=1.6&&over<=2.2){
   result.push({strategy:'OVER25_CONTROLLO',selection:'Over 2.5',price:over,market_probability:round(100*(1/over)/(1/over+1/under))});
 }
 return result;
}
function selectUpcoming(fixtures){
 const now=Date.now(),byCountry=new Map();
 for(const m of fixtures){
  const t=Date.parse(m.kickoff||'');
  if(!isMain(m)||!['NS','TBD'].includes(m.status)||!Number.isFinite(t)||t<now+MIN_BEFORE_MS||t>now+MAX_AHEAD_MS)continue;
  if(!byCountry.has(m.country))byCountry.set(m.country,[]);
  byCountry.get(m.country).push(m);
 }
 for(const group of byCountry.values())group.sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
 const countries=[...byCountry.keys()].sort(),selected=[],used=new Set();
 let i=0;
 while(selected.length<MAX_CALLS&&i<60){
   let changed=false;
   for(const country of countries){
     const arr=byCountry.get(country);
     if(i<arr.length&&!used.has(arr[i].id)){
       selected.push(arr[i]);used.add(arr[i].id);changed=true;
       if(selected.length===MAX_CALLS)break;
     }
   }
   if(!changed)break;i++;
 }
 return selected;
}
function settle(record,m){
 if(record.status!=='pending'||!statuses.has(m.status)||!Number.isInteger(m.home_goals)||!Number.isInteger(m.away_goals))return;
 const h=m.home_goals,a=m.away_goals;
 const win=record.strategy==='OVER25_CONTROLLO'?(h+a>2.5):
 record.selection==='Home'?(h>a):record.selection==='Away'?(a>h):null;
 if(win===null)return;
 record.status=win?'won':'lost';
 record.score=h+'-'+a;
 record.pnl=win?round(record.odds-1):-1;
 record.settled_at=new Date().toISOString();
}
async function main(){
 const feed=JSON.parse(await readFile('data/fixtures_latest.json','utf8'));
 if(feed.status!=='ready')throw new Error('Palinsesto non pronto');
 const filepath='data/lab_auto.json';
 const lab=JSON.parse(await readFile(filepath,'utf8'));
 if(lab.schema!=='scanner-conte-lab-v1'||!Array.isArray(lab.records))throw new Error('Archivio LAB non valido');
 const matchMap=new Map(feed.fixtures.map(m=>[String(m.id),m]));
 let closed=0;
 for(const record of lab.records){
   const previous=record.status;
   const match=matchMap.get(String(record.fixture_id));
   if(match)settle(record,match);
   if(previous==='pending'&&record.status!=='pending')closed++;
 }
 const candidates=selectUpcoming(feed.fixtures),samples=[],newRows=[],errors=[];
 // Il palinsesto ha consumato 3 richieste poco prima: lasciamo spazio
 // al limite gratuito di 10 richieste al minuto.
 if(candidates.length)await pause(15000);
 for(let i=0;i<candidates.length;i++){
  const fixture=candidates[i];
  if(Number.isFinite(remaining)&&remaining<12){errors.push('Interrotto per proteggere la quota API.');break;}
  if(i>0)await pause(7100); // piano gratuito: <=10 chiamate/minuto
  let raw;
  try{raw=await fetchOdds(fixture.id);}
  catch(e){errors.push('Quote non disponibili per evento '+fixture.id+': '+e.message);continue;}
  const packs=raw.filter(v=>String(v.fixture?.id)===String(fixture.id));
  const bookmakers=packs.flatMap(p=>p.bookmakers||[]).sort((a,b)=>{
   const rank=x=>/bet365/i.test(x.name)?0:/pinnacle/i.test(x.name)?1:2;
   return rank(a)-rank(b)||String(a.name).localeCompare(String(b.name));
  });
  const book=bookmakers.find(b=>choices(b).length>0);
  const now=new Date().toISOString();
  samples.push({fixture_id:String(fixture.id),match:fixture.home+' - '+fixture.away,league:fixture.league,
   country:fixture.country,kickoff:fixture.kickoff,bookmaker:book?.name||null,
   markets:book?choices(book):[],captured_at:now,coverage:!!book});
  if(!book)continue;
  const leagueKey=fixture.country+' / '+fixture.league;
  for(const selection of choices(book)){
   const id=fixture.id+':'+selection.strategy;
   if(lab.records.some(r=>r.id===id))continue;
   // Immutabili: quota, bookmaker, strategia e ora di acquisizione sono fissati pre-match.
   if(Date.parse(fixture.kickoff)<=Date.now()+MIN_BEFORE_MS)continue;
   const item={
     id,fixture_id:String(fixture.id),kickoff:fixture.kickoff,
     match:fixture.home+' - '+fixture.away,league:leagueKey,
     bookmaker:book.name,strategy:selection.strategy,selection:selection.selection,
     odds:selection.price,market_probability_pct:selection.market_probability,
     stake_virtual:1,status:'pending',pnl:null,score:null,
     captured_at:now,settled_at:null,origin:'API-Football prematch, campione limitato',
     note:'Strategia baseline di confronto: la probabilita deriva dal mercato, NON dimostra valore atteso positivo.'
   };
   lab.records.push(item);newRows.push(item);
  }
 }
 // Non attribuire perdite automatiche a rinvii/casi non coperti dal feed.
 lab.last_run=new Date().toISOString();
 lab.last_fixture_snapshot=feed.collected_at;
 lab.history_quality='Quote fotografate prima dell’inizio. Controllo su campione, non sistema validato.';
 lab.stats={
  total:lab.records.length,pending:lab.records.filter(x=>x.status==='pending').length,
  won:lab.records.filter(x=>x.status==='won').length,lost:lab.records.filter(x=>x.status==='lost').length,
  pnl:round(lab.records.reduce((sum,x)=>sum+(typeof x.pnl==='number'?x.pnl:0),0))
 };
 const snapshot={
  schema:'scanner-conte-odds-v1',generated_at:new Date().toISOString(),fixture_snapshot:feed.collected_at,
  requested:candidates.length,with_odds:samples.filter(s=>s.coverage).length,
  api_remaining:Number.isFinite(remaining)?remaining:null,errors:errors.slice(0,15),
  notes:['Dati pubblici: non comprendono le REAL personali.', 'Quote da bookmaker indicato, non necessariamente Bet365.','Non si dichiara alcun margine/value statistico.'],
  samples
 };
 await writeFile(filepath,JSON.stringify(lab,null,2)+'\n');
 await writeFile('data/odds_latest.json',JSON.stringify(snapshot,null,2)+'\n');
 console.log('LAB: '+newRows.length+' nuovi test virtuali; '+closed+' esiti aggiornati; '+lab.stats.total+' test in archivio');
 console.log('Quote: '+samples.filter(s=>s.coverage).length+'/'+samples.length+' partite con mercati baseline. Richieste residue: '+remaining);
 if(errors.length)console.log('Avvertenze di copertura: '+errors.length);
}
main().catch(e=>{console.error('LAB V0.4 fallito: '+e.message);process.exitCode=1;});
