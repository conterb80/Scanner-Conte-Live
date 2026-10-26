/** Scanner Conte LIVE — recupero gratuito risultati ESPN (API pubblica non ufficiale).
 * Non usa API-Football. Non raccoglie quote. Non accede ai record REAL locali.
 * Sicurezza: solo partite FT con nome completo di entrambe le squadre,
 * lega e calcio d'inizio compatibili. Non crea test o dati inventati.
 */
import {readFile,writeFile} from 'node:fs/promises';
const BASE='https://site.api.espn.com/apis/site/v2/sports/soccer/';
const LEAGUES={
 'Italy|Serie A':'ita.1','Italy|Serie B':'ita.2',
 'England|Premier League':'eng.1','England|Championship':'eng.2',
 'England|League One':'eng.3','England|League Two':'eng.4',
 'Spain|La Liga':'esp.1','Spain|Segunda División':'esp.2',
 'Germany|Bundesliga':'ger.1','Germany|2. Bundesliga':'ger.2',
 'France|Ligue 1':'fra.1','France|Ligue 2':'fra.2',
 'Scotland|Premiership':'sco.1','Scotland|Championship':'sco.2',
 'Netherlands|Eredivisie':'ned.1','Netherlands|Eerste Divisie':'ned.2',
 'Portugal|Primeira Liga':'por.1','Belgium|Jupiler Pro League':'bel.1',
 'Austria|Bundesliga':'aut.1','Switzerland|Super League':'sui.1'
};
const ALIASES={
 'paris saint germain':'psg','paris sg':'psg','paris saint germain fc':'psg',
 'olympique lyonnais':'lyon','ol lyonnais':'lyon',
 'olympique de marseille':'marseille','as monaco':'monaco',
 'red star fc 93':'red star','red star 93':'red star',
 'red star fc':'red star','fc red star':'red star',
 'salford city':'salford','fc salford city':'salford',
 'seville':'sevilla','sevilla fc':'sevilla',
 'stade reims':'reims','stade de reims':'reims',
 'bologna fc 1909':'bologna','ac milan':'milan',
 'fc inter milan':'internazionale','inter milan':'internazionale',
 'sporting clube de portugal':'sporting cp',
 'cd santa clara':'santa clara'
};
const normalize=s=>{
 let x=String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 x=x.replace(/\bfootball club\b/g,'fc').replace(/\bclub de futbol\b/g,'cf');
 x=x.replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 return ALIASES[x]||x;
};
const teamNames=t=>[t?.displayName,t?.shortDisplayName,t?.name].filter(Boolean).map(normalize);
const same=(team,name)=>teamNames(team).includes(normalize(name));
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const toRomeDay=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const isoDay=s=>String(s).slice(0,10);
const parseScore=s=>/^\d+$/.test(String(s??''))?Number(s):null;
async function collect(slug,dates){
 const url=new URL(BASE+slug+'/scoreboard');
 url.searchParams.set('dates',dates);
 url.searchParams.set('limit','150');
 const res=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'ScannerConteResearch/1.0 (noncommercial, results-only)'},signal:AbortSignal.timeout(18000)});
 if(!res.ok)throw Error('ESPN '+slug+' HTTP '+res.status);
 const data=await res.json();
 if(!Array.isArray(data.events))throw Error('ESPN '+slug+' JSON non compatibile');
 return data.events;
}
function normalizedEvents(events,slug){
 return events.flatMap(ev=>{
  const c=ev.competitions?.[0],players=c?.competitors;
  if(!Array.isArray(players)||players.length!==2)return[];
  const h=players.find(x=>x.homeAway==='home'),a=players.find(x=>x.homeAway==='away');
  if(!h||!a)return[];
  const type=ev.status?.type??c?.status?.type;
  if(type?.completed!==true||!['post'].includes(type?.state))return[];
  // Skip playoff/cups/after extra time when regular-time result is not reliable.
  if((ev.status?.period??c?.status?.period??2)>2)return[];
  const hs=parseScore(h.score),as=parseScore(a.score);
  if(hs===null||as===null||!ev.date)return[];
  return [{homeTeam:h.team,awayTeam:a.team,homeGoals:hs,awayGoals:as,date:ev.date,espnId:String(ev.id),slug}];
 });
}
function settle(rec,m){
 if(rec.status!=='pending'||m.status!=='FT'||!Number.isInteger(m.home_goals)||!Number.isInteger(m.away_goals))return false;
 const h=m.home_goals,a=m.away_goals;
 const win=rec.strategy==='OVER25_CONTROLLO'?(h+a>=3):rec.strategy==='FAVORITA_1X2_CONTROLLO'?
 (rec.selection==='Home'?h>a:rec.selection==='Away'?a>h:null):null;
 if(win===null)return false;
 rec.status=win?'won':'lost';
 rec.pnl=round(win?Number(rec.stake_virtual||1)*(Number(rec.odds)-1):-Number(rec.stake_virtual||1));
 rec.score=h+'-'+a;rec.settled_at=new Date().toISOString();
 rec.settlement_source='ESPN scoreboard pubblico (non ufficiale), FT';
 return true;
}
async function main(){
 const feed=JSON.parse(await readFile('data/fixtures_latest.json','utf8'));
 const lab=JSON.parse(await readFile('data/lab_auto.json','utf8'));
 if(feed.schema!=='scanner-conte-fixtures-v1'||lab.schema!=='scanner-conte-lab-v1')throw Error('Archivi esistenti non validi');
 // La finestra comprende fino a due giorni: nessuna nuova quota, limitati solo agli eventi di interesse.
 const now=new Date(),utcNow=now.toISOString().slice(0,10);
 // ESPN ha smesso di accettare gli intervalli YYYYMMDD-YYYYMMDD nel 2026.
 // Per un mese sono sufficienti <=100 partite per la maggior parte delle leghe.
 const dates=utcNow.slice(0,7).replaceAll('-','');
 const wanted=[...new Set(feed.fixtures.filter(m=>{
  const t=Date.parse(m.kickoff);return Number.isFinite(t)&&t<=Date.now()&&t>=Date.now()-72*3600000
 }).map(m=>LEAGUES[m.country+'|'+m.league]).filter(Boolean))].sort();
 if(!wanted.length){console.log('Nessuna lega supportata per le partite recenti.');return;}
 let successes=0,failures=[],examined=0,changed=0,closed=0;
 const eventsByLeague=new Map();
 for(let i=0;i<wanted.length;i++){
  if(i)await new Promise(r=>setTimeout(r,1250));
  const slug=wanted[i];
  try{const events=normalizedEvents(await collect(slug,dates),slug);eventsByLeague.set(slug,events);examined+=events.length;successes++;}
  catch(e){failures.push(slug+': '+e.message);}
 }
 if(!successes)throw Error('Nessuna lega ESPN disponibile. '+failures.slice(0,3).join('; '));
 for(const f of feed.fixtures){
  const slug=LEAGUES[f.country+'|'+f.league];
  if(!slug||f.status==='FT'||!eventsByLeague.has(slug))continue;
  const candidates=(eventsByLeague.get(slug)||[]).filter(e=>
    same(e.homeTeam,f.home)&&same(e.awayTeam,f.away)&&
    Math.abs(Date.parse(e.date)-Date.parse(f.kickoff))<=6*3600000 &&
    toRomeDay(e.date)===toRomeDay(f.kickoff));
  if(candidates.length!==1)continue;
  const e=candidates[0];
  f.status='FT';f.home_goals=e.homeGoals;f.away_goals=e.awayGoals;
  f.result_source='ESPN scoreboard pubblico, non ufficiale';
  f.result_external_id=e.espnId;changed++;
 }
 const matches=new Map(feed.fixtures.map(m=>[String(m.id),m]));
 for(const rec of lab.records){
  if(settle(rec,matches.get(String(rec.fixture_id))||{}))closed++;
 }
 lab.stats={total:lab.records.length,pending:lab.records.filter(r=>r.status==='pending').length,
  won:lab.records.filter(r=>r.status==='won').length,lost:lab.records.filter(r=>r.status==='lost').length,
  pnl:round(lab.records.reduce((n,r)=>n+(Number.isFinite(r.pnl)?r.pnl:0),0))};
 const summary={schema:'scanner-conte-fallback-v1',checked_at:new Date().toISOString(),
  provider:'ESPN public scoreboard (unofficial, no API key)',quotes_available:false,
  leagues_requested:wanted.length,leagues_success:successes,finished_events_found:examined,
  fixtures_updated:changed,lab_closed:closed,errors:failures,
  note:'La mancata corrispondenza non equivale a uno 0-0. Campionati senza copertura non aggiornati.'};
 feed.last_open_result_check=summary.checked_at;
 lab.last_open_result_check=summary.checked_at;
 feed.coverage.scheduled=feed.fixtures.filter(x=>['NS','TBD'].includes(x.status)).length;
 feed.coverage.finished=feed.fixtures.filter(x=>['FT','AET','PEN'].includes(x.status)).length;
 await writeFile('data/fixtures_latest.json',JSON.stringify(feed,null,2)+'\n');
 await writeFile('data/lab_auto.json',JSON.stringify(lab,null,2)+'\n');
 await writeFile('data/fallback_status.json',JSON.stringify(summary,null,2)+'\n');
 console.log('FALLBACK '+JSON.stringify(summary));
}
main().catch(err=>{console.error('Fallback ESPN fallito: '+err.message);process.exitCode=1;});
