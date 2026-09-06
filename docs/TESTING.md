# Collaudo della prima versione

Data: 6 settembre 2026. Prove eseguite su macOS con Node.js 24.13.0 e Chromium
tramite Google Chrome installato. Non sono misure del dispositivo Umbrel.

## Verifiche completate

- Compilazione TypeScript e interfaccia di produzione riuscite.
- 23 verifiche automatiche: accesso, protezione da richieste esterne, indirizzi
  privati bloccati, storico A → A → B → A, deduplicazione, due risposte 404,
  ritorno online, annotazioni, confronto, ricerca e download dei file.
- Backup ZIP ripristinato in un database separato: integrità SQLite verificata,
  versioni e file presenti, sessioni di accesso eliminate dal backup.
- Coda persistente verificata con motore simulato: riavvio, recupero di un
  lavoro interrotto, pausa e nuovo tentativo dopo errore temporaneo.
- Un test aggiuntivo nel browser verifica il testo realmente visibile: campi
  antispam nascosti, elementi trasparenti, aree ritagliate a un pixel e selettori
  esclusi non alterano il confronto. I contenuti visibili restano inclusi.
- Prova completa con app e motore in due processi distinti: account creato
  dall'interfaccia, tre siti pubblici acquisiti, copie consultate dalla timeline,
  confronto, note e download del backup utilizzati dal browser.
- Due visite consecutive al primo sito, dopo la correzione dei campi invisibili,
  hanno prodotto un controllo invariato senza creare un'altra versione.
- Copie HTML aperte con rete e JavaScript disattivati: rispettivamente 10/10,
  18/18 e 35/35 immagini caricate; nessun elemento script conservato. Verificati
  visivamente screenshot e copie offline, incluso il font del secondo sito.
- Scoperta automatica del primo sito: otto indirizzi tramite sitemap e link,
  con limite di dieci, senza avvisi, in circa dodici secondi.
- Controllo dell'interfaccia desktop e dei comandi da telefono, senza errori
  JavaScript o allargamento della pagina oltre lo schermo.
- File YAML del pacchetto e profilo Chromium validati staticamente.

I dati e le credenziali usati nelle prove restano nella directory locale esclusa
dalla distribuzione. Non vengono inclusi negli ZIP del sorgente o nelle immagini.

## Limiti osservati

Le catture reali hanno richiesto indicativamente 14–36 secondi per pagina sul
computer di prova. Le tre copie complete occupano circa 3,7, 4,0 e 13,8 MB.
Sono campioni, non garanzie di consumo o fedeltà su altri siti.

Alcuni siti inviano richieste di tracciamento o hanno risorse non disponibili:
l'acquisizione può riuscire con avvisi. L'app conserva questi avvisi nella
versione. Video, form e contenuti incorporati non sono copie interattive.
Il caricamento è limitato nel tempo e lo screenshot a 20.000 pixel di altezza.

Il browser riparte con un contesto nuovo a ogni visita. Cookie, personalizzazione,
animazioni e test A/B possono far osservare varianti diverse anche senza una
modifica definitiva della pagina. Non vengono dedotti risultati di conversione.

I controlli leggono nuovamente la pagina per rilevare differenze; è il salvataggio
di nuove versioni a essere evitato quando la pagina è invariata. Non è un sistema
che evita tutti i download di rete su pagine immutate.

## Anteprima Umbrel: verifiche ancora necessarie

Docker non è disponibile sul computer di collaudo. Build e prove dei container
saranno eseguite su Linux tramite GitHub Actions per `linux/amd64`. La prima
release è un'anteprima destinata a umbrelOS 1.7.4 su mini PC AMD; il collaudo
sul dispositivo resta distinto dalle prove dei runner.

Restano da provare sul mini PC: sandbox Chromium sul kernel effettivo, permessi
del volume, accesso attraverso il proxy Umbrel, installazione pulita, riavvio
del dispositivo, aggiornamento e ripristino. Il supporto ARM non fa parte
di questa anteprima.

Le immagini pubbliche, il relativo digest e il community store non sono ancora
pubblicati. Il manifest è un pacchetto preparatorio. La disponibilità di immagini
Node per due architetture non dimostra che l'app sia già stata collaudata su entrambe.

## Ripetere le prove di sviluppo

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:browser
```

L'ultimo comando richiede Chromium installato da Playwright o un eseguibile
configurato con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Le prove automatiche usano
dati temporanei; le acquisizioni pubbliche non vengono avviate da questi comandi.
