/** Scanner Conte — liquidazione supplementare dei SOLI test virtuali forward 1X2.
 * Dati pubblici ESPN/ufficiali, mai REAL; evita chiusure su recuperi rinviati.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const aliases={'cd tenerife':'tenerife','fc andorra':'andorra'};
const team=s=>aliases[norm(s)]||norm(s);
const rome=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const LEAGUES={'uefa nations league':'uefa.nations','segunda division':'esp.2',
 'la liga':'esp.1','serie a':'ita.1','serie b':'ita.2','premier league':'eng.1',
 'championship':'eng.2','bundesliga':'ger.1','ligue 1':'fra.1',
 'eredivisie':'ned.1','primeira liga':'por.1'};
const pick=s=>({Home:'1',Draw:'X',Away:'2'})[s]||null;
const outcome=(h,a)=>h>a?'1':h<a?'2':'X';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export function settleWithPublicResult(record,fixtures,now=new Date()){
 if(record?.status!=='pending'||record.market!=='1X2'||record.result_review_status==='POSTPONED_REPLAYED')return null;
 const k=Date.parse(record.kickoff||''),c=Date.parse(record.captured_at||''),t=now.getTime();
 if(!Number.isFinite(k)||!Number.isFinite(c)||!Number.isFinite(t)||
  t-k<115*60000||c>k-45*60000||c>t||!pick(record.selection)||
  !(Number.isFinite(record.odds)&&record.odds>=1.2)||
  !(Number.isFinite(record.stake_virtual)&&record.stake_virtual>0))return null;
 const sides=String(record.match||'').split(/\s+[-–—]\s+/);
 if(sides.length!==2)return null;
 const league=LEAGUES[norm(record.league)]||null;
 // Mai usare solo nomi o solo data; per copertura nota richiedere anche lega.
 if(!league||!Array.isArray(fixtures))return null;
 const match=fixtures.filter(f=>f.status==='FT'&&
  ['espn_scoreboard','official'].includes(f.verification)&&
  f.league_code===league&&Number.isInteger(f.home_goals)&&Number.isInteger(f.away_goals)&&
  Number.isFinite(Date.parse(f.kickoff||''))&&
  rome(f.kickoff)===rome(record.kickoff)&&
  Math.abs(Date.parse(f.kickoff)-k)<=6*3600000&&
  team(f.home)===team(sides[0])&&team(f.away)===team(sides[1]));
 if(match.length!==1)return null;
 const f=match[0],found=outcome(f.home_goals,f.away_goals);
 return {
  status:found===pick(record.selection)?'won':'lost',
  pnl:round(record.stake_virtual*(found===pick(record.selection)?record.odds-1:-1)),
  score:f.home_goals+'-'+f.away_goals,
  settled_at:now.toISOString(),
  verified_ft_result:found,
  settlement_source:f.source||'Risultato pubblico verificato',
  settlement_reference:f.source_url||null,
  settlement_publication:now.toISOString(),
  settlement_verification:f.verification,
  independent_ft_verification:true
 };
}
export function settleArchive(data,feed,now=new Date()){
 if(data?.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(data.records)||
  feed?.schema!=='scanner-conte-results-public-v1'||!Array.isArray(feed.fixtures))throw Error('Schema inatteso: nessuna modifica');
 let closed=0;
 for(const r of data.records){const result=settleWithPublicResult(r,feed.fixtures,now);
  if(!result)continue;Object.assign(r,result);closed++;
 }
 return closed;
}
async function main(){
 const file='data/daily_virtual_lab.json';
 const data=JSON.parse(await readFile(file,'utf8'));
 const feed=JSON.parse(await readFile('data/results_public.json','utf8'));
 const now=new Date();
 const count=settleArchive(data,feed,now);
 if(count){
  const completed=data.records.filter(x=>x.status==='won'||x.status==='lost');
  data.stats={total:data.records.length,pending:data.records.filter(x=>x.status==='pending').length,
   won:completed.filter(x=>x.status==='won').length,
   lost:completed.filter(x=>x.status==='lost').length,
   pnl:round(completed.reduce((n,x)=>n+(typeof x.pnl==='number'?x.pnl:0),0))};
  data.last_settlement_check=now.toISOString();
  await writeFile(file,JSON.stringify(data,null,2)+'\n');
 }
 console.log('LAB 1X2 public FT: '+count+' nuovi esiti; nessuna modifica REAL o LAB auto.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1});
