import assert from 'node:assert/strict';
import {buildWeeklySummary} from './build-weekly-lab-summary.mjs';
const daily={records:[
 {kickoff:'2026-11-02T19:00:00Z',strategy:'TIPSAUDIT_VALUE_1X2',market:'1X2',odds:1.8,status:'won',pnl:.8,stake_virtual:1,match:'NON PUBBLICARE'},
 {kickoff:'2026-11-03T19:00:00Z',strategy:'TIPSAUDIT_VALUE_1X2',market:'1X2',odds:1.8,status:'pending',pnl:null,stake_virtual:1}
],checks:[{day:'2026-11-02',scanned_predictions:17,created:2}]};
const auto={records:[{kickoff:'2026-11-02T20:00:00Z',strategy:'OVER25_CONTROLLO',
 odds:2,status:'lost',pnl:-1,stake_virtual:1,match:'NON PUBBLICARE'}]};
const x=buildWeeklySummary(daily,auto,'2026-11-02T12:00:00Z');
assert.equal(x.weeks.length,2);
const a=x.weeks.find(x=>x.lab==='auto'),d=x.weeks.find(x=>x.lab==='daily');
assert.equal(a.by_market[0].name,'OVER_2_5');
assert.equal(a.pnl,-1);
assert.equal(d.pending,1);
assert.equal(d.settled,1);
assert.equal(d.roi_pct,80);
assert.equal(d.scan_checks,1);
assert.equal(d.week_start,'2026-11-02');
assert.equal(JSON.stringify(x).includes('NON PUBBLICARE'),false);
assert.throws(()=>buildWeeklySummary({records:[]},auto));
console.log('Riepilogo settimanale: test OK, nessun nome partita nel file.');
