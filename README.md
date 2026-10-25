# Scanner Conte LIVE · V0.2

PWA pubblica: https://conterb80.github.io/Scanner-Conte-Live/

## Obiettivo
Laboratorio virtuale di osservazione delle partite. Poche eventuali scommesse REAL scelte manualmente, senza alcun automatismo di puntata.

## Dati storici e privacy
Il registro REAL / principale / LAB viene conservato nel browser (localStorage).
**Non caricare sul repository backup, giocate REAL, file storico_iniziale.json o chiavi API.**
Esportare backup JSON dall'app dopo ogni aggiornamento importante. Questa versione non sincronizza i dati tra dispositivi.

## Attivazione della raccolta automatica

1. Registrarsi su https://dashboard.api-football.com/ e scegliere il piano gratuito, se disponibile.
2. Copiare la propria API key dalla dashboard del servizio.
3. In questo repository: Settings → Secrets and variables → Actions → New repository secret.
4. Name = `API_FOOTBALL_KEY`. Value = la chiave privata. Non inserirla in chat, nei file o nella PWA.
5. Aprire Actions → Scanner Conte - Raccolta dati → Run workflow (branch main).
6. Se l'azione termina con esito positivo, nell'app selezionare Scanner → Aggiorna.

Il workflow gira anche automaticamente alle 07:17 e 18:17 (Europe/Rome), salvo ritardi della piattaforma. Usa fino a **3 chiamate API per esecuzione** per le date ieri, oggi e domani; verifica separatamente la quota disponibile.

### Quali dati pubblica
Solo calendario e risultati dei campionati per i paesi configurati, in `data/fixtures_latest.json`. Indica quante partite sono state effettivamente restituite dall'API; non dichiara copertura esaustiva. Il livello gratuito può limitare stagioni, mercati o incontri.

### Funzioni NON ancora abilitate
- Quote Bet365 verificate, scanner probabilistico, punteggi/value
- Piazzamenti REAL (mai automatici)
- LAB simulato e settlement automatizzato
- Backup cloud privato

La PWA presenta quindi la raccolta come **palinsesto automatico**, non come segnale di scommessa. Le vecchie candidate di ottobre restano separate e storiche.

## Struttura
- `index.html`, `assets/`, `manifest.webmanifest`, `service-worker.js`: app Android/PWA
- `data/seed.js`: archivio iniziale vuoto (pubblico)
- `data/fixtures_latest.json`: feed pubblico aggiornato dal workflow
- `scripts/collect-fixtures.mjs`: raccolta dati in Node 22
- `.github/workflows/scanner.yml`: pianificazione GitHub Actions

**Sicurezza:** la chiave è letta esclusivamente dal Secret in GitHub Actions, non viene salvata nei file pubblici né esposta in console.
