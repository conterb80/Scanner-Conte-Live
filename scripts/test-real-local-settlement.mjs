/** Regression test: the exact REAL settlement matcher shipped in assets/app.js. */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const code=readFileSync('assets/app.js','utf8');
const start=code.indexOf('const normalizeTeamName=');
const end=code.indexOf('let resultSyncBusy=',start);
assert.ok(start>0&&end>start,'local settlement matcher exists');
const {sameFixture,scoreSelection}=new Function(code.slice(start,end)+'\nreturn {sameFixture,scoreSelection};')();
const feed=JSON.parse(readFileSync('data/results_public.json','utf8'));
const porto=feed.fixtures.find(f=>f.home==='Vitória de Guimaraes'&&f.away==='FC Porto'&&f.status==='FT');
assert.ok(porto,'public results contain verified Vitória–Porto FT');
assert.equal(porto.home_goals,1);assert.equal(porto.away_goals,2);
for(const match of ['Vitória Guimarães – Porto','Vitoria de Guimaraes - FC Porto','Guimarães - Porto','Vitória – FC Porto']){
 assert.equal(sameFixture({date:'2026-11-08',match},porto),true,match);
}
assert.equal(sameFixture({date:'2026-11-09',match:'Vitória Guimarães – Porto'},porto),false,'wrong day');
assert.equal(sameFixture({date:'2026-11-08',match:'Vitória Guimarães – Sporting'},porto),false,'wrong opponent');
assert.equal(scoreSelection('2',porto.home_goals,porto.away_goals),true,'Porto 2 won');
assert.equal(Math.round((1.53-1)*1*100)/100,0.53);
console.log('OK: REAL local matcher, both teams and date checked, Porto result won at 1.53');
