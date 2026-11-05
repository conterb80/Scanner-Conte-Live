/* Ponte locale per verificare la presenza di evidenze IA su ogni candidata.
 * Nessuna chiamata IA, modifica a REAL/LAB o giudizio di redditività.
 */
(function(root){
'use strict';
const TZ='Europe/Rome',MAX_AGE_MS=6*3600000;
const stamp=x=>{const t=Date.parse(x||'');return Number.isFinite(t)?t:NaN;};
function day(x){const d=new Date(x);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d):null;}
const compact=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function matchKey(s){const parts=String(s||'').split(/\s+[-–—]\s+/);return parts.length===2&&parts.every(x=>compact(x))?parts.map(compact).join('|'):null;}
function sameCandidate(a,b){
 if(!a||!b)return false;
 const am=matchKey(a.match),bm=matchKey(b.match);
 if(am&&bm&&am!==bm)return false;
 if(a.candidate_id&&b.id&&a.candidate_id===b.id)return true;
 if(a.id&&b.id&&a.id===b.id)return true;
 return !!(am&&bm&&am===bm);
}
function sourceUrls(assessment){const src=Array.isArray(assessment?.sources)?assessment.sources:[];return src.slice(0,12).map(x=>typeof x==='string'?x:x?.url).filter(x=>{try{const u=new URL(x);return u.protocol==='https:'&&!!u.hostname&&u.username===''&&u.password==='';}catch{return false;}}).slice(0,3);}
function result(code,title,detail,extra={}){return {code,title,detail,...extra};}
function evaluate(candidate,cached,at=Date.now()){
 const payload=cached?.payload,report=payload?.report,now=Number(at);
 if(payload?.schema!=='scanner-conte-app-bridge-v1'||report?.schema!=='scanner-conte-ai-integration-v1'||
   report?.evidence?.status!=='WEB_SEARCH_CONFIRMED')
  return result('missing','IA · Nessuna verifica disponibile','Il motore statistico ha selezionato la partita; manca un rapporto IA collegato.');
 const generated=stamp(report.generated_at),captured=stamp(candidate.captured_at),kickoff=stamp(candidate.kickoff);
 if(!Number.isFinite(generated)||!Number.isFinite(captured)||!Number.isFinite(kickoff)||
   !Number.isFinite(now)||!day(candidate.kickoff)||day(report.generated_at)!==day(candidate.kickoff)||
   generated>now+120000||now-generated>MAX_AGE_MS||generated<captured-120000||generated>=kickoff)
  return result('stale','IA · Rapporto non applicabile','Rapporto vecchio, di un altro giorno o precedente alla rilevazione della candidata.');
 const assessments=Array.isArray(report.candidate_assessments)?report.candidate_assessments:
   Array.isArray(report.evidence?.candidate_assessments)?report.evidence.candidate_assessments:[];
 const a=assessments.find(x=>sameCandidate(x,candidate)&&
   (!x.kickoff||Math.abs(stamp(x.kickoff)-kickoff)<=15*60000)&&
   Number.isFinite(stamp(x.checked_at))&&stamp(x.checked_at)>=captured-120000&&
   stamp(x.checked_at)<=generated+120000&&stamp(x.checked_at)<kickoff);
 if(a){
  const urls=sourceUrls(a),summary=String(a.summary||'').trim().slice(0,260);
  const verdict=String(a.verdict||'').toUpperCase();
  const labels={SUPPORT:'Elementi a favore',CAUTION:'Elementi da verificare',CONTRADICT:'Elementi contrari',INCONCLUSIVE:'Esito incerto'};
  if(summary&&labels[verdict]&&urls.length)
   return result('specific','IA · '+labels[verdict],summary,{checked_at:a.checked_at,sources:urls,verdict});
  return result('partial','IA · Analisi non completa','Valutazione trovata ma senza giudizio, motivazione o fonti specifiche consultabili.');
 }
 const items=Array.isArray(report.input?.items)?report.input.items:[];
 if(items.some(x=>sameCandidate(x,candidate)&&(!x.kickoff||Math.abs(stamp(x.kickoff)-kickoff)<=15*60000)))
  return result('mentioned','IA · Partita nel rapporto','La partita compare tra gli input IA, ma non risulta una valutazione mirata con fonti collegata a questa candidata.');
 return result('not-covered','IA · Candidata non analizzata','Nessuna verifica IA specifica trovata per questa partita. La selezione resta soltanto statistica.');
}
root.ScannerAICandidateBridge={evaluate};
})(typeof window!=='undefined'?window:globalThis);
