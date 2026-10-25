/* Scanner Conte LIVE — supporto installazione PWA su Android. */
(()=>{
  'use strict';
  const panel=document.getElementById('install-panel');
  const button=document.getElementById('install-cta');
  const feedback=document.getElementById('install-feedback');
  if(!panel||!button||!feedback)return;
  let deferred=null;
  const installed=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const hide=()=>{panel.hidden=true;};
  if(installed()){hide();return;}
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferred=event;
    button.textContent='Installa Scanner Conte';
    feedback.textContent='Installazione supportata: premi il pulsante per confermare con Chrome.';
  });
  window.addEventListener('appinstalled',()=>{
    deferred=null;
    hide();
  });
  button.addEventListener('click',async()=>{
    if(installed()){hide();return;}
    if(deferred){
      const prompt=deferred;deferred=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        if(choice?.outcome==='accepted'){
          feedback.textContent='Installazione richiesta a Chrome. Controlla la schermata Home del telefono.';
        }else{
          feedback.textContent='Installazione annullata. Puoi riprovare dal menu di Chrome.';
        }
      }catch(e){
        feedback.textContent='Usa il menu ⋮ di Chrome → Installa app oppure Aggiungi a schermata Home.';
      }
    }else{
      feedback.textContent='Apri questo sito in Chrome (non nel browser interno di ChatGPT), poi tocca ⋮ → Installa app. Se non compare, scegli Aggiungi a schermata Home.';
    }
  });
})();
