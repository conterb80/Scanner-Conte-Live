/* Rendering locale di testo IA: nessun HTML eseguito, nessuna libreria remota. */
(function(root){
 'use strict';
 function add(parent,tag,text){const e=document.createElement(tag);if(text)e.textContent=text;parent.append(e);return e;}
 function inline(parent,line){
  const pattern=/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;let pos=0;
  for(const m of line.matchAll(pattern)){add(parent,'span',line.slice(pos,m.index));const token=m[0];
   if(token.startsWith('**'))add(parent,'strong',token.slice(2,-2));
   else{const match=token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);try{const u=new URL(match[2]);if(!['http:','https:'].includes(u.protocol))throw Error();const a=add(parent,'a',match[1]);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{add(parent,'span',token);}}
   pos=m.index+token.length;
  }add(parent,'span',line.slice(pos));
 }
 function render(evidence,container){
  container.replaceChildren();const lines=String(evidence?.text||'').slice(0,100000).split('\n').slice(0,1200);
  for(let i=0;i<lines.length;i++){
   const line=lines[i].trim();if(!line)continue;
   if(line.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
    const wrap=add(container,'div','');wrap.className='ai-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','Tabella del rapporto, scorri orizzontalmente');
    const table=add(wrap,'table',''),head=add(table,'thead',''),body=add(table,'tbody','');
    const cells=s=>s.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').slice(0,8).map(x=>x.trim());
    const tr=add(head,'tr','');for(const cell of cells(line))inline(add(tr,'th',''),cell);i++;
    let count=0;while(i+1<lines.length&&lines[i+1].includes('|')&&lines[i+1].trim()&&count++<60){i++;const row=add(body,'tr','');for(const cell of cells(lines[i]))inline(add(row,'td',''),cell);}continue;
   }
   const heading=/^#{1,6}\s+/.test(line),p=add(container,heading?'h3':'p','');inline(p,line.replace(/^#{1,6}\s+/,''));
  }
  const citations=(evidence?.parts||[]).flatMap(p=>p.citations||[]),seen=new Set();
  if(citations.length){add(container,'h3','Fonti citate');const list=add(container,'ul','');for(const c of citations.slice(0,200)){try{const u=new URL(c.url);if(!['http:','https:'].includes(u.protocol)||seen.has(u.href))continue;seen.add(u.href);const a=add(add(list,'li',''),'a',String(c.title||u.hostname));a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{}}}
 }
 root.ScannerAIReport={render};
})(typeof window!=='undefined'?window:globalThis);
