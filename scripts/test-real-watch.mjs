import assert from 'node:assert/strict';
import {buildRealWatch} from './build-real-watch.mjs';
const now='2026-11-08T09:30:00.000Z',kickoff='2026-11-08T14:00:00.000Z';
const base={schema:'scanner-conte-real-watch-history-v1',version:1,records:[],stats:{}};
function sample(id,match){
 return{id,match,league:'Example league',kickoff,market:'1X2',selection:'Home',status:'pending',
  odds:1.8,fair_odds:1.68,bookmaker:'External test',reference:'https://tipsaudit.com/example',
  captured_at:'2026-11-08T08:30:00.000Z',benchmark_read_at:'2026-11-08T08:20:00.000Z'};
}
const lab={schema:'scanner-conte-daily-virtual-v1',last_check:'2026-11-08T08:30:00.000Z',records:[
 sample('a','Alpha - Beta'),sample('b','Gamma - Delta'),sample('c','Foo - Bar'),sample('d','Ace - Dog')]};
let {watch,history}=buildRealWatch(lab,structuredClone(base),now);
assert.equal(watch.shortlist.length,2);
assert.equal(watch.alternatives.length,2);
assert.equal(watch.stats.main,2);
assert.equal(watch.stats.settled,0);
assert.equal(watch.xg_model_available,false);
assert.equal(watch.bet365_quotes_available,false);
assert.equal(watch.no_real_bets_placed,true);
const first=watch.shortlist.map(r=>r.id);
({watch,history}=buildRealWatch(lab,history,'2026-11-08T09:40:00.000Z'));
assert.equal(history.records.length,4);
assert.deepEqual(watch.shortlist.map(r=>r.id),first);
lab.records[0].status='won';lab.records[0].settled_at='2026-11-08T17:10:00.000Z';
lab.records[1].status='lost';lab.records[1].settled_at='2026-11-08T17:10:00.000Z';
({watch,history}=buildRealWatch(lab,history,'2026-11-08T18:00:00.000Z'));
assert.equal(watch.stats.settled,2);
assert.equal(watch.stats.won,1);
assert.equal(watch.stats.lost,1);
assert.equal(watch.stats.theoretical_pnl,-.2);
assert.equal(watch.stats.theoretical_stake,2);
assert.equal(history.records.length,4);
// Una verifica ESPN arriva dopo la chiusura: correggere SOLO la fonte.
const frozenLoss=history.records.find(r=>r.source_id==='b');
const frozenPnl=frozenLoss.virtual_pnl;
lab.records[1].independent_ft_verification=true;
lab.records[1].settlement_source='ESPN public scoreboard';
lab.records[1].settlement_reference='https://www.espn.com/soccer/match/_/gameId/123';
({watch,history}=buildRealWatch(lab,history,'2026-11-08T18:20:00.000Z'));
const reconciled=history.records.find(r=>r.source_id==='b');
assert.equal(reconciled.result_status,'lost');
assert.equal(reconciled.virtual_pnl,frozenPnl,'Never rewrite historical theoretical P/L');
assert.equal(reconciled.result_source,'ESPN public scoreboard');
assert.equal(reconciled.result_verified_independently,true);
assert.equal(watch.stats.independently_verified_settled,1);
const invalid=structuredClone(base);
const tomorrow=buildRealWatch(lab,invalid,'2026-11-09T09:30:00.000Z');
assert.equal(tomorrow.watch.shortlist.length,0);
assert.equal(tomorrow.history.records.length,0);
const stale=buildRealWatch({...lab,last_check:'2026-10-30T08:00:00Z'},structuredClone(base),now);
assert.equal(stale.watch.status,'SOURCE_STALE');
assert.equal(stale.watch.shortlist.length,0);
assert.equal(buildRealWatch({...lab,records:[{...sample('x','T - Z'),captured_at:'2026-11-08T15:00:00Z'}]},structuredClone(base),now).watch.shortlist.length,0);
console.log('REAL watch tests passed: independent bookkeeping, frozen picks, no backfill, settlement.');
