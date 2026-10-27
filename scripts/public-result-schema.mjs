/** Diagnostica UNA TANTUM dello schema del registro pubblico TipsAudit.
 * Solo metadati e un esempio di partita pubblica, nessuna chiave, nessuna REAL.
 */
import {writeFile} from 'node:fs/promises';
async function main(){
 const res=await fetch('https://tipsaudit.com/track-record.json',{
  signal:AbortSignal.timeout(35000),headers:{Accept:'application/json', 'User-Agent':'ScannerConteLIVE/1.0 audit diagnostics'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 const body=await res.json();
 const arr=Array.isArray(body)?body:
  ['records','predictions','rows','items','data','entries'].map(k=>body?.[k]).find(Array.isArray)||[];
 const one=arr.find(x=>Number(x.id)===11957)||arr.find(x=>Number(x.id)===11962)||arr[0];
 const last=arr[arr.length-1];
 const select=x=>x?Object.fromEntries(Object.entries(x).filter(([k])=>/id|home|away|kick|result|score|status|void|updated|won|settled|date|match/i.test(k))):null;
 const output={checked_at:new Date().toISOString(),total_records:arr.length,top_type:Array.isArray(body)?'array':typeof body,
  root_keys:Array.isArray(body)?[]:Object.keys(body),sample_keys:one?Object.keys(one):[],
  example:select(one),last:select(last)};
 await writeFile('data/public_result_schema.json',JSON.stringify(output,null,2)+'\n');
 console.log('SCHEMA PROBE '+JSON.stringify({total:arr.length,keys:output.sample_keys.length}));
}
main().catch(e=>{console.error('SCHEMA PROBE FAILED '+e.message);process.exitCode=1});
