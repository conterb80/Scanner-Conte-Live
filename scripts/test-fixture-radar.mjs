import assert from 'node:assert/strict';
import {parseEvent,makeRadar} from './collect-fixture-radar.mjs';
const now=new Date('2026-11-10T12:00:00.000Z');
const game=(date,id,status={type:{name:'STATUS_SCHEDULED',completed:false}})=>({
 id,date,status,competitions:[{competitors:[
  {homeAway:'home',team:{displayName:'Home FC'}},{homeAway:'away',team:{displayName:'Away FC'}}]}]});
const league=['eng.trophy','EFL Trophy'];
const good=parseEvent(game('2026-11-10T19:00:00Z','123'),league,now);
assert.equal(good.match,'Home FC – Away FC');
assert.equal(good.odds,null);
assert.equal(good.quote_status,'NOT_AVAILABLE');
assert.equal(parseEvent(game('2026-11-10T11:00:00Z','4'),league,now),null,'No retrospective scans');
assert.equal(parseEvent(game('2026-11-10T19:00:00Z','5',{type:{name:'STATUS_FINAL',completed:true}}),league,now),null,'No finished events');
assert.equal(parseEvent(game('2026-11-10T19:00:00Z','6',{type:{name:'STATUS_POSTPONED'}}),league,now),null,'Postponements excluded');
const mockFD={id:'fd-1',home:'Home FC',away:'Away FC',match:'Home FC – Away FC',kickoff:good.kickoff,
 league:'EFL Trophy',source:'Football-Data CSV',quote_status:'HISTORICAL_SNAPSHOT_NOT_LIVE',odds:{'1':1.9}};
const feed=makeRadar([good],[mockFD],now,{ok:12,failed:0,fdAt:now.toISOString()});
assert.equal(feed.fixtures.length,1);
assert.equal(feed.fixtures[0].quote_status,'HISTORICAL_SNAPSHOT_NOT_LIVE');
assert.equal(feed.auto_bets,false);
assert.equal(feed.auto_predictions,false);
assert.equal(feed.stats.with_historical_snapshot,1);
console.log('OK: 72h radar parses future fixtures, excludes FT/PST/past and never invents bets or live odds.');
