/**
 * Semaforo automatico delle fonti. Non confonde assenza di eventi con
 * guasto tecnico e non tocca LAB, REAL, quote o pronostici.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const safeDate=v=>Number.isFinite(Date.parse(v||''))?Date.parse(v):null;
const within=(value,now,hours)=>safeDate(value)!==null&&safeDate(value)<=now.getTime()+120000&&now.getTime()-safeDate(value)<=hours*3600000;
const romeDay=date=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function evaluateSourceHealth({radar={},daily={},results={},footballData={}},now=new Date()){
 const providers=radar.source_status||{},extra=providers.additional_sources||{};
 const providerEntries={espn:{ok:providers.espn_requests_ok||0,failed:providers.espn_requests_failed||0},
  openligadb:extra.openligadb||{},thesportsdb:extra.thesportsdb||{}};
 const radarRecent=within(radar.generated_at,now,30),
  providerOk=Object.values(providerEntries).some(x=>Number(x.ok)>0);
 const calendar=radarRecent&&providerOk?
  {state:radar.stats?.matches>0?'OK':'NO_MATCHES',last_success:radar.generated_at,
   upcoming:Number(radar.stats?.matches||0),sources:providerEntries}:
  {state:'STALE_OR_UNAVAILABLE',last_success:radar.generated_at||null,
   upcoming:Number(radar.stats?.matches||0),sources:providerEntries};
 const checks=Array.isArray(daily.checks)?daily.checks:[],
  last=checks.at(-1),valid=within(last?.checked_at||daily.last_check,now,36);
 const scanned=Number.isFinite(last?.scanned_predictions)?last.scanned_predictions:null;
 const qualified=Number.isFinite(last?.eligible_actionable)?last.eligible_actionable:null;
 let quoteState=!valid?'STALE_OR_UNAVAILABLE':scanned===0?'NO_MATCHES_FROM_SOURCE':
  qualified===0?'NO_ELIGIBLE_PRICES':'OBSERVATIONS_AVAILABLE';
 const quotes={state:quoteState,last_check:last?.checked_at||daily.last_check||null,
  scanned_matches:scanned,eligible_quotes:qualified,
  provider:'TipsAudit — quote fonte esterna, non Bet365 live'};
 const resultFeed={state:within(results.checked_at,now,36)?'OK':'STALE_OR_UNAVAILABLE',
  last_check:results.checked_at||null,scope:'Campionati ESPN coperti, non copertura universale'};
 const fd={state:within(footballData.updated_at,now,120)?'SNAPSHOT_AVAILABLE':'SNAPSHOT_OLD_OR_MISSING',
  last_check:footballData.updated_at||null,scope:'CSV massimo due aggiornamenti settimanali, quote non live'};
 return {schema:'scanner-conte-source-health-v1',checked_at:now.toISOString(),day:romeDay(now),
  status:calendar.state==='STALE_OR_UNAVAILABLE'||resultFeed.state==='STALE_OR_UNAVAILABLE'?'ATTENZIONE':
   ['STALE_OR_UNAVAILABLE','NO_MATCHES_FROM_SOURCE','NO_ELIGIBLE_PRICES'].includes(quoteState)?'PARZIALE':'OPERATIVO',
  calendar,quotes,results:resultFeed,football_data:fd,
  ia_local:{state:'NON_VERIFICABILE_DA_GITHUB',note:'Il processo IA in Termux risiede sul telefono: solo la PWA puo verificarne il heartbeat.'},
  caveat:'Workflow riuscito non garantisce nuove partite o quote. Nessun suggerimento di scommessa e nessuna modifica agli storici.'};
}
async function read(path){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return {};throw e}}
async function main(){
 const [radar,daily,results,footballData]=await Promise.all([
  read('data/fixture_radar.json'),read('data/daily_virtual_lab.json'),
  read('data/results_public.json'),read('data/football_data_status.json')
 ]);
 const status=evaluateSourceHealth({radar,daily,results,footballData});
 await writeFile('data/source_health.json',JSON.stringify(status,null,2)+'\n','utf8');
 console.log('SOURCE HEALTH '+JSON.stringify({overall:status.status,calendar:status.calendar.state,
  quotes:status.quotes.state,results:status.results.state,scanned:status.quotes.scanned_matches,
  eligible:status.quotes.eligible_quotes}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1});
