/**
 * Scanner Conte LIVE — risultati FT da scoreboard pubblico ESPN, senza API key.
 * Eseguito da GitHub Actions; NON contiene quote, pronostici o dati REAL privati.
 * Conserva le verifiche ufficiali manuali e non segna mai partite rinviate come concluse.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const LEAGUES = Object.freeze([
 {code:'ger.1',name:'Bundesliga'},
 {code:'esp.2',name:'LaLiga Hypermotion'},
 {code:'ita.1',name:'Serie A'},
 {code:'ita.2',name:'Serie B'},
 {code:'eng.1',name:'Premier League'},
 {code:'eng.2',name:'Championship'},
 {code:'esp.1',name:'LaLiga'},
 {code:'fra.1',name:'Ligue 1'},
 {code:'ned.1',name:'Eredivisie'},
 {code:'por.1',name:'Primeira Liga'}
]);
const FILE='data/results_public.json';
const SCHEMA='scanner-conte-results-public-v1';
const dayUTC=(dayOffset,now=new Date())=>{
 const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+dayOffset));
 return d.toISOString().slice(0,10).replaceAll('-','');
};
const toScore=score=>{
 const v=score&&typeof score==='object'?score.displayValue??score.value:score;
 const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=80?n:null;
};
const secureLink=(link)=>{
 try{
  const u=new URL(String(link||''));
  return u.protocol==='https:'&&['www.espn.com','espn.com'].includes(u.hostname)?u.href:null;
 }catch{return null}
};
export function normalizeESPN(event,league){
 const competition=event?.competitions?.[0];
 if(!competition||!Array.isArray(competition.competitors))return null;
 const home=competition.competitors.find(x=>x.homeAway==='home');
 const away=competition.competitors.find(x=>x.homeAway==='away');
 const homeName=String(home?.team?.displayName||home?.team?.name||'').trim();
 const awayName=String(away?.team?.displayName||away?.team?.name||'').trim();
 const date=String(event.date||competition.date||'');
 if(!homeName||!awayName||!Number.isFinite(Date.parse(date))||!String(event.id||'').trim())return null;
 const type=event?.status?.type||competition?.status?.type||{};
 const statusName=String(type.name||'').toUpperCase();
 const description=String(type.description||type.shortDetail||'').toLowerCase();
 const postponed=statusName.includes('POSTPONED')||statusName.includes('CANCELED')||
   statusName.includes('CANCELLED')||description.includes('postponed')||description.includes('cancelled');
 const finished=type.completed===true||['STATUS_FINAL','STATUS_FULL_TIME'].includes(statusName);
 if(!finished&&!postponed)return null;
 const h=finished?toScore(home.score):null,a=finished?toScore(away.score):null;
 if(finished&&(h===null||a===null))return null;
 const links=[...(Array.isArray(event.links)?event.links:[]),
   ...(Array.isArray(competition.links)?competition.links:[])];
 const sourceUrl=links.map(x=>secureLink(x.href)).find(Boolean)??'https://www.espn.com/soccer/scoreboard';
 return {
  id:'espn-'+league.code+'-'+String(event.id),
  kickoff:new Date(date).toISOString(),
  status:finished?'FT':'PST',
  league:league.name,
  league_code:league.code,
  home:homeName,away:awayName,
  home_goals:h,away_goals:a,
  source:'ESPN public scoreboard',
  source_url:sourceUrl,
  verification:'espn_scoreboard'
 };
}
export function mergeResults(previous,received,now=new Date()){
 if(previous?.schema!==SCHEMA||!Array.isArray(previous.fixtures))throw Error('Archivio risultati precedente non compatibile');
 const keepAfter=now.getTime()-21*86400000;
 // Due fonti per lo stesso incontro: priorita alla verifica ufficiale.
 const team=s=>{
  const norm=String(s||'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
  const map={'hamburg sv':'hamburger sv','hamburg':'hamburger sv','hsv':'hamburger sv',
    'frankfurt':'eintracht frankfurt','cd tenerife':'tenerife','andorra':'fc andorra'};
  return map[norm]||norm;
 };
 const key=r=>r.league_code+'|'+r.kickoff.slice(0,10)+'|'+team(r.home)+'|'+team(r.away);
 const m=new Map();
 const postponed=previous.fixtures.filter(r=>r.status==='PST'&&r.verification==='official'&&r.original_local_date);
 for(const item of [...previous.fixtures,...received]){
  if(!item?.id||!item.kickoff||!item.home||!item.away)continue;
  if(item.verification!=='official'&&Date.parse(item.kickoff)<keepAfter)continue;
  let r=item;
  // Una partita ufficialmente rimandata e disputata entro 5 giorni
  // mantiene anche la data del biglietto originale (senza inventare esiti).
  if(r.status==='FT'&&r.verification!=='official'){
   const matches=postponed.filter(p=>p.league_code===r.league_code&&
    team(p.home)===team(r.home)&&team(p.away)===team(r.away)&&
    Date.parse(r.kickoff)>=Date.parse(p.kickoff)&&
    Date.parse(r.kickoff)-Date.parse(p.kickoff)<=5*86400000);
   if(matches.length===1)r={...r,original_local_date:matches[0].original_local_date};
  }
  const k=key(r),old=m.get(k);
  if(old?.verification==='official')continue;
  if(r.verification==='official'||!old||r.status==='FT'||old.status!=='FT')m.set(k,r);
 }
 return [...m.values()].sort((a,b)=>a.kickoff.localeCompare(b.kickoff)||a.id.localeCompare(b.id)).slice(-550);
}
async function getJSON(url){
 const r=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'ScannerConteLIVE-public-results/1.0'},
   signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const value=await r.json();
 if(!Array.isArray(value.events))throw Error('ESPN events missing');
 return value;
}
export async function run({now=new Date(),fetcher=getJSON,write=true}={}){
 const previous=JSON.parse(await readFile(FILE,'utf8'));
 if(previous.schema!==SCHEMA||!Array.isArray(previous.fixtures))throw Error('Schema feed non valido');
 const days=[dayUTC(-2,now),dayUTC(-1,now),dayUTC(0,now)];
 const jobs=[];
 for(const day of days)for(const league of LEAGUES)jobs.push({day,league,
  url:'https://site.api.espn.com/apis/site/v2/sports/soccer/'+league.code+'/scoreboard?dates='+day});
 const found=[],errors=[];let success=0;
 for(let i=0;i<jobs.length;i+=5){
  const group=jobs.slice(i,i+5);
  const settled=await Promise.allSettled(group.map(j=>fetcher(j.url)));
  settled.forEach((entry,index)=>{
   const j=group[index];
   if(entry.status!=='fulfilled'){errors.push(j.league.code+' '+j.day+' '+String(entry.reason?.message||entry.reason).slice(0,90));return}
   success++;
   for(const event of entry.value.events){
    const normalized=normalizeESPN(event,j.league);
    if(normalized)found.push(normalized);
   }
  });
 }
 if(success===0)throw Error('Nessuna risposta ESPN valida. Feed precedente conservato. '+errors.slice(0,3).join('; '));
 const fixtures=mergeResults(previous,found,now);
 const output={
  schema:SCHEMA,checked_at:now.toISOString(),
  source:'ESPN public scoreboard + verified official match reports',
  coverage:{leagues:LEAGUES.map(x=>x.code),days,queries:jobs.length,succeeded:success,failed:errors.length},
  note:'Only final match scores; no REAL data. Postponements remain pending; bookmaker rules must be checked separately.',
  fixtures
 };
 if(write)await writeFile(FILE,JSON.stringify(output,null,2)+'\n','utf8');
 console.log('Results: '+fixtures.length+' matches, '+found.filter(x=>x.status==='FT').length+
   ' final results in live requests. Sources OK '+success+'/'+jobs.length+'.');
 if(errors.length)console.warn('Coverage errors: '+errors.slice(0,8).join(' | '));
 return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 run().catch(e=>{console.error('Errore feed risultati pubblici: '+e.message);process.exitCode=1});
}
