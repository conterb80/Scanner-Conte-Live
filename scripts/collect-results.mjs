/**
 * Scanner Conte LIVE V0.7 — verifica sola lettura dal provider dei risultati.
 * Aggiorna i dati pubblici e liquida le simulazioni automatiche; NON accede allo storico REAL.
 * Un'unica chiamata API per esecuzione; preserva gli snapshot prepartita.
 */
import {readFile,writeFile} from 'node:fs/promises';
const key=(process.env.API_FOOTBALL_KEY||'').trim();
if(!key)throw Error('API_FOOTBALL_KEY mancante');
const zone='Europe/Rome';
function todayInRome(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function round(n){return Math.round((n+Number.EPSILON)*100)/100}
function settled(record,fixture){
 if(record.status!=='pending'||fixture.status!=='FT'||
    !Number.isInteger(fixture.home_goals)||!Number.isInteger(fixture.away_goals))return false;
 const h=fixture.home_goals,a=fixture.away_goals;
 const win=record.strategy==='OVER25_CONTROLLO'?(h+a>2.5):
    record.strategy==='FAVORITA_1X2_CONTROLLO'?
       (record.selection==='Home'?h>a:record.selection==='Away'?a>h:null):null;
 if(win===null)return false;
 record.status=win?'won':'lost';
 record.score=h+'-'+a;
 record.pnl=win?round(Number(record.odds)-1)*Number(record.stake_virtual||1):-Number(record.stake_virtual||1);
 record.pnl=round(record.pnl);
 record.settled_at=new Date().toISOString();
 record.settlement_source='API-Football FT';
 return true;
}
async function run(){
 const day=todayInRome();
 const url=new URL('https://v3.football.api-sports.io/fixtures');
 url.searchParams.set('date',day);url.searchParams.set('timezone',zone);
 const response=await fetch(url,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('API HTTP '+response.status);
 const raw=await response.json();
 if(raw.errors&&(Array.isArray(raw.errors)?raw.errors.length:Object.keys(raw.errors).length))throw Error('API: '+JSON.stringify(raw.errors).slice(0,150));
 if(!Array.isArray(raw.response))throw Error('Formato risposta partite non valido');
 const feedPath='data/fixtures_latest.json',labPath='data/lab_auto.json';
 const feed=JSON.parse(await readFile(feedPath,'utf8'));
 const lab=JSON.parse(await readFile(labPath,'utf8'));
 if(feed.schema!=='scanner-conte-fixtures-v1'||!Array.isArray(feed.fixtures)||lab.schema!=='scanner-conte-lab-v1')throw Error('Archivio non riconosciuto');
 const source=new Map(raw.response.filter(x=>x.fixture?.id).map(x=>[String(x.fixture.id),x]));
 let updatedMatches=0;
 for(const fixture of feed.fixtures){
  const a=source.get(String(fixture.id));if(!a)continue;
  const status=a.fixture.status?.short||'UNKNOWN';
  const home=Number.isInteger(a.goals?.home)?a.goals.home:null;
  const away=Number.isInteger(a.goals?.away)?a.goals.away:null;
  if(fixture.status!==status||fixture.home_goals!==home||fixture.away_goals!==away)updatedMatches++;
  fixture.status=status;fixture.home_goals=home;fixture.away_goals=away;
 }
 const byId=new Map(feed.fixtures.map(m=>[String(m.id),m]));
 let closed=0;
 for(const rec of lab.records||[]){
  const fixture=byId.get(String(rec.fixture_id));
  if(fixture&&settled(rec,fixture))closed++;
 }
 lab.stats={
  total:lab.records.length,pending:lab.records.filter(r=>r.status==='pending').length,
  won:lab.records.filter(r=>r.status==='won').length,lost:lab.records.filter(r=>r.status==='lost').length,
  pnl:round(lab.records.reduce((s,r)=>s+(typeof r.pnl==='number'?r.pnl:0),0))
 };
 lab.last_result_check=new Date().toISOString();
 feed.coverage.scheduled=feed.fixtures.filter(x=>['NS','TBD'].includes(x.status)).length;
 feed.coverage.finished=feed.fixtures.filter(x=>['FT','AET','PEN'].includes(x.status)).length;
 feed.last_result_refresh=new Date().toISOString();
 feed.api_remaining=Number(response.headers.get('x-ratelimit-requests-remaining'));
 await writeFile(feedPath,JSON.stringify(feed,null,2)+'\n');
 await writeFile(labPath,JSON.stringify(lab,null,2)+'\n');
 console.log('Risultati '+day+': '+updatedMatches+' eventi cambiati, '+closed+' test LAB conclusi; '+lab.stats.pending+' in attesa. Nessun dato REAL accessibile.');
}
run().catch(e=>{console.error('Errore sincronizzazione risultati: '+e.message);process.exitCode=1});
