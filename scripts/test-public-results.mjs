import assert from 'node:assert/strict';
import { normalizeESPN, mergeResults } from './collect-public-results.mjs';

const league={code:'ger.1',name:'Bundesliga'};
const match=(type,score1,score2)=>({
 id:'20261101-125',date:'2026-11-01T16:30:00Z',
 status:{type},
 competitions:[{competitors:[
  {homeAway:'home',team:{displayName:'Eintracht Frankfurt'},score:score1},
  {homeAway:'away',team:{displayName:'Hamburg SV'},score:score2}
 ]}]
});
const final=normalizeESPN(match({completed:true,name:'STATUS_FINAL'},'3','1'),league);
assert.equal(final.status,'FT');
assert.equal(final.home_goals,3);
assert.equal(final.away_goals,1);
assert.equal(normalizeESPN(match({completed:false,name:'STATUS_IN_PROGRESS'},'0','0'),league),null);
assert.equal(normalizeESPN(match({completed:true,name:'STATUS_FINAL'},null,'0'),league),null);
const postponed=normalizeESPN(match({completed:false,name:'STATUS_POSTPONED'},null,null),league);
assert.equal(postponed.status,'PST');
assert.equal(postponed.home_goals,null);
assert.equal(postponed.away_goals,null);
const official={
 id:'official-ger1-20261101-eintracht-hamburger',kickoff:'2026-11-01T16:30:00Z',
 status:'FT',home:'Eintracht Frankfurt',away:'Hamburger SV',home_goals:3,away_goals:1,
 league_code:'ger.1',verification:'official'
};
const out=mergeResults({schema:'scanner-conte-results-public-v1',fixtures:[official]},[
 {...final,home_goals:0,away_goals:5}
],new Date('2026-11-02T05:00:00Z'));
assert.equal(out.length,1,'Team aliases must prevent duplicate fixture results');
assert.equal(out[0].id,official.id,'Official verification must take priority');
assert.equal(out[0].home_goals,3);
const separate={...postponed,id:'espn-esp.2-456',league_code:'esp.2',home:'Tenerife',away:'FC Andorra',kickoff:'2026-11-01T20:00:00Z'};
const out2=mergeResults({schema:'scanner-conte-results-public-v1',fixtures:[official]},[separate],new Date('2026-11-02T05:00:00Z'));
assert.equal(out2.length,2);
assert.equal(out2[1].status,'PST','Postponed matches must never be marked won/lost');
console.log('OK public results: official priority, alias merge, strict FT, postponed unchanged');
