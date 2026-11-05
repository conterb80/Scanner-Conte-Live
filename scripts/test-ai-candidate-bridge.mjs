import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../assets/ai-candidate-bridge.js',import.meta.url),'utf8');
const ctx={window:{},URL,Date,Intl,Number,String,Math,Array,Object};
vm.runInNewContext(code,ctx);
const evaluate=ctx.window.ScannerAICandidateBridge.evaluate;
const candidate={id:'tipsaudit-123:TIPSAUDIT_VALUE_1X2',match:'Roma - Bologna',kickoff:'2026-11-07T17:00:00Z',captured_at:'2026-11-07T10:00:00Z'};
const now=Date.parse('2026-11-07T12:00:00Z');
const report={schema:'scanner-conte-ai-integration-v1',generated_at:'2026-11-07T11:00:00Z',input:{items:[{match:'Roma - Bologna',captured_at:candidate.captured_at}]},evidence:{status:'WEB_SEARCH_CONFIRMED',text:'Ricerche di calendario'}};
const copy=r=>({payload:{schema:'scanner-conte-app-bridge-v1',report:r},last_contact:r.generated_at});
test('rapporto generico: partita citata ma mai conferma IA',()=>{
 assert.equal(evaluate(candidate,copy(report),now).code,'mentioned');
 assert.equal(evaluate(candidate,null,now).code,'missing');
});
test('rapporto precedente alla cattura non vale',()=>{
 assert.equal(evaluate(candidate,copy({...report,generated_at:'2026-11-07T09:00:00Z'}),now).code,'stale');
});
test('rapporto di ieri o scaduto, oppure altro incontro',()=>{
 assert.equal(evaluate(candidate,copy({...report,generated_at:'2026-11-06T23:00:00Z'}),now).code,'stale');
 assert.equal(evaluate(candidate,copy(report),now+7*3600000).code,'stale');
 assert.equal(evaluate(candidate,copy({...report,input:{items:[{match:'Lazio - Inter'}]}}),now).code,'not-covered');
});
test('valutazione strutturata completa e fonti HTTPS',()=>{
 const r={...report,candidate_assessments:[{candidate_id:candidate.id,match:'Roma – Bologna',kickoff:candidate.kickoff,
 checked_at:'2026-11-07T10:50:00Z',verdict:'CAUTION',summary:'Una indisponibilità va verificata.',sources:[{url:'https://example.org/match'},'javascript:alert(1)']}]};
 const x=evaluate(candidate,copy(r),now);
 assert.equal(x.code,'specific');assert.equal(x.verdict,'CAUTION');assert.equal(x.sources.length,1);
 assert.equal(x.sources[0],'https://example.org/match');
});
test('verdetto senza fonti non è verifica completa; nome incongruente non fa match',()=>{
 const r={...report,candidate_assessments:[{candidate_id:candidate.id,match:candidate.match,checked_at:'2026-11-07T10:50:00Z',verdict:'SUPPORT',summary:'Sembra buona',sources:[]}]};
 assert.equal(evaluate(candidate,copy(r),now).code,'partial');
 r.candidate_assessments[0].match='Roma - Juventus';
 assert.equal(evaluate(candidate,copy(r),now).code,'mentioned');
});
