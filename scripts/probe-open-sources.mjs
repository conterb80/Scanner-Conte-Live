/**
 * Scanner Conte LIVE — verifica indipendente fonti pubbliche, SOLO DIAGNOSTICA.
 * Nessuna API key. Nessuna scommessa virtuale creata. Nessun accesso allo storico REAL.
 * 1 richiesta al giorno per fonte; scadenza prova: 02/11/2026.
 * Fonte quote: https://tipsaudit.com/api (attribuzione obbligatoria).
 * Calendario/risultati: https://github.com/oladeeayo/open-matchday
 */
import {readFile,writeFile} from 'node:fs/promises';
const TARGET='data/source_probe.json';
const END_DATE='2026-11-02';
const TZ='Europe/Rome';
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const finitePrice=p=>Number.isFinite(Number(p))&&Number(p)>=1.01&&Number(p)<=100;
const dateMs=s=>{const d=Date.parse(s||'');return Number.isFinite(d)?d:null;};
async function getJSON(url){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'ScannerConteLIVE-Feasibility/1.0 (personal project, once daily)'},signal:controller.signal});
  if(!r.ok)throw Error('HTTP '+r.status);
  const value=await r.json();
  if(!value||typeof value!=='object')throw Error('JSON non valido');
  return value;
 }finally{clearTimeout(timer);}
}
async function main(){
 const today=day();
 if(today>END_DATE){console.log('Prova terminata: nessuna richiesta esterna.');return;}
 try{
  const previous=JSON.parse(await readFile(TARGET,'utf8'));
  if(previous.day===today){console.log('Gia verificato oggi, nessun nuovo download.');return;}
 }catch{}
 const now=Date.now(),result={
  schema:'scanner-conte-open-source-probe-v1',
  mode:'DIAGNOSTIC_ONLY',day:today,checked_at:new Date().toISOString(),
  description:'Non sono scommesse o consigli; test tecnico della copertura di quote pubbliche prima del calcio d’inizio.',
  changes_to_lab:0,real_bets:0,
  sources:{},
  conclusion:'PENDING'
 };
 try{
  const feed=await getJSON('https://tipsaudit.com/api/v1/predictions');
  if(!Array.isArray(feed.predictions))throw Error('Manca array predictions');
  const generated=dateMs(feed.generated_at);
  const fresh=generated!==null && Math.abs(now-generated)<=90*60000;
  const upcoming=feed.predictions.filter(x=>{
   const t=dateMs(x.kickoff_utc);
   return t!==null && t>now+45*60000 && t<=now+48*3600000;
  });
  const observations=upcoming.filter(x=>{
   const v=x.value;
   return v&&finitePrice(v.best_soft_odds)&&typeof v.bookmaker==='string'&&v.bookmaker.trim()&&
    ['1','x','2','home','draw','away'].includes(String(v.selection||'').trim().toLowerCase())&&
    ['actionable','monitor'].includes(String(x.status));
  });
  // Snapshot valido solo se l'intero feed e aggiornato di recente.
  const valid=fresh?observations:[];
  result.sources.tipsaudit={
   provider:'TipsAudit',reference:'https://tipsaudit.com/api',
   attribution:'Data: TipsAudit — https://tipsaudit.com',
   auth:'none',license:'Free with visible attribution',
   status:'ok',generated_at:feed.generated_at||null,feed_fresh_90m:fresh,
   predictions_returned:feed.predictions.length,
   future_matches_48h:upcoming.length,
   odds_observed_48h:observations.length,
   usable_fresh_1x2_quotes_48h:valid.length,
   distinct_bookmakers:[...new Set(valid.map(x=>x.value.bookmaker))].slice(0,20),
   sample:valid.slice(0,5).map(x=>({
    home:String(x.home||''),away:String(x.away||''),
    kickoff_utc:x.kickoff_utc,market:'1X2',selection:String(x.value.selection),
    quote:Number(x.value.best_soft_odds),bookmaker:String(x.value.bookmaker),
    captured_by_probe_at:result.checked_at,provider_generated_at:feed.generated_at,
    provider_reference:String(x.url||'https://tipsaudit.com/api')
   }))
  };
 }catch(e){
  result.sources.tipsaudit={provider:'TipsAudit',reference:'https://tipsaudit.com/api',
   status:'unavailable',reason:String(e.message||e).slice(0,180)};
 }
 try{
  const summary=await getJSON('https://raw.githubusercontent.com/oladeeayo/open-matchday/master/build_summary.json');
  result.sources.open_matchday={provider:'open-matchday',
   reference:'https://github.com/oladeeayo/open-matchday',
   attribution:'open-matchday — https://github.com/oladeeayo/open-matchday',
   auth:'none',status:'ok',metadata_readable:true,
   // Source metadata may change schema; do not infer coverage without known fields.
   advertised_competitions:75,
   updated_at:summary.built_at||summary.generated_at||summary.updated_at||summary.build_time||null
  };
 }catch(e){
  result.sources.open_matchday={provider:'open-matchday',
   reference:'https://github.com/oladeeayo/open-matchday',
   status:'unavailable',reason:String(e.message||e).slice(0,180)};
 }
 const odds=result.sources.tipsaudit;
 result.conclusion=odds.status==='ok'&&odds.feed_fresh_90m&&odds.usable_fresh_1x2_quotes_48h>0?
  'CANDIDATE_SOURCE_FOR_PAPER_TESTS':'NOT_YET_VERIFIED_FOR_DAILY_PAPER_TESTS';
 await writeFile(TARGET,JSON.stringify(result,null,2)+'\n');
 console.log('SOURCE PROBE '+JSON.stringify({
  day:result.day,conclusion:result.conclusion,
  tipsaudit:result.sources.tipsaudit.status,
  quotes:result.sources.tipsaudit.usable_fresh_1x2_quotes_48h||0,
  open_matchday:result.sources.open_matchday.status
 }));
}
main().catch(e=>{console.error('PROBE ERROR '+String(e.message||e));process.exitCode=1;});
