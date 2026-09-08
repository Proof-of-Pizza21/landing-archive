# Collaudo della prima versione

Prove locali del 6 settembre 2026 su macOS con Node.js 24.13.0 e Chromium
tramite Google Chrome installato; prove Docker Linux amd64 del 7 settembre 2026
su GitHub Actions con Node.js 24.13.1 e il Chromium della versione Playwright
bloccata nel file di lock. Non sono misure del dispositivo Umbrel.

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

## Container Linux amd64: prove completate

Il [workflow 34147293202](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34147293202) è riuscito sul commit `f74053e`.
Il runner Ubuntu 22.04 ha eseguito controlli di tipo, test automatici,
compilazione e regressione browser, poi costruito e provato l'immagine Docker
`linux/amd64`. Le verifiche sui container effettivi comprendono:

- Avvio sano di app e worker con utente `1000:1000`, filesystem radice in sola
  lettura, restrizioni del Compose distribuito e archivio del worker in sola lettura.
- Configurazione iniziale dell'account, accesso autenticato, cookie HttpOnly e
  SameSite Strict, rifiuto di una seconda configurazione iniziale.
- Blocco degli indirizzi privati dalle API dell'app e del worker, rifiuto di
  operazioni del worker senza token e di richieste malformate; scrittura del
  worker nell'archivio impedita dal volume in sola lettura.
- Avvio e rendering di Chromium con sandbox Linux attiva.
- Acquisizione reale di `https://example.com/` tramite il worker: screenshot PNG,
  copia HTML senza script eseguibili e lettura in un browser con rete e
  JavaScript disattivati.
- Seconda acquisizione invariata registrata come nuovo controllo, conservando
  una sola versione.
- Esportazione ZIP, riapertura del database esportato e verifica degli hash dei
  file: versione presente, sessioni attive e token del worker esclusi dal backup.
- Riavvio di app e worker con conservazione della versione, dei due controlli e
  dell'accesso; uscita dall'account e nuovo login verificati.

Queste prove usano soltanto una pagina pubblica di esempio e un account temporaneo.
Credenziali e copie acquisite non vengono caricate come artefatti del workflow.
Il workflow di release ripete le prove sui container prima di pubblicare
l'immagine `ghcr.io/proof-of-pizza21/landing-archive:0.1.0`.

## Anteprima Umbrel: verifiche ancora necessarie

La release è destinata a umbrelOS 1.7.4 su mini PC Intel/AMD a 64 bit. Il collaudo
Docker del runner usa il Compose locale e un volume dedicato; non verifica
l'installazione del pacchetto attraverso l'interfaccia Umbrel.

Restano da provare sul mini PC: sandbox Chromium sul kernel effettivo, permessi
del volume creato da Umbrel, accesso attraverso il proxy, installazione pulita,
riavvio del dispositivo, aggiornamento e ripristino. Il supporto ARM non fa parte
di questa anteprima. Consumi e tempi del runner non sono stime del mini PC.

La [release 0.1.0](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34149224656) ha ripetuto con successo tutte le prove e pubblicato l'immagine
del commit `4cbc8e6`. Il download anonimo dal registro, l'architettura amd64,
i metadati pubblici e il digest sono stati verificati il 7 settembre 2026.
Il pacchetto dello store usa `sha256:beb2bfd0c0c79bf632457f753fe8ee05a6bfbbc33c93719483db73e055cd3cd7`.

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
