/**
 * Scanner Conte LIVE — raccolta automatica del palinsesto.
 * Solo dati pubblici sulle partite, mai puntate o archivio personale.
 * API-Football: https://www.api-football.com/documentation_v3
 * Richiede il secret API_FOOTBALL_KEY nel repository GitHub.
 */
import { writeFile, mkdir } from 'node:fs/promises';

const key = (process.env.API_FOOTBALL_KEY || '').trim();
const output = 'data/fixtures_latest.json';
const TZ = 'Europe/Rome';
const source = 'API-Football';
const countries = new Set([
  'Italy','England','Scotland','Spain','Germany','France','Portugal',
  'Netherlands','Belgium','Austria','Switzerland'
]);

function dateInRome(offset) {
  const fmt = new Intl.DateTimeFormat('en-GB', {timeZone: TZ, year:'numeric',month:'2-digit',day:'2-digit'});
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p=>[p.type,p.value]));
  const midnight = new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+offset,12));
  return midnight.toISOString().slice(0,10);
}

async function fetchDay(day) {
  const url = new URL('https://v3.football.api-sports.io/fixtures');
  url.searchParams.set('date', day);
  url.searchParams.set('timezone', TZ);
  const response = await fetch(url, {
    headers: {'x-apisports-key':key,'Accept':'application/json'},
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error('API HTTP '+response.status+' per '+day);
  const data = await response.json();
  if (data.errors && (Array.isArray(data.errors)?data.errors.length:Object.keys(data.errors).length)) {
    throw new Error('API: '+JSON.stringify(data.errors).slice(0,240));
  }
  if (!Array.isArray(data.response)) throw new Error('Risposta non valida per '+day);
  return {items:data.response,remaining:response.headers.get('x-ratelimit-requests-remaining')};
}

function normalized(x) {
  if (!x.fixture?.id || !x.teams?.home?.name || !x.teams?.away?.name) return null;
  return {
    id: String(x.fixture.id),
    kickoff: x.fixture.date ?? null,
    status: x.fixture.status?.short ?? 'UNKNOWN',
    league: x.league?.name ?? 'Sconosciuta',
    league_id: x.league?.id ?? null,
    country: x.league?.country ?? '',
    home: x.teams.home.name,
    away: x.teams.away.name,
    home_goals: Number.isInteger(x.goals?.home) ? x.goals.home : null,
    away_goals: Number.isInteger(x.goals?.away) ? x.goals.away : null
  };
}

async function main() {
  if (!key) {
    console.log('CONFIGURAZIONE ATTESA: manca il secret API_FOOTBALL_KEY. Nessun dato pubblicato.');
    return;
  }
  const dates=[dateInRome(-1),dateInRome(0),dateInRome(1)];
  const collected=[];
  let remaining=null;
  // Tre chiamate per esecuzione: prima, durante e dopo la giornata corrente.
  for (const day of dates) {
    const result=await fetchDay(day);
    collected.push(...result.items);
    remaining=result.remaining ?? remaining;
    console.log(day+': '+result.items.length+' partite totali');
  }
  const unique=new Map();
  for (const x of collected) {
    const m=normalized(x);
    if (m && countries.has(m.country)) unique.set(m.id,m);
  }
  const fixtures=[...unique.values()].sort((a,b)=>(a.kickoff||'').localeCompare(b.kickoff||'') || a.id.localeCompare(b.id));
  const leagues=new Set(fixtures.map(x=>x.country+' / '+x.league));
  const feed={
    schema:'scanner-conte-fixtures-v1',
    phase:'raccolta_palinsesto',
    status:'ready',
    source,
    collected_at:new Date().toISOString(),
    timezone:TZ,
    dates,
    coverage:{
      provided_matches:collected.length,
      eligible_matches:fixtures.length,
      eligible_competitions:leagues.size,
      scheduled:fixtures.filter(x=>['NS','TBD'].includes(x.status)).length,
      finished:fixtures.filter(x=>['FT','AET','PEN'].includes(x.status)).length
    },
    api_remaining:remaining===null?null:Number(remaining),
    note:'Solo partite e risultati. Quote, probabilita, LAB automatico e REAL non sono attivi.',
    fixtures
  };
  await mkdir('data',{recursive:true});
  await writeFile(output,JSON.stringify(feed,null,2)+'\n','utf8');
  console.log('Salvate '+fixtures.length+' partite di '+leagues.size+' competizioni. Chiave API mai pubblicata.');
}
main().catch(err=>{console.error('Errore raccolta: '+err.message);process.exitCode=1;});
