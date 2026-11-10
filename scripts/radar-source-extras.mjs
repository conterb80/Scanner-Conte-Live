/**
 * Fonti pubbliche complementari al radar. Solo calendario: MAI quote,
 * puntate, value betting o correzione di esiti.
 * OpenLigaDB: chiave non richiesta, massimo due richieste per scansione.
 * TheSportsDB V1 free: al massimo 3 eventi per data. Solo due date.
 */
const ms=v=>Date.parse(v||'');
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
const TZ='Europe/Rome';
const day=x=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const dateUTC=(now,plus)=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+plus)).toISOString().slice(0,10);
const isFuture=(kickoff,now)=>Number.isFinite(ms(kickoff))&&ms(kickoff)>now.getTime()+15*60000&&ms(kickoff)<=now.getTime()+72*3600000;
const safe=val=>String(val||'').trim().slice(0,120);
const radarRow=(id,home,away,kickoff,league,source,url,code)=>({
 id,home,away,match:home+' – '+away,kickoff,league,
 source,source_code:code,source_url:url,
 market:'NESSUNA QUOTA LIVE',odds:null,quote_status:'NOT_AVAILABLE'
});
export function parseOpenLiga(match,now=new Date()){
 const home=safe(match?.team1?.teamName),away=safe(match?.team2?.teamName);
 const id=Number(match?.matchID);
 const utc=match?.matchDateTimeUTC||null;
 const when=ms(utc);
 if(!home||!away||!Number.isInteger(id)||id<=0||!isFuture(utc,now)||match?.matchIsFinished===true)return null;
 const code=String(match.leagueShortcut||'').toLowerCase();
 const league=code==='bl1'?'Bundesliga (OpenLigaDB)':code==='bl2'?'2. Bundesliga (OpenLigaDB)':safe(match.leagueName)||'Germania';
 return radarRow('openliga-'+id,home,away,new Date(when).toISOString(),league,'OpenLigaDB · calendario gratuito',
  'https://www.openligadb.de/','openliga-'+code);
}
export function parseSportsDB(event,now=new Date()){
 if(norm(event?.strSport)!=='soccer')return null;
 const home=safe(event?.strHomeTeam),away=safe(event?.strAwayTeam),id=String(event?.idEvent||'');
 const raw=String(event?.strTimestamp||'');
 // Senza UTC completo non inventare fusi orari e orari di inizio.
 const kickoff=ms(raw);
 const status=norm(event?.strStatus);
 if(!home||!away||!/^\d+$/.test(id)||!/Z$|[+-]\d\d:\d\d$/.test(raw)||
   !isFuture(raw,now)||/finish|full time|postpon|cancel|aband/.test(status))return null;
 return radarRow('sportsdb-'+id,home,away,new Date(kickoff).toISOString(),
  safe(event?.strLeague)||'Competizione non specificata',
  'TheSportsDB · V1 gratuita (copertura limitata)',
  'https://www.thesportsdb.com/event/'+encodeURIComponent(id),'sportsdb-'+safe(event.idLeague));
}
async function getJSON(url,fetcher,timeout=13000){
 const res=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'ScannerConteLIVE-personal-research/1.0'},
  signal:AbortSignal.timeout(timeout)});
 if(!res.ok)throw Error('HTTP '+res.status);
 return res.json();
}
export async function collectComplementarySources({now=new Date(),fetcher=fetch}={}){
 let items=[],status={openligadb:{requests:0,ok:0,failed:0,fixtures:0},thesportsdb:{requests:0,ok:0,failed:0,fixtures:0}};
 const season=Number(day(now).slice(0,4)); // Stagione iniziata in estate, es. 2026/27 -> 2026
 const offsets=[0,1];
 const tasks=[
  ...['bl1','bl2'].map(code=>({source:'openligadb',url:'https://api.openligadb.de/getmatchdata/'+code+'/'+season,parse:json=>{
   if(!Array.isArray(json))throw Error('Risposta OpenLigaDB non valida');
   return json.map(x=>parseOpenLiga(x,now)).filter(Boolean);
  }})),
  ...offsets.map(offset=>({source:'thesportsdb',url:'https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d='+dateUTC(now,offset)+'&s=Soccer',parse:json=>{
   if(json===null||typeof json!=='object'||!('events' in json))throw Error('Risposta TheSportsDB non valida');
   if(json.events!==null&&!Array.isArray(json.events))throw Error('Eventi TheSportsDB non validi');
   return (json.events||[]).map(x=>parseSportsDB(x,now)).filter(Boolean);
  }}))
 ];
 // Quattro chiamate totali, due per provider, ben al di sotto dei limiti free.
 for(const task of tasks){
  status[task.source].requests++;
  try{
   const json=await getJSON(task.url,fetcher);
   const rows=task.parse(json);items.push(...rows);
   status[task.source].ok++;
   status[task.source].fixtures+=rows.length;
  }catch(e){
   status[task.source].failed++;
   status[task.source].last_error=String(e.message||e).slice(0,110);
  }
 }
 return {items,status};
}
