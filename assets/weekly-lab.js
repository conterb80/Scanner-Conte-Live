/* Report settimanale LAB: sola lettura di statistiche aggregate, nessuna REAL. */
(()=>{
 'use strict';
 const box=document.getElementById('lab-weekly-summary');
 if(!box)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const euro=n=>(typeof n==='number'&&Number.isFinite(n)?(n>0?'+':'')+n.toFixed(2).replace('.',',')+' €':'—');
 const label=d=>{const [y,m,day]=String(d||'').split('-');return day&&m?day+'/'+m+'/'+y:'—';};
 async function load(){
  try{
   const res=await fetch('./data/weekly_lab_stats.json?t='+Date.now(),{cache:'no-store'});
   if(res.status===404){box.textContent='Il primo riepilogo settimanale è in preparazione. Lo storico LAB resta conservato.';return;}
   if(!res.ok)throw Error('HTTP '+res.status);
   const d=await res.json();
   if(d.schema!=='scanner-conte-weekly-lab-v1'||!Array.isArray(d.weeks))throw Error('Archivio non compatibile');
   const items=d.weeks.slice(0,12);
   if(!items.length){box.textContent='Nessun test LAB con data valida da riepilogare.';return;}
   box.innerHTML='<p class="muted small">Solo statistiche virtuali, senza nomi delle squadre. Il registro dettagliato originale resta disponibile e non viene cancellato.</p>'+
    '<div class="scan-audit-scroll"><table class="scan-audit-table"><thead><tr><th>Settimana</th><th>LAB</th><th>Chiusi</th><th>V / P</th><th>P/L virtuale</th><th>ROI</th></tr></thead><tbody>'+
    items.map(w=>'<tr><td>'+esc(label(w.week_start))+'</td><td>'+esc(w.lab==='daily'?'1X2':'Pilota')+'</td><td>'+esc(w.settled)+'</td><td>'+esc(w.won)+' / '+esc(w.lost)+'</td><td>'+esc(euro(w.pnl))+'</td><td>'+esc(w.roi_pct===null?'—':w.roi_pct.toFixed(1).replace('.',',')+'%')+'</td></tr>').join('')+
    '</tbody></table></div>'+
    '<p class="muted tiny">Le settimane dei due LAB restano distinte. ROI su test conclusi con quota e importo documentati; non prova un vantaggio. Le partite in attesa non sono conteggiate nel ROI.</p>'+
    '<details><summary>Dettaglio per mercato</summary><div class="scan-audit-scroll"><table class="scan-audit-table"><thead><tr><th>Settimana</th><th>LAB</th><th>Mercato</th><th>Test</th><th>V / P</th><th>ROI</th></tr></thead><tbody>'+
    items.flatMap(w=>(w.by_market||[]).map(m=>'<tr><td>'+esc(label(w.week_start))+'</td><td>'+esc(w.lab==='daily'?'1X2':'Pilota')+'</td><td>'+esc(m.name)+'</td><td>'+esc(m.total)+'</td><td>'+esc(m.won)+' / '+esc(m.lost)+'</td><td>'+esc(m.roi_pct===null?'—':m.roi_pct.toFixed(1).replace('.',',')+'%')+'</td></tr>')).join('')+
    '</tbody></table></div></details>';
  }catch(e){box.textContent='Riepilogo non disponibile: '+String(e.message||e);}
 }
 window.addEventListener('focus',()=>{if(!document.hidden)load();});
 load();
})();
