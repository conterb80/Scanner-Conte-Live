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
