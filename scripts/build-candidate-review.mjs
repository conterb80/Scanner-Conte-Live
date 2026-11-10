/**
 * Scanner Conte LIVE — experimental weekend candidate screening v1.
 * Operates only on already archived pre-match paper observations.
 * TipsAudit fair odds are an EXTERNAL benchmark, NOT a validated internal model.
 * Does not place/register real-world bets.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {isSameRomeDay,romeDay} from './daily-window.mjs';
const TZ='Europe/Rome';
const round=(x,n=2)=>Math.round((x+Number.EPSILON)*10**n)/10**n;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const ms=x=>Date.parse(x||'');
const day=x=>new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short'}).format(new Date(x));
const weekend=x=>['Sat','Sun'].includes(day(x));
const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function historicalFor(group,records){
 const subset=records.filter(r=>['won','lost'].includes(r.status)&&finite(r.odds)&&
   (group==='CORE'?r.odds>=1.4&&r.odds<1.95:r.odds>=1.95&&r.odds<=3.5));
 const stake=subset.reduce((n,r)=>n+(finite(r.stake_virtual)?r.stake_virtual:1),0);
 const pnl=subset.reduce((n,r)=>n+(finite(r.pnl)?r.pnl:0),0);
 return{settled:subset.length,observed_roi_pct:stake?round(100*pnl/stake,1):null,
   reliable_edge_validation:false,meaning:'Retrospettiva descrittiva di un campione ancora piccolo, non previsione.'};
}
function rowCandidate(r,now,records){
 const kickoff=ms(r.kickoff),captured=ms(r.captured_at),bench=ms(r.benchmark_read_at);
 if(r.status!=='pending'||!Number.isFinite(kickoff)||!Number.isFinite(captured)||
  !Number.isFinite(bench)||!isSameRomeDay(r.kickoff,now)||!isSameRomeDay(r.captured_at,now)||kickoff<=now+3600000||
  captured>=kickoff||captured>now+120000||now-captured>36*3600000||
  bench>captured+120000||captured-bench>90*60000)return null;
 if(r.market!=='1X2'||!['Home','Draw','Away'].includes(r.selection)||
  !finite(r.odds)||!finite(r.fair_odds)||r.odds<1.4||r.odds>3.5||
  r.fair_odds<1.2||r.fair_odds>=r.odds||!r.match||!r.bookmaker||
  typeof r.reference!=='string'||!r.reference.startsWith('https://tipsaudit.com/'))return null;
 const gap=r.odds/r.fair_odds-1;
 const group=r.odds<1.95?'CORE':'VALUE';
 if(gap<(group==='CORE'?0.015:0.025)||gap>0.2)return null;
 const quoteAgeHours=(now-captured)/3600000;
 const score=round(100*(0.65*clamp(gap/.08,0,1)+0.20*(1-clamp(quoteAgeHours/36,0,1))+
   .15*(group==='CORE'?1-clamp((r.odds-1.4)/.55,0,1):1-clamp((r.odds-1.95)/1.55,0,1))),0);
 return{
  id:String(r.id),kind:'EXPERIMENTAL_OBSERVATION_NOT_REAL',
  match:r.match,league:r.league||'',kickoff:r.kickoff,market:'1X2',selection:r.selection,
  category:group,reference_odds:r.odds,reference_bookmaker:r.bookmaker,
  external_fair_odds:r.fair_odds,external_benchmark_probability_pct:round(100/r.fair_odds,1),
  external_reference_gap_pct:round(100*gap,2),relative_screening_score:score,
  captured_at:r.captured_at,reference_link:r.reference,source:'TipsAudit public pre-match paper signals',
  source_is_independent_model:false,
  why:[
   'Quota osservata '+r.odds+' contro quota equa '+r.fair_odds+' stimata dalla fonte esterna (+ '+round(100*gap,1)+'% di scostamento).',
   'Dato osservato da '+r.bookmaker+' e registrato prima della partita.',
   'Non sono stati ancora verificati qui forma, formazioni, assenze e quota Bet365 corrente.'
  ],
  cautions:[
   'CORE/VALUE identifica solo una fascia di quota, non un rischio dimostrato.',
   'Punteggio '+score+' = ordinamento tecnico delle osservazioni, non probabilità di vincita.',
   'Il valore equo deriva dalla stessa fonte della quota: nessun vantaggio indipendente confermato.'
  ],
  historical:historicalFor(group,records)
 };
}
export function buildCandidateReview(lab,nowISO){
 if(lab?.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(lab.records))throw Error('Archivio LAB non valido');
 const now=ms(nowISO),last=ms(lab.last_check);
 if(!Number.isFinite(now))throw Error('Data scansione non valida');
 const sourceFresh=Number.isFinite(last)&&last<=now+120000&&now-last<=36*3600000&&isSameRomeDay(last,now);
 const raw=sourceFresh?lab.records.map(r=>rowCandidate({...r,...(r.latest_observation||{})},now,lab.records)).filter(Boolean):[];
 const unique=new Map();
 for(const r of raw){const key=normalize(r.match)+'|'+String(r.kickoff).slice(0,10);
  if(!unique.has(key)||unique.get(key).relative_screening_score<r.relative_screening_score)unique.set(key,r);}
 const sorted=[...unique.values()].sort((a,b)=>b.relative_screening_score-a.relative_screening_score||
   ms(a.kickoff)-ms(b.kickoff)||a.id.localeCompare(b.id));
 const core=sorted.filter(r=>r.category==='CORE'),value=sorted.filter(r=>r.category==='VALUE');
 const shortlist=[core[0],value[0]].filter(Boolean).sort((a,b)=>ms(a.kickoff)-ms(b.kickoff));
 const keep=new Set(shortlist.map(r=>r.id));
 const settled=lab.records.filter(r=>['won','lost'].includes(r.status));
 const staked=settled.reduce((n,r)=>n+(finite(r.stake_virtual)?r.stake_virtual:1),0);
 const pnl=settled.reduce((n,r)=>n+(finite(r.pnl)?r.pnl:0),0);
 const lastDayCheck=Array.isArray(lab.checks)?lab.checks.filter(x=>x.day===romeDay(nowISO)).slice(-1)[0]:null;
 return{
  schema:'scanner-conte-candidate-review-v1',version:1,generated_at:nowISO,
  status:!sourceFresh?'SOURCE_STALE':shortlist.length?'PRELIMINARY_CANDIDATES':'NO_ELIGIBLE_OBSERVATIONS',
  source_last_check:lab.last_check||null,source_max_age_hours:36,
  scope:'Solo partite della giornata corrente Europe/Rome, con osservazioni registrate oggi.',
  scope_day:romeDay(nowISO),
  allow_manual_real_registration_today:weekend(nowISO),
  market_coverage:['1X2'],other_markets_supported:false,
  mode:'READ_ONLY_PAPER_SCREENING',no_real_bets_placed:true,no_real_bets_registered:true,
  methodology:'Filtro quantitativo predefinito di segnali esterni già acquisiti: divario quota/equo fonte, freschezza, fascia di quota. Non verifica forma, assenze o formazioni.',
  disclaimer:'Candidate sperimentali, non raccomandazioni con vantaggio dimostrato o quote Bet365 correnti.',
  scan_stats:{paper_records:lab.records.length,scanned_today:lastDayCheck?.scanned_predictions??null,
    leagues_today:lastDayCheck?.scanned_league_total??null,
    last_scan_completed_at:lastDayCheck?.checked_at??null,eligible_observations:sorted.length,
    eligible_core:core.length,eligible_value:value.length,
    settled_paper_samples:settled.length,settled_paper_roi_pct:staked?round(100*pnl/staked,1):null},
  shortlist,alternatives:sorted.filter(r=>!keep.has(r.id)).slice(0,8)
 };
}
async function main(){
 const lab=JSON.parse(await readFile('data/daily_virtual_lab.json','utf8'));
 const output=buildCandidateReview(lab,new Date().toISOString());
 await writeFile('data/candidate_review.json',JSON.stringify(output,null,2)+'\n');
 console.log('CANDIDATE REVIEW '+JSON.stringify({at:output.generated_at,status:output.status,shortlist:output.shortlist.length,
  eligible:output.scan_stats.eligible_observations,source:output.source_last_check}));
}
if(process.argv[1]&&process.argv[1].endsWith('build-candidate-review.mjs'))
 main().catch(e=>{console.error(e.message);process.exitCode=1;});

