/**
 * Scanner Conte LIVE — osservatorio REAL non piazzate (v1).
 * Seleziona e congela osservazioni prepartita indipendentemente dalle puntate REAL.
 * Fonte attuale: LAB forward 1X2 TipsAudit; non sono quote Bet365 né un modello xG.
 * NON modifica archivi precedenti e NON registra puntate reali.
 */
import {readFile,writeFile} from 'node:fs/promises';
const TZ='Europe/Rome';
const historyPath='data/real_watch_history.json',todayPath='data/real_watch_today.json';
const day=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=(x,n=2)=>Math.round((x+Number.EPSILON)*10**n)/10**n;
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const validDate=x=>Number.isFinite(Date.parse(x||''));
const uniqueId=r=>String(r.id)+'|'+String(r.kickoff)+'|'+String(r.market)+'|'+String(r.selection);
function eligible(r,now){
 const ko=Date.parse(r.kickoff),cap=Date.parse(r.captured_at),bench=Date.parse(r.benchmark_read_at);
 return r.status==='pending'&&r.market==='1X2'&&['Home','Draw','Away'].includes(r.selection)&&
  finite(r.odds)&&r.odds>=1.3&&r.odds<=3.5&&finite(r.fair_odds)&&r.fair_odds>1&&
  validDate(r.kickoff)&&validDate(r.captured_at)&&validDate(r.benchmark_read_at)&&
  ko>now+20*60000&&cap<ko-15*60000&&cap<=now+120000&&now-cap<=30*3600000&&
  bench<=cap+120000&&cap-bench<=90*60000&&day(r.kickoff)===day(now)&&
  typeof r.match==='string'&&r.match.includes(' - ')&&typeof r.reference==='string'&&
  r.reference.startsWith('https://tipsaudit.com/')&&typeof r.bookmaker==='string';
}
export function buildRealWatch(lab,previous,nowISO){
 if(lab?.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(lab.records))throw Error('LAB quotidiano non valido');
 if(previous?.schema!=='scanner-conte-real-watch-history-v1'||!Array.isArray(previous.records))throw Error('Storico REAL osservate non valido');
 const now=Date.parse(nowISO);if(!Number.isFinite(now))throw Error('Data non valida');
 const scope=day(nowISO);
 const sourceLast=Date.parse(lab.last_check||'');
 const sourceFresh=Number.isFinite(sourceLast)&&sourceLast<=now+120000&&now-sourceLast<=30*3600000;
 const bestByMatch=new Map();
 if(sourceFresh)for(const r of lab.records){
  if(!eligible(r,now))continue;
  const externalGap=round(100*(r.odds/r.fair_odds-1),2);
  const ageH=(now-Date.parse(r.captured_at))/3600000;
  const rating=round(Math.max(-10,Math.min(12,externalGap))*4-Math.min(24,ageH)/3,2);
  const row={id:uniqueId(r),source_id:String(r.id),match:r.match,league:r.league||'',
   kickoff:r.kickoff,market:r.market,selection:r.selection,
   category:r.odds<1.95?'CORE':'VALUE',reference_odds:r.odds,
   reference_bookmaker:r.bookmaker,captured_at:r.captured_at,reference_link:r.reference,
   external_fair_odds:r.fair_odds,external_reference_gap_pct:externalGap,
   rank_score:rating,model_probability_pct:null,model_status:'XG_NOT_AVAILABLE',
   is_bet365_quote:false,kind:'OBSERVATION_ONLY'};
  const key=norm(r.match)+'|'+day(r.kickoff);
  if(!bestByMatch.has(key)||bestByMatch.get(key).rank_score<rating)bestByMatch.set(key,row);
 }
 const rows=[...bestByMatch.values()].sort((a,b)=>b.rank_score-a.rank_score||
  Date.parse(a.kickoff)-Date.parse(b.kickoff)||a.id.localeCompare(b.id));
 const existingKeys=new Set(previous.records.map(r=>r.id));
 // The first daily shortlist is frozen. New refreshes may fill vacant positions
 // but never rewrite the original odds, selection or timestamps.
 const todays=previous.records.filter(r=>r.scope_day===scope&&r.position==='PRINCIPALE');
 const reserves=previous.records.filter(r=>r.scope_day===scope&&r.position==='RISERVA');
 const selectedMatches=new Set([...todays,...reserves].map(r=>norm(r.match)+'|'+day(r.kickoff)));
 const added=[];
 for(const row of rows){
  if(existingKeys.has(row.id)||selectedMatches.has(norm(row.match)+'|'+day(row.kickoff)))continue;
  const position=todays.length<2?'PRINCIPALE':reserves.length<3?'RISERVA':null;
  if(!position)break;
  const entry={...row,scope_day:scope,first_seen:nowISO,position,
   result_status:'pending',settled_at:null,virtual_pnl:null,result_source:null,
   real_bet_status:'NOT_TRACKED_PUBLICLY'};
  previous.records.push(entry);existingKeys.add(row.id);selectedMatches.add(norm(row.match)+'|'+day(row.kickoff));
  (position==='PRINCIPALE'?todays:reserves).push(entry);added.push(entry);
 }
 // Only settle from the source record, matching all pre-match identifiers.
 const source=new Map(lab.records.map(r=>[String(r.id),r]));
 for(const entry of previous.records){
  const r=source.get(entry.source_id);
  if(!r||r.match!==entry.match||r.market!==entry.market||r.selection!==entry.selection||
     Date.parse(r.kickoff)!==Date.parse(entry.kickoff)||!['won','lost'].includes(r.status))continue;
  // Schede gia chiuse: non cambiare MAI esito, quota, puntata o P/L.
  // Si puo' solo migliorare l'attribuzione quando arriva una verifica FT indipendente.
  if(['won','lost'].includes(entry.result_status)){
   if(entry.result_status===r.status&&r.independent_ft_verification===true){
    entry.result_source=r.settlement_source||entry.result_source;
    entry.result_verified_independently=true;
    entry.result_verification_reference=r.settlement_reference||null;
   }
   continue;
  }
  entry.result_status=r.status;entry.settled_at=r.settled_at||nowISO;
  entry.virtual_pnl=r.status==='won'?round(entry.reference_odds-1):-1;
  entry.result_source=r.settlement_source||
   'TipsAudit LAB, risultato da verificare indipendentemente';
  entry.result_verified_independently=r.independent_ft_verification===true;
 }
 const primary=previous.records.filter(r=>r.position==='PRINCIPALE');
 const closed=primary.filter(r=>['won','lost'].includes(r.result_status));
 const stats={observed:previous.records.length,main:primary.length,reserves:previous.records.length-primary.length,
  settled:closed.length,won:closed.filter(r=>r.result_status==='won').length,
  lost:closed.filter(r=>r.result_status==='lost').length,pending:primary.filter(r=>r.result_status==='pending').length,
  theoretical_stake:closed.length,theoretical_pnl:round(closed.reduce((n,r)=>n+r.virtual_pnl,0)),
  theoretical_roi_pct:closed.length?round(100*closed.reduce((n,r)=>n+r.virtual_pnl,0)/closed.length,2):null,
  independently_verified_settled:closed.filter(r=>r.result_verified_independently===true).length,
  independent_result_verification:closed.length>0&&closed.every(r=>r.result_verified_independently===true)};
 const watch={schema:'scanner-conte-real-watch-today-v1',generated_at:nowISO,scope_day:scope,
  status:!sourceFresh?'SOURCE_STALE':todays.length?'OBSERVATIONS_AVAILABLE':'NO_OBSERVATIONS',
  source_last_check:lab.last_check||null,generated_candidates:added.length,
  methodology:'Selezione automatica prepartita fra osservazioni LAB forward 1X2; ranking basato su quota e benchmark della stessa fonte. Nessuna stima xG indipendente: non considerare queste candidate value verificate.',
  bet365_quotes_available:false,xg_model_available:false,no_real_bets_placed:true,
  note:'Registro separato: le selezioni restano anche se non scommesse. Le puntate vere sono solo quelle registrate manualmente nel telefono.',
  shortlist:todays,alternatives:reserves,stats};
 previous.last_check_at=nowISO;previous.stats=stats;
 return{watch,history:previous};
}
async function main(){
 const lab=JSON.parse(await readFile('data/daily_virtual_lab.json','utf8'));
 let history;
 try{history=JSON.parse(await readFile(historyPath,'utf8'));}
 catch(e){if(e.code!=='ENOENT')throw e;history={schema:'scanner-conte-real-watch-history-v1',version:1,records:[],stats:{},created_at:new Date().toISOString()};}
 const {watch,history:updated}=buildRealWatch(lab,history,new Date().toISOString());
 await writeFile(todayPath,JSON.stringify(watch,null,2)+'\n');
 await writeFile(historyPath,JSON.stringify(updated,null,2)+'\n');
 console.log('REAL WATCH '+JSON.stringify({status:watch.status,scope_day:watch.scope_day,primary:watch.shortlist.length,reserves:watch.alternatives.length,added:watch.generated_candidates,settled:watch.stats.settled}));
}
if(process.argv[1]&&process.argv[1].endsWith('build-real-watch.mjs'))main().catch(e=>{console.error(e);process.exitCode=1;});
