/** Regression checks for experimental candidate screening, no live requests or REAL actions. */
import assert from 'node:assert/strict';
import {buildCandidateReview} from './build-candidate-review.mjs';
const now='2026-11-01T10:00:00.000Z';
const row={
 id:'test-observation-1',match:'Home FC - Away FC',league:'Test League',
 kickoff:'2026-11-01T13:00:00.000Z',status:'pending',
 market:'1X2',selection:'Home',odds:1.72,fair_odds:1.63,
 bookmaker:'Example source',reference:'https://tipsaudit.com/match/example',
 captured_at:'2026-11-01T09:00:00.000Z',benchmark_read_at:'2026-11-01T08:30:00.000Z'
};
const lab={schema:'scanner-conte-daily-virtual-v1',last_check:'2026-11-01T09:00:00.000Z',records:[row]};
const out=buildCandidateReview(lab,now);
assert.equal(out.status,'PRELIMINARY_CANDIDATES');
assert.equal(out.shortlist.length,1);
assert.equal(out.shortlist[0].category,'CORE');
assert.equal(out.shortlist[0].kind,'EXPERIMENTAL_OBSERVATION_NOT_REAL');
assert.equal(out.no_real_bets_registered,true);
assert.equal(out.no_real_bets_placed,true);
assert.equal(out.shortlist[0].source_is_independent_model,false);
const stale=buildCandidateReview({...lab,last_check:'2026-10-27T09:00:00.000Z'},now);
assert.equal(stale.shortlist.length,0);
assert.equal(stale.status,'SOURCE_STALE');
assert.equal(buildCandidateReview({...lab,records:[{...row,kickoff:'2026-11-01T09:00:00.000Z'}]},now).shortlist.length,0);
assert.equal(buildCandidateReview({...lab,records:[{...row,captured_at:'2026-11-01T13:10:00.000Z'}]},now).shortlist.length,0);
assert.equal(buildCandidateReview({...lab,records:[{...row,odds:1.50}]},now).shortlist.length,0);
assert.equal(buildCandidateReview({...lab,records:[row,{...row,id:'test-observation-2'}]},now).shortlist.length,1);
assert.equal(buildCandidateReview({...lab,records:[]},now).shortlist.length,0);
// Anche nei feriali devono apparire candidate LAB, ma mai l'invito a registrare REAL.
const mondayNow='2026-11-02T10:00:00.000Z';
const mondayRow={...row,kickoff:'2026-11-02T13:00:00.000Z',
 captured_at:'2026-11-02T09:00:00.000Z',benchmark_read_at:'2026-11-02T08:30:00.000Z'};
const mondayLab={...lab,last_check:'2026-11-02T09:00:00.000Z',records:[mondayRow]};
const monday=buildCandidateReview(mondayLab,mondayNow);
assert.equal(monday.shortlist.length,1);
assert.equal(monday.allow_manual_real_registration_today,false);
assert.equal(out.allow_manual_real_registration_today,true);
assert.equal(buildCandidateReview({...mondayLab,records:[{...mondayRow,kickoff:'2026-11-03T13:00:00.000Z'}]},mondayNow).shortlist.length,0);
assert.equal(buildCandidateReview({...mondayLab,records:[{...mondayRow,
 captured_at:'2026-11-01T09:00:00.000Z',benchmark_read_at:'2026-11-01T08:30:00.000Z'}]},mondayNow).shortlist.length,0);
assert.equal(buildCandidateReview({...mondayLab,last_check:'2026-11-01T20:00:00.000Z'},mondayNow).status,'SOURCE_STALE');
console.log('Candidate screening regression checks passed.');
