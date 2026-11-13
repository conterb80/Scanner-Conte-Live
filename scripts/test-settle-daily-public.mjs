import assert from 'node:assert/strict';
import {settleWithPublicResult,settleArchive} from './settle-daily-public.mjs';
import {readFileSync} from 'node:fs';
const now=new Date('2026-11-13T20:00:00Z');
const original={id:'test-1',status:'pending',market:'1X2',match:'Armenia - Cyprus',
 league:'UEFA Nations League',kickoff:'2026-11-12T17:00:00Z',
 captured_at:'2026-11-12T15:17:15Z',selection:'Away',odds:2.7,stake_virtual:1};
const fixture={id:'espn-1',status:'FT',verification:'espn_scoreboard',league_code:'uefa.nations',
 kickoff:'2026-11-12T17:00:00Z',home:'Armenia',away:'Cyprus',home_goals:1,away_goals:1,
 source:'ESPN public scoreboard',source_url:'https://www.espn.com/soccer/match/_/gameId/123'};
const res=settleWithPublicResult(original,[fixture],now);
assert.equal(res.status,'lost');assert.equal(res.pnl,-1);assert.equal(res.score,'1-1');
assert.equal(res.independent_ft_verification,true);
assert.equal(settleWithPublicResult({...original,status:'won'},[fixture],now),null,'Never overwrite settled');
assert.equal(settleWithPublicResult({...original,result_review_status:'POSTPONED_REPLAYED'},[fixture],now),null,'Rescheduled safe');
assert.equal(settleWithPublicResult({...original,match:'Armenia - Estonia'},[fixture],now),null,'Wrong opponent');
assert.equal(settleWithPublicResult({...original,league:'Serie A'},[fixture],now),null,'Wrong league');
assert.equal(settleWithPublicResult({...original,kickoff:'2026-11-11T17:00:00Z'},[fixture],now),null,'Wrong date');
assert.equal(settleWithPublicResult({...original,captured_at:'2026-11-12T16:45:00Z'},[fixture],now),null,'Observation too late');
assert.equal(settleWithPublicResult(original,[fixture,{...fixture,id:'duplicate'}],now),null,'Ambiguous results not closed');
assert.equal(settleWithPublicResult({...original,kickoff:'2026-11-13T19:45:00Z'},[fixture],now),null,'No FT of future match');
const data=JSON.parse(readFileSync('data/daily_virtual_lab.json','utf8'));
const feed=JSON.parse(readFileSync('data/results_public.json','utf8'));
const copy=structuredClone(data);
const toClose=settleArchive(copy,feed,now);
const actual=copy.records.find(r=>r.match==='Armenia - Cyprus');
assert.equal(actual.status,'lost');assert.equal(actual.score,'1-1');
assert.equal(toClose,1,'Exactly one currently due and verified fixture should close');
assert.equal(copy.records.find(r=>r.match==='Tenerife - FC Andorra').status,'pending','Rescheduled fixture remains under review');
assert.equal(data.records.find(r=>r.match==='Armenia - Cyprus').status,'pending','Original fixture file untouched by test');
console.log('OK: independent FT settlement, one safe test closed, postponed and real data unchanged.');
