/* Scanner Conte LIVE V0.2 — visualizzazione del palinsesto pubblico.
 * Il backup storico REAL / LAB resta solo nel localStorage del telefono.
 */
(()=>{
  'use strict';
  const summary=document.getElementById('feed-summary');
  const rows=document.getElementById('feed-fixtures');
  const refresh=document.getElementById('feed-refresh');
  if(!summary||!rows||!refresh)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localTime=iso=>{try{return new Date(iso).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_){return '—'}};
  async function load(){
    refresh.disabled=true;
    summary.textContent='Controllo del feed automatico…';
    rows.innerHTML='';
    try{
      const response=await fetch('./data/fixtures_latest.json?fresh='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(data.schema!=='scanner-conte-fixtures-v1')throw new Error('Formato sconosciuto');
      if(data.status!=='ready'){
        summary.innerHTML='<b>Motore predisposto, non ancora alimentato.</b><p class="muted small">Per avviare la raccolta automatica dobbiamo impostare la chiave API protetta nei GitHub Actions Secrets. Lo storico sul telefono è salvo e non viene trasferito su GitHub.</p>';
        return;
      }
      const coverage=data.coverage||{};
      summary.innerHTML='<div><strong>'+esc(coverage.eligible_matches)+' partite</strong> raccolte in <strong>'+esc(coverage.eligible_competitions)+' competizioni</strong> selezionate, da '+esc(coverage.provided_matches)+' eventi forniti dall’API.</div>'+
        '<p class="muted small">Aggiornato '+esc(localTime(data.collected_at))+' · '+esc(data.source)+' · '+esc((data.dates||[]).join(', '))+'</p>'+
        '<p class="muted small">Solo calendario e risultati: nessuna quota verificata, nessun pronostico o simulazione automatica attivi.</p>';
      const now=Date.now();
      const upcoming=(data.fixtures||[]).filter(m=>['NS','TBD'].includes(m.status)&&m.kickoff&&new Date(m.kickoff).getTime()>now)
        .sort((a,b)=>String(a.kickoff).localeCompare(String(b.kickoff)));
      if(!upcoming.length){
        rows.innerHTML='<div class="surface pad muted small">Nessuna partita futura nella finestra coperta. I risultati storici della finestra restano nel feed.</div>';
        return;
      }
      const selected=upcoming.slice(0,24);
      rows.innerHTML=selected.map(m=>'<article class="candidate"><div class="ctop"><span class="tag main">'+esc(m.country)+'</span><span class="muted small">'+esc(localTime(m.kickoff))+'</span></div><h3>'+esc(m.home)+' – '+esc(m.away)+'</h3><p class="muted small">'+esc(m.league)+' · Calendario verificato · Quota non disponibile</p></article>').join('')+
        (upcoming.length>selected.length?'<p class="muted small">Visualizzate 24 di '+upcoming.length+' partite future nel feed.</p>':'');
    }catch(e){
      summary.innerHTML='<b>Non riesco a leggere il feed automatico.</b><p class="muted small">'+esc(e.message)+' — il backup sul telefono non è interessato.</p>';
    }finally{refresh.disabled=false;}
  }
  refresh.addEventListener('click',load);
  load();
})();
