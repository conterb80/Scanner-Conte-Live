import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
const renderCode=await readFile(new URL('../assets/ai-report-render.js',import.meta.url),'utf8'),appCode=await readFile(new URL('../assets/ai-app.js',import.meta.url),'utf8');
const endpoint='http://127.0.0.1:39765/'+'a'.repeat(32)+'/integration.json';
const report={schema:'scanner-conte-ai-integration-v1',run_id:'report',generated_at:new Date().toISOString(),model:'offline',input:{items:[{match:'A – B',captured_at:new Date().toISOString(),reference_odds:2,reference_bookmaker:'Storica'}]},evidence:{status:'WEB_SEARCH_CONFIRMED',text:'## Calendario\n| Partita | Dato |\n|---|---|\n| A – B | <script>alert(1)</script> |',parts:[{citations:[{url:'javascript:alert(1)',title:'scarta'},{url:'https://example.org/official',title:'Ufficiale'}]}],completed_search_actions:1,citation_count:1}};
const payload={schema:'scanner-conte-app-bridge-v1',sent_at:new Date().toISOString(),status:{phase:'WAITING',last_heartbeat_at:new Date().toISOString(),last_check_at:new Date().toISOString()},report};
function harness(initial={}){
 const elements=new Map(),listeners={},store=new Map(Object.entries(initial));let opened,online=true,returned=false;
 class E{constructor(tag='div'){this.tagName=tag;this.children=[];this.textContent='';this.events={};this.className='';}append(e){this.children.push(e);}replaceChildren(){this.children=[];}setAttribute(){}addEventListener(name,cb){this.events[name]=cb;}}
 const get=id=>{if(!elements.has(id))elements.set(id,new E());return elements.get(id);};
 const popup={closed:false,focus(){},close(){this.closed=true;},messages:[],postMessage(...args){this.messages.push(args);}};
 const context={URL,JSON,Date,Set,AbortSignal,crypto:{randomUUID},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{hidden:false,getElementById:get,createElement:t=>new E(t),addEventListener(){}},location:{hash:'',pathname:'/Scanner-Conte-Live/',search:''},history:{replaceState(){context.location.hash='';}},setTimeout:()=>1,clearTimeout(){},setInterval(){},addEventListener:(name,cb)=>{listeners[name]=cb;},open:url=>{opened=url;return popup;},goto:page=>{returned=page;},fetch:async()=>{if(!online)throw Error('offline');return{ok:true,json:async()=>payload};}};
 context.window=context;const scope=vm.createContext(context);
 return {context,scope,get,store,popup,listeners,run:()=>{vm.runInContext(renderCode,scope);vm.runInContext(appCode,scope);},opened:()=>opened,offline:()=>{online=false;},returned:()=>returned};
}
test('collega con origine, finestra e nonce corretti; conserva i registri locali',async()=>{
 const h=harness({'registro-esistente':'NON_MODIFICARE'});h.run();h.get('ai-connect').events.click();const nonce=new URL(h.opened()).searchParams.get('state');
 const event={origin:'http://127.0.0.1:39765',source:h.popup,data:{type:'scanner-ai-connected',nonce,endpoint,payload}};
 h.listeners.message({...event,origin:'https://evil.example'});assert.equal(h.store.has('scanner-conte-ai-connection-v1'),false);
 h.listeners.message({...event,data:{...event.data,nonce:'sbagliato'}});assert.equal(h.store.has('scanner-conte-ai-connection-v1'),false);
 h.listeners.message({...event,source:{}});assert.equal(h.store.has('scanner-conte-ai-connection-v1'),false);
 h.listeners.message(event);await new Promise(r=>setTimeout(r,0));assert.equal(h.store.get('scanner-conte-ai-connection-v1'),endpoint);assert.equal(h.store.get('registro-esistente'),'NON_MODIFICARE');assert.match(h.get('ai-connection-state').textContent,/collegato/);
 h.offline();await h.get('ai-refresh').events.click();await new Promise(r=>setTimeout(r,0));assert.match(h.get('ai-connection-state').textContent,/non raggiungibile/);assert.ok(h.get('ai-report-body').children.length>0);
});
test('renderer crea tabella e tratta HTML come testo; URL script esclusi',()=>{
 const h=harness();vm.runInContext(renderCode,h.scope);const body=h.get('body');h.context.ScannerAIReport.render(report.evidence,body);
 const all=[];function walk(e){all.push(e);for(const child of e.children)walk(child);}walk(body);
 assert.equal(all.filter(e=>e.tagName==='table').length,1);assert.ok(all.some(e=>e.textContent.includes('<script>')));assert.equal(all.some(e=>e.tagName==='script'),false);assert.equal(all.filter(e=>e.tagName==='a').length,1);
});
test('ritorno alternativo senza opener verifica nonce salvato e rimuove subito il frammento',()=>{
 const nonce=randomUUID(),h=harness({'scanner-conte-ai-pending-v1':JSON.stringify({nonce,at:Date.now()})});h.offline();h.context.location.hash='#scanner-ia='+encodeURIComponent(JSON.stringify({nonce,endpoint,payload}));h.run();assert.equal(h.context.location.hash,'');assert.equal(h.returned(),'ai');assert.equal(h.store.get('scanner-conte-ai-connection-v1'),endpoint);
 const bad=harness();bad.context.location.hash='#scanner-ia='+encodeURIComponent(JSON.stringify({nonce,endpoint,payload}));bad.run();assert.equal(bad.store.has('scanner-conte-ai-connection-v1'),false);
});
