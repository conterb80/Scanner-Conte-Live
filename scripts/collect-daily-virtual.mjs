/**
 * Scanner Conte LIVE — raccolta quotazioni 1X2 pubbliche per esperimenti forward.
 * 2 richieste massime al giorno a TipsAudit, nessuna chiave, nessuna scommessa reale.
 * NON sostituisce i 30 test originali: confronto indipendente con fonte esterna.
 * Attribution: TipsAudit — https://tipsaudit.com/api
 */
import {readFile,writeFile} from 'node:fs/promises';
const PATH='data/daily_virtual_lab.json',URL='https://tipsaudit.com/api/v1/predictions';
const TZ='Europe/Rome',STRATEGY='TIPSAUDIT_VALUE_1X2';
const fmtDay=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const ageMs=t=>Date.now()-Date.parse(t||'');
const validDate=s=>Number.isFinite(Date.parse(s||''));
const odd=n=>Number.isFinite(Number(n))&&Number(n)>=1.20&&Number(n)<=20?Number(n):null;
const choice=s=>{const x=String(s||'').trim().toLowerCase();return x==='1'||x==='home'?'Home':x==='x'||x==='draw'?'Draw':x==='2'||x==='away'?'Away':null;};
const clean=s=>String(s||'').trim().slice(0,150);
const key=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
async function load(path,fallback){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function retrieve(){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),17000);
 try{
  const r=await fetch(URL,{signal:abort.signal,headers:{Accept:'application/json','User-Agent':'ScannerConteLIVE/1.0 (personal daily virtual audit)'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();if(!Array.isArray(data.predictions))throw Error('Missing predictions array');
  return data;
 }finally{clearTimeout(timer);}
}
function stats(rows){
 const done=rows.filter(x=>x.status==='won'||x.status==='lost');
 return {total:rows.length,pending:rows.filter(x=>x.status==='pending').length,
  won:done.filter(x=>x.status==='won').length,lost:done.filter(x=>x.status==='lost').length,
  pnl:round(done.reduce((n,x)=>n+(typeof x.pnl==='number'?x.pnl:0),0))};
}
async function main(){
 const capturedAt=new Date().toISOString(),today=fmtDay(capturedAt);
 const store=await load(PATH,{schema:'scanner-conte-daily-virtual-v1',version:1,
  description:'Test forward 1X2 separati; quote osservate prima del calcio d’inizio, non puntate REAL.',
  attribution:'Dati quote: TipsAudit — https://tipsaudit.com/api',records:[],checks:[]});
 if(store.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(store.records)||!Array.isArray(store.checks))
  throw Error('Archivio virtuale inatteso: nessun salvataggio');
 if(store.checks.filter(x=>x.day===today).length>=2){console.log('SKIP: 2 scansioni odierne gia registrate.');return;}
 const recent=store.checks.filter(x=>x.day===today).map(x=>Date.parse(x.checked_at)).filter(Number.isFinite);
 if(recent.length && Date.now()-Math.max(...recent)<4*3600000){console.log('SKIP: meno di quattro ore dall’ultima scansione; nessuna chiamata sprecata.');return;}
 const original=await load('data/lab_auto.json',null);
 if(!original||!Array.isArray(original.records))throw Error('Storico LAB principale illeggibile: non procedo');
 const data=await retrieve();
 const sourceDate=data.generated_at,now=Date.now();
 if(!validDate(sourceDate)||Math.abs(ageMs(sourceDate))>30*60000)
  throw Error('Feed non aggiornato (supera 30 minuti): niente giocate registrate');
 const candidates=data.predictions.filter(x=>x.status==='actionable'&&
  validDate(x.kickoff_utc)&&Date.parse(x.kickoff_utc)>now+90*60000&&
  Date.parse(x.kickoff_utc)<now+48*3600000&&
  x.id!==null&&x.id!==undefined&&
  clean(x.home)&&clean(x.away)&&
  choice(x.value?.selection)&&odd(x.value?.best_soft_odds)&&
  clean(x.value?.bookmaker)&&x.url?.startsWith('https://tipsaudit.com/')&&
  x.fair_source==='live'&&validDate(x.benchmark_read_at)&&
  ageMs(x.benchmark_read_at)>=-120000&&ageMs(x.benchmark_read_at)<=90*60000);
 const all=original.records.map(x=>({
  day:validDate(x.kickoff)?fmtDay(x.kickoff):'',match:key(x.match)
 }));
 const existing=new Set(store.records.map(x=>x.id));
 let created=0;
 for(const x of candidates){
  const id='tipsaudit-'+String(x.id)+':'+STRATEGY;
  if(existing.has(id))continue;
  const compound=key(x.home+' - '+x.away);
  const date=fmtDay(x.kickoff_utc);
  if(all.some(r=>r.day===date&&r.match===compound))continue;
  if(store.records.some(r=>r.kickoff&&fmtDay(r.kickoff)===date&&key(r.match)===compound))continue;
  if(store.records.filter(r=>r.capture_day===today).length>=20)break;
  const price=odd(x.value.best_soft_odds),pick=choice(x.value.selection);
  const referenceOdds=odd(x.value.fair_odds);
  const rec={id,source_id:String(x.id),strategy:STRATEGY,
    match:clean(x.home)+' - '+clean(x.away),league:clean(x.league),
    kickoff:x.kickoff_utc,selection:pick,market:'1X2',bookmaker:clean(x.value.bookmaker),
    odds:price,fair_odds:referenceOdds,edge:Number.isFinite(Number(x.value.price_gap))?Number(x.value.price_gap):null,
    bookmaker_quote_status:'source actionable, not guaranteed executable',
    captured_at:capturedAt,capture_day:today,provider_generated_at:sourceDate,
    benchmark_read_at:x.benchmark_read_at,
    provider:'TipsAudit (external signal, NOT our own betting model)',reference:x.url,
    origin:'live bookmaker observation via TipsAudit public feed',stake_virtual:1,
    status:'pending',pnl:null,score:null,settled_at:null};
  store.records.push(rec);existing.add(id);created++;
 }
 const check={day:today,checked_at:capturedAt,source_generated_at:sourceDate,
  scanned_predictions:data.predictions.length,eligible_actionable:candidates.length,
  created,source:'TipsAudit',test_only:true};
 store.checks.push(check);
 store.last_check=capturedAt;store.stats=stats(store.records);
 await writeFile(PATH,JSON.stringify(store,null,2)+'\n');
 console.log('DAILY PAPER '+JSON.stringify({check,stats:store.stats}));
}
main().catch(e=>{console.error('DAILY PAPER ERROR: '+e.message);process.exitCode=1;});
