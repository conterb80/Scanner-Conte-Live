/** REAL CONTE in chat — chiusura sicura con risultati ESPN pubblici.
 * Non tocca mai REAL locali, LAB automatico o pronostici prepartita.
 * Una mancata corrispondenza resta pending, senza indovinare l'esito.
 */
import {readFile,writeFile} from 'node:fs/promises';
const ARCHIVE='data/real_conte_chat.json';
const FEED='data/results_public.json';
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const aliases={
  'cd sabadell':'sabadell','ce sabadell':'sabadell',
  'r sociedad b':'real sociedad b','real sociedad ii':'real sociedad b',
  'csa steaua bucuresti':'csa steaua','steaua bucharest':'csa steaua',
  'milton keynes dons':'mk dons',
  'bristol rovers':'bristol rovers','reading fc':'reading',
  'hvidovre if':'hvidovre',
  'vitoria de guimaraes':'vitoria sc','vitoria guimaraes':'vitoria sc','fc porto':'porto'
};
const team=x=>aliases[norm(x)]||norm(x);
const day=x=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
function settle(record,fixtures,now){
 if(record.status!=='pending'||!Number.isFinite(Date.parse(record.kickoff))||
    !Number.isFinite(Date.parse(now))||Date.parse(record.kickoff)>=Date.parse(now)-115*60000)return null;
 const parts=String(record.match||'').split(/\s+[-–—]\s+/);
 if(parts.length!==2||!(Date.parse(record.kickoff)>Date.parse('2026-01-01')))return null;
 // Fonte solo dopo una registrazione prepartita davvero congelata.
 const possibilities=fixtures.filter(f=>f.status==='FT'&&Number.isInteger(f.home_goals)&&
  Number.isInteger(f.away_goals)&&Number.isFinite(Date.parse(f.kickoff))&&
  day(f.kickoff)===day(record.kickoff)&&
  team(f.home)===team(parts[0])&&team(f.away)===team(parts[1]));
 if(possibilities.length!==1)return null;
 const f=possibilities[0],pick=String(record.pick||'').trim().charAt(0).toUpperCase();
 if(!['1','X','2'].includes(pick))return null;
 const outcome=f.home_goals>f.away_goals?'1':f.away_goals>f.home_goals?'2':'X';
 const status=pick===outcome?'won':'lost';
 const stake=Number(record.stake);
 return {status,score:f.home_goals+'-'+f.away_goals,
  pnl:Number.isFinite(stake)&&stake>0&&record.kind!=='CONTROLLO'&&
   Number.isFinite(Number(record.odds))?round(stake*(status==='won'?Number(record.odds)-1:-1)):null,
  result_source:String(f.source||'ESPN public FT'),result_reference:f.source_url||null,
  verified_result:true,settlement_type:'public_espn_ft'};
}
async function main(){
 const archive=JSON.parse(await readFile(ARCHIVE,'utf8'));
 const feed=JSON.parse(await readFile(FEED,'utf8'));
 if(archive.schema_version!==1||!Array.isArray(archive.sessions)||
    feed.schema!=='scanner-conte-results-public-v1'||!Array.isArray(feed.fixtures))throw Error('Schema dati sconosciuto');
 const now=new Date().toISOString();let closed=0;
 for(const session of archive.sessions){
  if(!Array.isArray(session.picks))continue;
  for(const record of session.picks){
   const result=settle(record,feed.fixtures,now);
   if(!result)continue;
   Object.assign(record,result,{result_checked_at:now});
   closed++;
  }
 }
 if(closed){
  archive.last_settlement_check=now;
  await writeFile(ARCHIVE,JSON.stringify(archive,null,2)+'\n','utf8');
 }
 console.log('REAL CONTE CHAT: '+closed+' esiti verificati ESPN; nessuna modifica alle puntate REAL.');
}
if(process.argv[1]?.endsWith('settle-chat-analysis.mjs'))main().catch(e=>{console.error(e);process.exitCode=1});
export {settle};
