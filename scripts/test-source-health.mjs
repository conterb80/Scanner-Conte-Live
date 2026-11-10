import assert from 'node:assert/strict';
import {evaluateSourceHealth} from './check-source-health.mjs';
const now=new Date('2026-11-10T16:00:00Z');
const sources={radar:{generated_at:'2026-11-10T15:00:00Z',stats:{matches:0},source_status:{
 espn_requests_ok:36,espn_requests_failed:0,additional_sources:{openligadb:{ok:2,fixtures:0},thesportsdb:{ok:2,fixtures:0}}}},
 daily:{last_check:'2026-11-10T15:00:00Z',checks:[{checked_at:'2026-11-10T15:00:00Z',scanned_predictions:0,eligible_actionable:0}]},
 results:{checked_at:'2026-11-10T14:00:00Z'},
 footballData:{updated_at:'2026-11-10T12:00:00Z'}};
const out=evaluateSourceHealth(sources,now);
assert.equal(out.calendar.state,'NO_MATCHES','Zero matches must not be flagged as offline');
assert.equal(out.quotes.state,'NO_MATCHES_FROM_SOURCE','No matches in quote feed is not a failure');
assert.equal(out.status,'PARZIALE');
assert.equal(out.ia_local.state,'NON_VERIFICABILE_DA_GITHUB');
assert.equal(evaluateSourceHealth({...sources,radar:{...sources.radar,generated_at:'2026-11-08T12:00:00Z'}},now).status,'ATTENZIONE');
assert.equal(evaluateSourceHealth({...sources,daily:{...sources.daily,
 checks:[{checked_at:'2026-11-10T15:00:00Z',scanned_predictions:15,eligible_actionable:0}]}},now).quotes.state,'NO_ELIGIBLE_PRICES');
console.log('OK: source health distinguishes outages from no-event and no-quote scans.');
