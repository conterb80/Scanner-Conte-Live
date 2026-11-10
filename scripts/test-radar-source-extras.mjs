import assert from 'node:assert/strict';
import {parseOpenLiga,parseSportsDB,collectComplementarySources} from './radar-source-extras.mjs';
const now=new Date('2026-11-10T12:00:00.000Z');
const german={matchID:101,matchIsFinished:false,matchDateTimeUTC:'2026-11-11T19:30:00Z',
 team1:{teamName:'Hamburger SV'},team2:{teamName:'Werder Bremen'},leagueShortcut:'bl1',leagueName:'Bundesliga'};
const parsed=parseOpenLiga(german,now);
assert.equal(parsed?.match,'Hamburger SV – Werder Bremen');
assert.equal(parsed.odds,null);
assert.equal(parseOpenLiga({...german,matchIsFinished:true},now),null);
assert.equal(parseOpenLiga({...german,matchDateTimeUTC:'2026-11-08T20:30:00Z'},now),null);
const other={idEvent:'5432',strSport:'Soccer',strHomeTeam:'Home FC',strAwayTeam:'Away FC',
 strLeague:'Test League',strTimestamp:'2026-11-11T19:00:00Z'};
assert.equal(parseSportsDB(other,now)?.quote_status,'NOT_AVAILABLE');
assert.equal(parseSportsDB({...other,strTimestamp:null},now),null,'No timezone guesses');
assert.equal(parseSportsDB({...other,strSport:'Basketball'},now),null);
let hits=[];
const fetcher=async url=>{
 hits.push(url);
 if(url.includes('openligadb'))return {ok:true,json:async()=>[german]};
 if(url.includes('eventsday'))return {ok:true,json:async()=>({events:[other]})};
 throw Error('Unexpected source');
};
const data=await collectComplementarySources({now,fetcher});
assert.equal(hits.length,4,'Respect low volume');
assert.equal(data.items.length,4,'Two leagues + two dates in mocked source');
assert.equal(data.status.openligadb.ok,2);
assert.equal(data.status.thesportsdb.ok,2);
assert(data.items.every(x=>x.odds===null),'Never invent live prices');
console.log('OK: two complementary free sources, bounded requests and strict fixture validation.');
