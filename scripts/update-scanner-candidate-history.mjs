import {readFile,writeFile} from 'node:fs/promises';
const path='data/scanner_candidate_history.json';
const history=JSON.parse(await readFile(path,'utf8'));
const review=JSON.parse(await readFile('data/candidate_review.json','utf8'));
const lab=JSON.parse(await readFile('data/daily_virtual_lab.json','utf8'));
if(history.schema!=='scanner-conte-candidate-history-v1'||!Array.isArray(history.snapshots))throw Error('Archivio non valido');
if(review.schema!=='scanner-conte-candidate-review-v1'||!Array.isArray(lab.records))throw Error('Dati sorgente non validi');
const day=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
if(!history.snapshots.some(x=>x.generated_at===review.generated_at)){
 const rows=[...(review.shortlist||[]).map((r,i)=>({r,place:'PRINCIPALE',rank:i+1})),...(review.alternatives||[]).map((r,i)=>({r,place:'ALTERNATIVA',rank:i+1}))];
 const observations=rows.filter(({r})=>r.id&&Date.parse(r.kickoff)>Date.parse(review.generated_at)+900000&&day(r.kickoff)===day(review.generated_at)).map(({r,place,rank})=>({id:r.id,match:r.match,league:r.league,kickoff:r.kickoff,market:r.market,selection:r.selection,category:r.category,place,rank,reference_odds:r.reference_odds,reference_bookmaker:r.reference_bookmaker,external_fair_odds:r.external_fair_odds,relative_screening_score:r.relative_screening_score,captured_at:r.captured_at,reference_link:r.reference_link}));
 history.snapshots.push({generated_at:review.generated_at,scope_day:review.scope_day||day(review.generated_at),status:review.status,source_commit:null,observations});
}
history.snapshots.sort((a,b)=>Date.parse(a.generated_at)-Date.parse(b.generated_at));
const byId=new Map(),labById=new Map(lab.records.map(r=>[r.id,r]));
for(const snapshot of history.snapshots)for(const item of snapshot.observations||[]){
 if(!item.id||!item.match||Date.parse(item.kickoff)<=Date.parse(snapshot.generated_at)+900000)continue;
 const key=item.id+'|'+item.market+'|'+item.selection;
 if(!byId.has(key))byId.set(key,{id:item.id,match:item.match,league:item.league,day:day(item.kickoff),kickoff:item.kickoff,market:item.market,selection:item.selection,category:item.category,first_seen:snapshot.generated_at,last_seen:snapshot.generated_at,first_place:item.place,ever_primary:item.place==='PRINCIPALE',first_odds:item.reference_odds,first_bookmaker:item.reference_bookmaker,appearances:0});
 const r=byId.get(key);r.last_seen=snapshot.generated_at;r.appearances++;if(item.place==='PRINCIPALE')r.ever_primary=true;
}
const stats={total:byId.size,primary:0,alternatives_only:0,won:0,lost:0,pending:0,unmatched:0,virtual_pnl:0,settled:0};
for(const r of byId.values()){
 r.ever_primary?stats.primary++:stats.alternatives_only++;
 const paper=labById.get(r.id);
 const match=paper&&paper.match===r.match&&paper.market===r.market&&paper.selection===r.selection&&Date.parse(paper.kickoff)===Date.parse(r.kickoff);
 const status=match&&['won','lost','pending'].includes(paper.status)?paper.status:'unmatched';
 r.result_status=status;
 r.result_source=match&&['won','lost'].includes(status)?
  (paper.settlement_source||'TipsAudit LAB, risultato non verificato indipendentemente'):
  'Esito non ancora verificato';
 r.result_verified_independently=Boolean(match&&['won','lost'].includes(status)&&paper.independent_ft_verification===true);
 r.result_recorded_at=match?paper.settled_at||null:null;
 r.virtual_pnl=status==='won'?Math.round((r.first_odds-1)*100)/100:status==='lost'?-1:null;
 stats[status]++;
 if(r.virtual_pnl!==null){stats.settled++;stats.virtual_pnl+=r.virtual_pnl;}
}
stats.virtual_pnl=Math.round(stats.virtual_pnl*100)/100;
stats.virtual_roi=stats.settled?Math.round(10000*stats.virtual_pnl/stats.settled)/100:null;
history.records=[...byId.values()].sort((a,b)=>Date.parse(a.first_seen)-Date.parse(b.first_seen));
history.stats=stats;
history.last_snapshot_at=history.snapshots.at(-1)?.generated_at||null;
history.last_result_check_at=lab.last_settlement_check||null;
history.result_note='Fonte e verifica indipendente riportate per ciascun esito quando disponibili. Le quote sono riferimenti, non Bet365 live. Nessun dato REAL del telefono.';
await writeFile(path,JSON.stringify(history,null,2)+'\n');
console.log('Scanner candidate archiviate:',history.snapshots.length,'rapporti,',stats.total,'proposte distinte;',stats.settled,'esiti chiusi dalla fonte.');
