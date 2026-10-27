/** Scanner Conte LIVE — liquidazione prudente test virtuali 1X2.
 * Controlla SOLO i test gia registrati prima del match nel registro pubblico TipsAudit.
 * Non usa l'importo REAL e non modifica il LAB originale.
 */
import {readFile,writeFile} from 'node:fs/promises';
const FILE='data/daily_virtual_lab.json',URL='https://tipsaudit.com/track-record.json';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const betPick=s=>s==='Home'?'1':s==='Draw'?'X':s==='Away'?'2':null;
const resultPick=s=>{const x=String(s||'').trim().toUpperCase();return ['1','X','2'].includes(x)?x:null;};
function eligible(record,source,now){
 if(record.status!=='pending'||!source||!source.settled||!resultPick(source.result))return false;
 if(String(source.id)!==String(record.source_id)||key(source.home)!==key(record.match.split(' - ')[0])||
   key(source.away)!==key(record.match.split(' - ')[1]))return false;
 const kickoff=Date.parse(record.kickoff),published=Date.parse(source.kickoff_utc);
 return Number.isFinite(kickoff)&&Number.isFinite(published)&&
  kickoff<now-90*60000&&Math.abs(kickoff-published)<=12*3600000&&
  Number.isFinite(Date.parse(record.captured_at))&&Date.parse(record.captured_at)<kickoff-45*60000&&
  betPick(record.selection)!==null&&Number.isFinite(record.odds)&&record.odds>=1.2;
}
function stats(rows){
 const done=rows.filter(x=>x.status==='won'||x.status==='lost');
 return {total:rows.length,pending:rows.filter(x=>x.status==='pending').length,
  won:done.filter(x=>x.status==='won').length,lost:done.filter(x=>x.status==='lost').length,
  pnl:round(done.reduce((n,x)=>n+(typeof x.pnl==='number'?x.pnl:0),0))};
}
async function main(){
 let data;
 try{data=JSON.parse(await readFile(FILE,'utf8'));}catch(e){if(e.code==='ENOENT'){console.log('NOOP: nessun LAB quotidiano');return;}throw e;}
 if(data.schema!=='scanner-conte-daily-virtual-v1'||!Array.isArray(data.records))throw Error('Schema locale inatteso');
 const pending=data.records.filter(x=>x.status==='pending'&&Date.parse(x.kickoff)<Date.now()-90*60000);
 if(!pending.length){console.log('NOOP: nessuna simulazione pronta per il controllo FT');return;}
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),35000);
 let ext;try{
  const res=await fetch(URL,{signal:abort.signal,headers:{Accept:'application/json','User-Agent':'ScannerConteLIVE/1.0 (virtual result audit)'}});
  if(!res.ok)throw Error('Risultati HTTP '+res.status);
  ext=await res.json();
 }finally{clearTimeout(timer);}
 const rows=Array.isArray(ext.predictions)?ext.predictions:[],
  map=new Map(rows.filter(x=>x.id!==null&&x.id!==undefined).map(x=>[String(x.id),x]));
 if(rows.length<100)throw Error('Registro fonte incompleto: nessuna liquidazione');
 let closed=0;
 for(const record of pending){
  const source=map.get(String(record.source_id));
  if(!eligible(record,source,Date.now()))continue;
  const won=betPick(record.selection)===resultPick(source.result);
  record.status=won?'won':'lost';
  record.pnl=won?round(record.stake_virtual*(record.odds-1)):round(-record.stake_virtual);
  record.settled_at=new Date().toISOString();
  record.verified_ft_result=source.result;
  record.settlement_source='TipsAudit public record (1X2 FT)';
  record.settlement_reference='https://tipsaudit.com/track-record';
  record.settlement_publication=ext.generated_at||null;
  closed++;
 }
 if(!closed){console.log('NOOP: nessun risultato verificabile, restano pending '+pending.length);return;}
 data.last_settlement_check=new Date().toISOString();
 data.stats=stats(data.records);
 await writeFile(FILE,JSON.stringify(data,null,2)+'\n');
 console.log('SETTLED DAILY PAPER '+JSON.stringify({closed,stats:data.stats,source_count:rows.length}));
}
main().catch(e=>{console.error('SETTLEMENT ERROR '+e.message);process.exitCode=1;});
