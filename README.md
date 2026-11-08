# Scanner Conte LIVE · V0.4 — LAB virtuale pilota

App: https://conterb80.github.io/Scanner-Conte-Live/

## Stato
- V0.1: archivio REAL, virtuale principale e LAB importato **localmente** dal backup personale.
- V0.2: raccolta automatica di calendari e risultati da API-Football.
- V0.3: filtro per campionati, paese e giorno.
- **V0.4: motore pilota per quote prepartita e simulazioni virtuali**, ancora da validare con la prima esecuzione reale.

## Sicurezza e dati personali
- Il repository è PUBBLICO. Non aggiungere backup del telefono, storico REAL, chiavi API o segreti.
- Lo storico personale rimane in localStorage del dispositivo e nel backup JSON esportato.
- `data/lab_auto.json` contiene **soltanto esperimenti virtuali generati automaticamente dal motore** e può essere pubblico.
- Non è prevista alcuna puntata reale automatica.

## Avviare
Il secret `API_FOOTBALL_KEY` è richiesto su GitHub: Settings → Secrets and variables → Actions.
Actions → **Scanner Conte - Raccolta dati** → **Run workflow** su `main`.
Il workflow è previsto alle 07:17 e 18:17 ora italiana e può subire ritardi.

Sequenza:
1. `scripts/collect-fixtures.mjs`: 3 richieste al palinsesto (ieri, oggi, domani).
2. `scripts/lab-pilot.mjs`: fino a 12 richieste per quote pre-match di partite prioritarie future; 7,1 s tra richieste per tutelare il rate limit gratuito; salva dati pubblici.
3. Aggiorna `data/fixtures_latest.json`, `data/odds_latest.json`, `data/lab_auto.json`.

Il piano gratuito API-Football attualmente include 100 richieste al giorno, con accesso al catalogo quote, ma la copertura dipende da campionato, partita e bookmaker. Non abbiamo 100 partite *analizzate* automaticamente: la raccolta ampia di eventi è diversa dal pilot con 12 richieste quote per esecuzione.

## Regole di registrazione del pilot
- Nessun ingresso virtuale senza **quota vera** da API-Football rilevata almeno 45 minuti prima del calcio d'inizio.
- `FAVORITA_1X2_CONTROLLO`: quota favorita home/away compresa tra 1,45 e 2,10 con mercato 1X2 completo.
- `OVER25_CONTROLLO`: quota Over 2,5 compresa tra 1,60 e 2,20 con entrambi Over e Under.
- 1 € **virtuale** per test; nessun bankroll reale.
- Registrazione `fixture ID + strategia` unica, con bookmaker, quota e `captured_at` **immutabili**. Se un evento non presenta quote, nessuna scommessa è inventata.
- Esito calcolato solo su partite `FT` con reti disponibili. AET/PEN, rinvii o partite non presenti nel feed restano non concluse.
- La probabilità normalizzata del bookmaker è un **riferimento di mercato**, non un modello predittivo validato né una prova di value betting.
- Gli esperimenti dell'app V0.4 sono **separati** dalle 75 schede storiche locali.

## Ulteriori miglioramenti
Serviranno uno storico più affidabile delle quote, controlli su rinvii e casi particolari, filtri di copertura, un modello probabilistico indipendente e soprattutto valutazioni fuori campione prima di promuovere candidate REAL.

Non utilizzare il progetto per mettere scommesse automatiche su Bet365.

## V0.5 — Installazione Android e quote Bet365

- Manifest PWA con `assets/icon-192.png` e `assets/icon-512.png`, ID stabile, HTTPS tramite GitHub Pages e Service Worker cache `v0.5.0`.
- Per installare: aprire il link **direttamente in Chrome Android**, non nel browser integrato di ChatGPT; premere **Installa app** nell'Home dell'app oppure menu ⋮ → Installa app / Aggiungi alla schermata Home. Se la vecchia pagina resta in cache, chiudere e riaprire il sito in Chrome.
- Scheda Scanner: sezione **Quote Bet365 rilevate**. La fonte è API-Football, con orario di acquisizione; il motore conserva prezzi 1X2, Over/Under 2,5 e Goal/No Goal quando esplicitamente disponibili per bookmaker Bet365.
- **Non è un collegamento al conto Bet365**: l'API pre-match può aggiornarsi ogni 3 ore e mancare per eventi/mercati; non è un quotatore Bet365 in tempo reale. Prima di una puntata reale verificare sempre il prezzo effettivo nell'app Bet365.
- Le simulazioni LAB e lo storico privato non sono modificate dagli aggiornamenti. Nessun piazzamento reale automatico.
- Il workflow si avvia anche a seguito di modifiche tecniche ai due script del motore o al workflow; i commit dei feed non lo riattivano per evitare loop.


## IA locale (V0.10.0)

La scheda Home → Apri IA legge rapporti prodotti dal motore Termux v1.3, sullo
stesso telefono. Il collegamento iniziale richiede il pulsante Collega / aggiorna
IA e una conferma nella pagina locale. Browser o PWA possono chiedere il permesso
di collegarsi al dispositivo locale. Se il collegamento diretto non è disponibile,
il pulsante trasferisce il rapporto tramite una pagina locale e ritorna all'app.
Usare lo stesso browser dell'app. Un popup bloccato va consentito esplicitamente.

Il browser conserva solo endpoint locale di lettura e una copia del rapporto.
Le credenziali ChatGPT rimangono in Termux. Nessun rapporto viene caricato su GitHub.
I registri REAL e LAB non vengono scritti dal collegamento. Stato sconosciuto o
non raggiungibile è distinto dal rapporto salvato; nessun vecchio rapporto diventa
live. Il motore analizza gli eventi futuri della giornata Europe/Rome; i vecchi
rapporti restano consultabili con data e ambito originari.

Test interfaccia e renderer: `node --test scripts/test-ai-integration.mjs`.

## V0.10.1 — IA accanto alle candidate (ponte di lettura)

- Lo Scanner visualizza lo stato IA per candidata, verificando partita, giorno Europe/Rome, rilevazione e freschezza massima 6 ore.
- Una partita citata negli input non equivale a una verifica mirata; rapporti scaduti non confermano alcuna candidata.
- Per il giudizio specifico il futuro produttore Termux deve includere in report.candidate_assessments (oppure report.evidence.candidate_assessments) campi candidate_id/match, checked_at, verdict (SUPPORT/CAUTION/CONTRADICT/INCONCLUSIVE), summary e sources HTTPS pertinenti. Questa modifica non aggiorna Termux.
- Non cambiano shortlist, scoring e archivi REAL/LAB. I rapporti IA restano soltanto sul dispositivo.
- Test: node scripts/test-ai-candidate-bridge.mjs.

## V0.10.2 — Archivio candidate Scanner

La sezione Scanner contiene ora lo Storico candidate, distinto dal LAB generale e dalle REAL private. Legge data/scanner_candidate_history.json aggiornato dai workflow esistenti. Conserva 33 rapporti recuperati da GitHub dal 1 novembre 2026 e prosegue automaticamente. Riporta esiti assegnati dalla fonte TipsAudit e quote di riferimento: non equivale a verifica indipendente, disponibilità Bet365 o puntate reali. Non cambia il motore o i criteri delle selezioni.


## V0.11.0 — Osservatorio REAL quotidiano, anche non piazzate (08/11/2026)

- Nuova sezione Scanner → REAL osservatorio: due osservazioni principali e fino a tre riserve, congelate prima del calcio d'inizio. Nessuna scommessa viene piazzata.
- Nuovo storico separato in `data/real_watch_history.json` e rapporto del giorno `data/real_watch_today.json`: partita, mercato, pronostico, quota di riferimento, fonte e ora della prima pubblicazione sono conservati anche senza puntata.
- Aggiornamento automatico: `.github/workflows/real-watch.yml` cinque volte al giorno (Europe/Rome). Lo scanner LAB quotidiano avvia anche l'aggiornamento REAL dopo una nuova acquisizione, e il workflow esiti aggiorna il registro.
- Statistiche virtuali separate: 1 € simulato per candidata PRINCIPALE con esito chiuso, senza modificare in alcun modo il bilancio REAL. Riserve archiviate ma escluse dal ROI principale.
- La schermata legge localmente se esiste una puntata REAL corrispondente nell'archivio del telefono, senza caricare informazioni personali online.
- Limiti espliciti: la fonte oggi copre soltanto il mercato 1X2 con quote di altri bookmaker (TipsAudit), NON prezzi Bet365. Il confronto quota/equo della stessa fonte non costituisce una probabilità indipendente o vantaggio dimostrato.
- Il modello ibrido xG/Poisson NON è attivo finché non si dispone di un feed xG verificato. L'osservatorio è un primo passo e non va indicato come strategia 2.0 validata.
- Se non ci sono osservazioni nuove non vengono create partite né quote artificiali. I consigli in chat non sono registrati automaticamente.
- Test regressione: `node scripts/test-real-watch.mjs`.
