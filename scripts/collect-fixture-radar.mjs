/** Calendario di osservazione indipendente dal LAB e dalle quote live.
 * ESPN scoreboard pubblico (non ufficiale, senza chiave), fino a 72 ore.
 * Completa — non sostituisce — la fonte Football-Data caricata due volte a settimana.
 * NON crea suggerimenti di gioco, puntate o test forward.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {collectComplementarySources} from './radar-source-extras.mjs';
export const LEAGUES=Object.freeze([
 ['ita.1','Italia Serie A'],['ita.2','Italia Serie B'],
 ['eng.1','Premier League'],['eng.2','Championship'],['eng.trophy','EFL Trophy'],
 ['esp.1','LaLiga'],['esp.2','Segunda División'],
 ['uefa.champions','Champions League'],['uefa.europa','Europa League'],
 ['uefa.wchampions','Champions League femminile'],
 ['ger.1','Bundesliga'],['por.1','Primeira Liga']
]);
const PATH='data/fixture_radar.json',FD='data/football_data_future.json';
const TZ='Europe/Rome';
const ms=x=>Date.parse(x||'');
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,100);
const romeDay=x=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const utcDay=(offset,now)=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+offset)).toISOString().slice(0,10).replaceAll('-','');
export function parseEvent(event,league,now){
 const c=event?.competitions?.[0],teams=c?.competitors;
 if(!Array.isArray(teams))return null;
 const h=teams.find(x=>x.homeAway==='home'),a=teams.find(x=>x.homeAway==='away');
 const home=String(h?.team?.displayName||h?.team?.name||'').trim();
 const away=String(a?.team?.displayName||a?.team?.name||'').trim();
 const date=String(event.date||c.date||'');
 const kickoff=ms(date),current=now.getTime();
 const type=event.status?.type||c.status?.type||{};
 if(!home||!away||!String(event.id||'')||!Number.isFinite(kickoff)||
  kickoff<current+15*60000||kickoff>current+72*3600000||
  type.completed===true||/POSTPON|CANCEL|FINAL|FULL_TIME/i.test(String(type.name||'')+' '+String(type.description||'')))return null;
 return {id:'espn-'+league[0]+'-'+String(event.id),home,away,
  match:home+' – '+away,kickoff:new Date(kickoff).toISOString(),
  league:league[1],source:'ESPN scoreboard (calendario pubblico non ufficiale)',
  source_code:league[0],market:'NESSUNA QUOTA LIVE',odds:null,
  quote_status:'NOT_AVAILABLE',source_url:'https://www.espn.com/soccer/scoreboard?league='+encodeURIComponent(league[0])};
}
function formatFD(r,now){
 const kickoff=ms(r.kickoff);
 if(!Number.isFinite(kickoff)||kickoff<now.getTime()+15*60000||kickoff>now.getTime()+72*3600000||
 !r.home||!r.away||!r.league)return null;
 const odds=r.odds&&typeof r.odds==='object'?Object.fromEntries(
 Object.entries(r.odds).filter(([k,v])=>['1','X','2','Over 2.5','Under 2.5'].includes(k)&&typeof v==='number'&&v>=1.01&&v<=100)):null;
 return {id:r.id,home:r.home,away:r.away,match:r.home+' – '+r.away,
  kickoff:r.kickoff,league:r.league,source:'Football-Data.co.uk fixtures CSV',
  source_code:r.source_code,source_url:'https://www.football-data.co.uk/fixtures.csv',
  market:odds&&Object.keys(odds).length?'QUOTE STORICHE (NON LIVE)':'NESSUNA QUOTA',
  odds,quote_status:odds&&Object.keys(odds).length?'HISTORICAL_SNAPSHOT_NOT_LIVE':'NOT_AVAILABLE',
  quote_snapshot_at:r.snapshot_at||null};
}
export function makeRadar(espn,fd,now=new Date(),meta={}){
 if(!Number.isFinite(now.getTime()))throw Error('Ora non valida');
 const map=new Map(),key=r=>romeDay(r.kickoff)+'|'+norm(r.home)+'|'+norm(r.away);
 for(const r of [...fd,...espn]){
  const k=key(r),prior=map.get(k);
  if(!prior){map.set(k,r);continue;}
  // Fonte CSV con quote storiche può arricchire la scheda, senza farle diventare live.
  if(r.quote_status==='HISTORICAL_SNAPSHOT_NOT_LIVE')map.set(k,r);
 }
 const rows=[...map.values()].sort((a,b)=>ms(a.kickoff)-ms(b.kickoff)||a.match.localeCompare(b.match)).slice(0,250);
 const perDay={};for(const r of rows){const k=romeDay(r.kickoff);perDay[k]=(perDay[k]||0)+1;}
 return {schema:'scanner-conte-fixture-radar-v1',generated_at:now.toISOString(),
  scope:'Partite future prossime 72 ore; fonti parziali; nessuna quota Bet365 in tempo reale.',
  auto_bets:false,auto_predictions:false,independent_value_model:false,
  source_status:{espn_requests_ok:meta.ok||0,espn_requests_failed:meta.failed||0,
   football_data_snapshot_at:meta.fdAt||null,additional_sources:meta.extras||{}},
  stats:{matches:rows.length,days:perDay,with_historical_snapshot:rows.filter(r=>r.quote_status==='HISTORICAL_SNAPSHOT_NOT_LIVE').length},
  fixtures:rows};
}
async function run({now=new Date(),fetcher=fetch,write=true}={}){
 let saved=null;try{saved=JSON.parse(await readFile(FD,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const sourceFD=Array.isArray(saved?.fixtures)?saved.fixtures:[],
  fd=sourceFD.map(x=>formatFD(x,now)).filter(Boolean);
 const tasks=[];for(const offset of [0,1,2])for(const league of LEAGUES){
  tasks.push({league,url:'https://site.api.espn.com/apis/site/v2/sports/soccer/'+league[0]+'/scoreboard?dates='+utcDay(offset,now)});
 }
 const received=[];let ok=0,failed=0;
 for(let i=0;i<tasks.length;i+=6){
  const tasksPart=tasks.slice(i,i+6);
  const batch=await Promise.allSettled(tasksPart.map(async x=>{
   const res=await fetcher(x.url,{headers:{'Accept':'application/json','User-Agent':'ScannerConteLIVE-fixture-radar/1.0'},signal:AbortSignal.timeout(14000)});
   if(!res.ok)throw Error('HTTP '+res.status);
   const json=await res.json();if(!Array.isArray(json.events))throw Error('JSON without events');
   return json.events.map(ev=>parseEvent(ev,x.league,now)).filter(Boolean);
  }));
  for(const b of batch){if(b.status==='fulfilled'){ok++;received.push(...b.value)}else failed++;}
 }
 const extras=await collectComplementarySources({now,fetcher});
 const validExtra=Object.values(extras.status).some(x=>x.ok>0);
 if(ok===0&&!saved&&!validExtra)throw Error('Nessuna fonte disponibile: archivio precedente preservato');
 const radar=makeRadar([...received,...extras.items],fd,now,{ok,failed,fdAt:saved?.generated_at,extras:extras.status});
 if(write)await writeFile(PATH,JSON.stringify(radar,null,2)+'\n','utf8');
 console.log('RADAR '+JSON.stringify({matches:radar.fixtures.length,days:radar.stats.days,ok,failed,fd:fd.length,extra:extras.status}));
 return radar;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(e=>{console.error(e);process.exitCode=1});
