/** LAB virtuali: statistiche settimanali compatte, solo lettura, nessuna cancellazione.
 * Nessun nome partita, account privato, puntata REAL o informazione personale nel report.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {romeDay} from './daily-window.mjs';
const round=(n,d=2)=>Math.round((n+Number.EPSILON)*10**d)/10**d;
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const closed=new Set(['won','lost','push','void']);
function mondayOf(value){
 const day=romeDay(value);if(!day)return '';
 const date=new Date(day+'T12:00:00Z');
 const weekday=(date.getUTCDay()+6)%7;
 date.setUTCDate(date.getUTCDate()-weekday);
 return date.toISOString().slice(0,10);
}
function lastSunday(monday){
 const date=new Date(monday+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+6);
 return date.toISOString().slice(0,10);
}
function typeOf(book,row){
 if(book==='daily')return row.market||'1X2';
 return String(row.strategy||'').startsWith('OVER25')?'OVER_2_5':'1X2';
}
function oddsBand(odd){
 const n=Number(odd);if(!Number.isFinite(n))return 'non disponibile';
 return n<1.5?'<1.50':n<2?'1.50-1.99':n<2.5?'2.00-2.49':'2.50+';
}
function newStats(){return {total:0,pending:0,won:0,lost:0,push:0,void:0,settled:0,stake_settled:0,pnl:0};}
function accumulate(obj,row){
 obj.total++;
 if(row.status==='pending')obj.pending++;
 if(['won','lost','push','void'].includes(row.status))obj[row.status]++;
 if(closed.has(row.status)&&valid(row.pnl)&&valid(row.stake_virtual)&&row.stake_virtual>0){
  obj.settled++;obj.stake_settled+=row.stake_virtual;obj.pnl+=row.pnl;
 }
}
function present(raw){
 const s={...raw,stake_settled:round(raw.stake_settled),pnl:round(raw.pnl)};
 s.roi_pct=s.stake_settled>0?round(100*s.pnl/s.stake_settled,1):null;
 return s;
}
function breakDown(rows,keyOf){
 const groups=new Map();
 for(const row of rows){
  const key=String(keyOf(row)||'sconosciuto');
  if(!groups.has(key))groups.set(key,newStats());
  accumulate(groups.get(key),row);
 }
 return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'it')).map(([name,stats])=>({name,...present(stats)}));
}
export function buildWeeklySummary(daily,auto,generatedAt=new Date().toISOString()){
 if(!Array.isArray(daily?.records)||!Array.isArray(daily?.checks)||!Array.isArray(auto?.records))
  throw new Error('Archivi LAB incompleti: riepilogo non scritto');
 const weeks=[];
 for(const [book,source] of [['daily',daily],['auto',auto]]){
  const grouped=new Map();
  for(const row of source.records){
   const week=mondayOf(row.kickoff);
   if(!week)continue;
   if(!grouped.has(week))grouped.set(week,[]);
   grouped.get(week).push(row);
  }
  for(const [week,rows] of grouped){
   const stats=newStats();rows.forEach(row=>accumulate(stats,row));
   const reports={
    week_start:week,week_end:lastSunday(week),lab:book,...present(stats),
    by_market:breakDown(rows,r=>typeOf(book,r)),
    by_strategy:breakDown(rows,r=>r.strategy),
    by_odds_band:breakDown(rows,r=>oddsBand(r.odds))
   };
   if(book==='daily'){
    const checks=daily.checks.filter(c=>mondayOf(c.day)===week);
    reports.scan_checks=checks.length;
    reports.source_signals_sum=checks.reduce((n,c)=>n+(Number(c.scanned_predictions)||0),0);
    reports.new_tests_reported=checks.reduce((n,c)=>n+(Number(c.created)||0),0);
   }
   weeks.push(reports);
  }
 }
 weeks.sort((a,b)=>b.week_start.localeCompare(a.week_start)||a.lab.localeCompare(b.lab));
 return {
  schema:'scanner-conte-weekly-lab-v1',version:1,generated_at:generatedAt,timezone:'Europe/Rome',
  scope:'Solo laboratori pubblici e virtuali: daily e auto. REAL e registri locali esclusi.',
  retention:'Riepilogo addizionale non distruttivo: gli esperimenti originari restano invariati.',
  caveat:'ROI teorico descrittivo; campioni piccoli e scelte non indipendenti non dimostrano vantaggio.',
  scan_note:'I segnali letti sono una somma di scansioni, non partite uniche; possibili ripetizioni.',
  weeks
 };
}
async function main(){
 const daily=JSON.parse(await readFile('data/daily_virtual_lab.json','utf8'));
 const auto=JSON.parse(await readFile('data/lab_auto.json','utf8'));
 if(daily.schema!=='scanner-conte-daily-virtual-v1'||auto.schema!=='scanner-conte-lab-v1')
  throw Error('Schema LAB non riconosciuto: dati invariati');
 // Timestamp stabile: senza cambi reali non rigenerare commit/notifiche a ogni controllo.
 const sourceTimes=[
  ...daily.records.flatMap(r=>[r.captured_at,r.settled_at]),
  ...auto.records.flatMap(r=>[r.captured_at,r.settled_at]),
  ...daily.checks.map(ch=>ch.checked_at)
 ].filter(v=>Number.isFinite(Date.parse(v||''))).map(v=>new Date(v).toISOString()).sort();
 const stamp=sourceTimes.at(-1)||'1970-01-01T00:00:00.000Z';
 const result=buildWeeklySummary(daily,auto,stamp);
 await writeFile('data/weekly_lab_stats.json',JSON.stringify(result,null,2)+'\n');
 console.log('Riepilogo settimanale LAB: '+result.weeks.length+' gruppi (nessuna cancellazione).');
}
if(process.argv[1]?.endsWith('build-weekly-lab-summary.mjs'))
 main().catch(e=>{console.error(e.message);process.exitCode=1;});
