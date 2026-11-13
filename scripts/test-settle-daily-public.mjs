import assert from 'node:assert/strict';
import {settleWithPublicResult,settleArchive} from './settle-daily-public.mjs';
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
const data={schema:'scanner-conte-daily-virtual-v1',records:[
 {...original},
 {...original,id:'rescheduled',match:'Tenerife - FC Andorra',
  result_review_status:'POSTPONED_REPLAYED',kickoff:'2026-11-01T20:00:00Z'}
]};
const feed={schema:'scanner-conte-results-public-v1',fixtures:[fixture]};
const copy=structuredClone(data);
const toClose=settleArchive(copy,feed,now);
assert.equal(toClose,1,'Exactly one independent test should settle');
assert.equal(copy.records[0].status,'lost');assert.equal(copy.records[0].score,'1-1');
assert.equal(copy.records[1].status,'pending','Rescheduled fixture must remain pending');
assert.equal(settleArchive(copy,feed,now),0,'Idempotent future checks');
assert.equal(data.records[0].status,'pending','Original input not mutated by isolated test');
console.log('OK: independent FT settlement is repeatable, exact and safe for postponed fixtures.');
