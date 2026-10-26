/**
 * Scanner Conte LIVE — fonte alternativa gratuita per hobby personale.
 * Football-Data.co.uk: download leggero SOLO martedi e venerdi.
 * Non effettua chiamate API-Football; preserva lo storico originale.
 * Le quote sono snapshot di mercato, non quote live garantite.
 */
import { readFile,writeFile } from 'node:fs/promises';

const FIXTURES='https://www.football-data.co.uk/fixtures.csv';
const BASE='https://www.football-data.co.uk/mmz4281';
const LEAGUES=['I1','I2','E0','E1','E2','D1','SP1','F1','N1'];
const FILES={feed:'data/fixtures_latest.json',lab:'data/lab_auto.json',status:'data/football_data_status.json'};
const TZ='Europe/Rome';
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function dateCode(date=new Date()){
 const year=Number(new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric'}).format(date));
 const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:TZ,month:'numeric'}).format(date));
 const start=month>=7?year:year-1;return String(start).slice(-2)+String(start+1).slice(-2);
}
function parseCSV(str){
 str=str.replace(/^\uFEFF/,'');let rows=[],row=[],item='',quoted=false;
 for(let i=0;i<str.length;i++){
  const c=str[i];
  if(c==='"'){
   if(quoted&&str[i+1]==='"'){item+='"';i++}else quoted=!quoted;
  }else if(c===','&&!quoted){row.push(item);item=''}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&str[i+1]==='\n')i++;
   row.push(item);if(row.some(v=>v.trim()))rows.push(row);row=[];item='';
  }else item+=c;
 }
 if(item||row.length){row.push(item);rows.push(row)}
 if(rows.length<1)throw Error('CSV vuoto');
 const headers=rows.shift().map(s=>s.trim());
 if(!headers.includes('HomeTeam')||!headers.includes('AwayTeam'))throw Error('CSV non contiene le squadre richieste');
 return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));
}
function dateISO(raw){
 const value=String(raw||'').trim();
 const m=value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
 if(!m)return '';
 let y=Number(m[3]);if(y<100)y+=y>70?1900:2000;
 const month=Number(m[2]),day=Number(m[1]);
 if(month<1||month>12||day<1||day>31)return '';
 return y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function safeName(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/\bgiuliano\b/g,'giugliano').replace(/[^a-z0-9]/g,'');}
const aliases={
 'manutd':'manchesterunited','manunited':'manchesterunited','manchesterutd':'manchesterunited',
 'manchesterunited':'manchesterunited','man city':'manchestercity',
 'psg':'parissaintgermain','parissg':'parissaintgermain','parissaintgermain':'parissaintgermain',
 'redstar':'redstarfc93','redstarfc':'redstarfc93','redstarfc93':'redstarfc93',
 'inter':'inter','intermilan':'inter','internazionale':'inter',
 'acmilan':'milan','milan':'milan','roma':'roma','asroma':'roma',
 'athmadrid':'atleticomadrid','atlmadrid':'atleticomadrid','atleticomadrid':'atleticomadrid',
 'bayernmunich':'bayernmunchen','bayernmunchen':'bayernmunchen',
 'leverkusen':'bayerleverkusen','bayerleverkusen':'bayerleverkusen',
 'salford':'salfordcity','salfordcity':'salfordcity',
 'wolves':'wolverhampton','wolverhamptonwanderers':'wolverhampton',
 'newcastle':'newcastleunited','newcastleunited':'newcastleunited',
 'westham':'westhamunited','westhamunited':'westhamunited',
 'brighton':'brightonhovealbion','brightonhovealbion':'brightonhovealbion',
 'nottmforest':'nottinghamforest','nottinghamforest':'nottinghamforest',
 'spurs':'tottenham','tottenhamhotspur':'tottenham','tottenham':'tottenham',
 'athleticbilbao':'athleticclub','athleticclub':'athleticclub'
};
function team(v){const t=safeName(v);return aliases[t]||t}
function slug(v){return safeName(v).slice(0,26)}
function rounded(n){return Math.round((n+Number.EPSILON)*100)/100}
function price(v){const n=Number(v);return Number.isFinite(n)&&n>=1.01&&n<=100?n:null}
function gameDate(row){return dateISO(row.Date)}
function marketLines(row){
 const lines=[];
 for(const [col,market,selection] of [
  ['B365H','1X2','1'],['B365D','1X2','X'],['B365A','1X2','2'],
  ['B365>2.5','Under/Over 2,5','Over 2,5'],['B365<2.5','Under/Over 2,5','Under 2,5']
 ]){
  const odds=price(row[col]);if(odds!==null)lines.push({market,selection,odds});
 }
 return lines;
}
function kickoffISO(row){
 const date=gameDate(row),t=(row.Time||'').match(/^(\d\d?):(\d\d)$/);
 if(!date||!t)return null;
 const [yy,mm,dd]=date.split('-').map(Number),hh=Number(t[1]),minute=Number(t[2]);
 if(hh>23||minute>59)return null;
 // I file Football-Data riportano orari locali britannici: GMT/BST.
 const approx=Date.UTC(yy,mm-1,dd,hh,minute);
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/London',timeZoneName:'shortOffset'}).formatToParts(new Date(approx));
 const zone=parts.find(p=>p.type==='timeZoneName')?.value||'GMT';
 const h=Number((zone.match(/GMT([+-]\d+)/)||[])[1]||0);
 return new Date(approx-h*3600000).toISOString();
}
async function getCSV(url){
 const r=await fetch(url,{headers:{'user-agent':'ScannerConteLIVE/1.0 (personal research; low-frequency CSV download)','accept':'text/csv, text/plain;q=0.9,*/*;q=0.5'},signal:AbortSignal.timeout(23000)});
 if(!r.ok)throw Error('Download HTTP '+r.status+' da '+url);
 const body=await r.text();
 if(body.length<20||body.slice(0,200).toLowerCase().includes('<html'))throw Error('Risposta non CSV da '+url);
 return parseCSV(body);
}
function completed(row){
 const h=Number(row.FTHG),a=Number(row.FTAG);
 return row.FTHG!==''&&row.FTAG!==''&&Number.isInteger(h)&&Number.isInteger(a)&&['H','A','D'].includes(row.FTR)?{h,a}:null;
}
function oddsPicks(row){
 const h=price(row.B365H),d=price(row.B365D),a=price(row.B365A),over=price(row['B365>2.5']),under=price(row['B365<2.5']);
 const picks=[];
 if(h&&d&&a){
  const min=Math.min(h,a);
  if(min>=1.45&&min<=2.10&&min<d)
   picks.push({strategy:'FAVORITA_1X2_CONTROLLO',selection:h<=a?'Home':'Away',odds:min,market_probability_pct:rounded(100*(1/min)/(1/h+1/d+1/a))});
 }
 if(over&&under&&over>=1.6&&over<=2.2)
  picks.push({strategy:'OVER25_CONTROLLO',selection:'Over 2.5',odds:over,market_probability_pct:rounded(100*(1/over)/(1/over+1/under))});
 return picks;
}
function settle(lab,game){
 if(lab.status!=='pending'||!game||!Number.isInteger(game.h)||!Number.isInteger(game.a))return false;
 let hit=null;
 if(lab.strategy==='OVER25_CONTROLLO')hit=game.h+game.a>2;
 if(lab.strategy==='FAVORITA_1X2_CONTROLLO')hit=lab.selection==='Home'?game.h>game.a:lab.selection==='Away'?game.a>game.h:null;
 if(hit===null)return false;
 lab.status=hit?'won':'lost';lab.pnl=hit?rounded((lab.odds-1)*(lab.stake_virtual||1)):-(lab.stake_virtual||1);
 lab.score=game.h+'-'+game.a;lab.settled_at=new Date().toISOString();
 lab.settlement_source='Football-Data.co.uk FT (matched by date and both teams)';
 return true;
}
function matchRow(fixture,rows){
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(fixture.kickoff));
 const matches=rows.filter(r=>gameDate(r)===date&&team(r.HomeTeam)===team(fixture.home)&&team(r.AwayTeam)===team(fixture.away));
 return matches.length===1?matches[0]:null;
}
async function main(){
 const now=new Date(),captured_at=now.toISOString();
 // Fair use: non ripetere i download entro 36 ore anche se avviato manualmente.
 // La fonte consente massimo due sessioni automatiche settimanali.
 try{
  const previous=JSON.parse(await readFile(FILES.status,'utf8'));
  if(previous.updated_at&&Date.now()-Date.parse(previous.updated_at)<36*3600000){
   console.log('SKIP: fonte scaricata da meno di 36 ore; rispetto frequenza fornitore.');
   return;
  }
 }catch{}

 const fixtureRows=await getCSV(FIXTURES);
 const season=dateCode(now);
 const results=[],failed=[];
 for(const div of LEAGUES){
  try{
   const records=await getCSV(BASE+'/'+season+'/'+div+'.csv');
   results.push(...records.filter(r=>r.Div===div&&gameDate(r)));
  }catch(e){failed.push(div+': '+e.message)}
 }
 if(!results.length)throw Error('Nessun campionato storico disponibile. '+failed.join('; '));
 const lab=JSON.parse(await readFile(FILES.lab,'utf8'));
 const feed=JSON.parse(await readFile(FILES.feed,'utf8'));
 if(lab.schema!=='scanner-conte-lab-v1'||!Array.isArray(lab.records)||feed.schema!=='scanner-conte-fixtures-v1')throw Error('Dati esistenti non validi');
 let matched=0,closed=0;
 for(const fixture of feed.fixtures){
  if(!fixture.kickoff||fixture.status==='FT')continue;
  const row=matchRow(fixture,results),game=row?completed(row):null;
  if(game){fixture.status='FT';fixture.home_goals=game.h;fixture.away_goals=game.a;matched++}
 }
 const key=(day,home,away)=>day+'|'+team(home)+'|'+team(away);
 const finalMap=new Map();
 for(const r of results){const day=gameDate(r),game=completed(r);if(day&&game){const k=key(day,r.HomeTeam,r.AwayTeam);if(!finalMap.has(k))finalMap.set(k,game);else finalMap.set(k,null)}}
 for(const record of lab.records){
  if(record.status!=='pending')continue;
  const names=String(record.match).split(/\s+-\s+/);
  if(names.length!==2)continue;
  const day=record.kickoff?new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(record.kickoff)):'';
  const game=finalMap.get(key(day,names[0],names[1]));
  if(settle(record,game))closed++;
 }
 // Capture a SMALL derived watchlist from this week's upcoming fixture feed.
 // Never use historical result odds to create new pre-match paper tests.
 const future=fixtureRows.filter(r=>{
  const iso=kickoffISO(r);return iso&&Date.parse(iso)>Date.now()+45*60000&&
    Date.parse(iso)<Date.now()+6*86400000&&LEAGUES.includes(r.Div);
 });
 const unique=new Set(),picks=[];
 for(const row of future){
  const kickoff=kickoffISO(row);if(!kickoff)continue;
  const k=key(gameDate(row),row.HomeTeam,row.AwayTeam);
  if(unique.has(k))continue;unique.add(k);
  const suggested=oddsPicks(row);
  if(!suggested.length)continue;
  const id='fd-'+row.Div+'-'+gameDate(row).replaceAll('-','')+'-'+slug(row.HomeTeam)+'-'+slug(row.AwayTeam);
  for(const pick of suggested){
   const recId=id+':'+pick.strategy;
   if(lab.records.some(x=>x.id===recId))continue;
   // Never create entries from a match already started (no hindsight).
   if(Date.parse(kickoff)<=Date.now()+45*60000)continue;
   const record={id:recId,fixture_id:id,kickoff,match:row.HomeTeam+' - '+row.AwayTeam,
    league:row.Div+' · Football-Data',bookmaker:'Bet365 (Football-Data snapshot)',
    strategy:pick.strategy,selection:pick.selection,odds:pick.odds,
    market_probability_pct:pick.market_probability_pct,stake_virtual:1,status:'pending',pnl:null,
    score:null,captured_at,settled_at:null,
    origin:'Football-Data fixture CSV observed before kickoff',
    note:'Quote di riferimento rilevate in anticipo; disponibilita non garantita e valore atteso non dimostrato.'};
   lab.records.push(record);picks.push(record);
  }
 }
 lab.last_run=captured_at;
 lab.stats={total:lab.records.length,pending:lab.records.filter(r=>r.status==='pending').length,
  won:lab.records.filter(r=>r.status==='won').length,lost:lab.records.filter(r=>r.status==='lost').length,
  pnl:rounded(lab.records.reduce((a,r)=>a+(typeof r.pnl==='number'?r.pnl:0),0))};
 feed.coverage.scheduled=feed.fixtures.filter(x=>['NS','TBD'].includes(x.status)).length;
 feed.coverage.finished=feed.fixtures.filter(x=>['FT','AET','PEN'].includes(x.status)).length;
 feed.last_result_refresh=captured_at;
 feed.fallback_source='Football-Data.co.uk (league limited, two updates/week)';
 const status={schema:'scanner-conte-fallback-v1',provider:'Football-Data.co.uk',mode:'PERSONAL_FALLBACK',
  updated_at:captured_at,feed_date:today(),next_update_policy:'Tuesday and Friday only',
  fixture_rows:fixtureRows.length,result_rows:results.length,leagues_ok:LEAGUES.length-failed.length,
  leagues_failed:failed,matched_existing:matched,settled_existing:closed,new_paper_tests:picks.length,
  total_paper_tests:lab.stats.total,pending:lab.stats.pending,
  warning:'Neither live results nor live Bet365 quotes. No personal REAL records are published.'};
 await writeFile(FILES.lab,JSON.stringify(lab,null,2)+'\n');
 await writeFile(FILES.feed,JSON.stringify(feed,null,2)+'\n');
 await writeFile(FILES.status,JSON.stringify(status,null,2)+'\n');
 console.log('Fallback OK: '+JSON.stringify(status));
}
main().catch(e=>{console.error('FALLBACK FAILED: '+e.message);process.exitCode=1});
