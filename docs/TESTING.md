# Collaudo di Landing Archive

Prove locali del 6 settembre 2026 su macOS con Node.js 24.13.0 e Chromium
tramite Google Chrome installato; prove Docker Linux amd64 del 7 settembre 2026
su GitHub Actions con Node.js 24.13.1 e il Chromium della versione Playwright
bloccata nel file di lock. Non sono misure del dispositivo Umbrel.

## Aggiornamento 0.1.3 — 9–10 settembre 2026

Controlli di tipo, compilazione e **41 test automatici** riusciti. I nuovi casi
riproducono un errore di avvio sandbox, verificano il nuovo tentativo e accertano
che argomenti, URL e segreti non entrino nei messaggi o nei log di diagnostica.
La nuova prova Docker richiede AppArmor 4, nega `userns` in un profilo temporaneo
e verifica poi il funzionamento del profilo dedicato. Gli esiti Linux vengono
registrati nel [workflow riuscito](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34440663040).

Sono riuscite anche le 3 prove browser, la riproduzione del blocco AppArmor,
il caricamento ripetuto del profilo dedicato e tutte le prove dei container:
acquisizione reale, copia offline, controlli manuali, backup, riavvio ed eliminazione.
Il worker effettivo usa `landing-archive-worker` con sandbox Chromium attiva.

Immagine pubblica `sha256:e8cab2dd89b4f74ad251793f4328fbac98a9a7ad534e82ea185799ce76a9dfdf` verificata senza credenziali,
compresi metadati, disponibilità di 22 strati e corrispondenza dell’inventario.
La scansione ha rilevato zero segreti e zero vulnerabilità alte o critiche
correggibili. Restano 392 segnalazioni, 225 CVE distinte e 79 segnalazioni alte o critiche senza correzione disponibile secondo lo scanner.
Il collaudo dell’aggiornamento direttamente sul dispositivo Umbrel resta da
completare; il blocco iniziale era stato confermato dai log del dispositivo.

## Aggiornamento 0.1.2 — 9 settembre 2026

Con Node.js 24.20.0: **39 test automatici** riusciti, compilazione completata e
**3 prove nel browser** riuscite. I nuovi casi verificano priorità manuale,
controlli durante la pausa, riavvio di lavori bloccati, rifiuto dei risultati
arrivati dopo un'interruzione, cancellazione dei soli file non condivisi,
protezione durante il backup e aggiornamento della coda dal vecchio schema.

La regressione nel browser verifica reindirizzamenti di pagine e risorse,
collegamenti relativi basati sull'indirizzo finale e blocco dei reindirizzamenti
verso reti private. L'interfaccia è provata a 1.440 e 390 pixel, inclusa la
conferma di eliminazione e l'assenza di scorrimento orizzontale della pagina.

Un'acquisizione pubblica riproduceva `ERR_PROXY_CONNECTION_FAILED` prima della
correzione. La stessa pagina ha poi prodotto HTML e screenshot con HTTP 200
in circa 7 secondi sul computer locale. Indirizzo e copie rimangono esclusi dal
repository. Anche altri due siti pubblici di prova hanno prodotto HTML e
screenshot con HTTP 200; le relative copie rimangono locali.

Il [workflow di release](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34382062197)
ha ripetuto con successo controlli di tipo, 39 test, 3 prove browser e build
sul commit `fec5177`, quindi ha provato e pubblicato l’immagine Linux amd64.
I container hanno superato le prove di sandbox, autenticazione, reti private,
acquisizione reale, controllo manuale durante la pausa, deduplicazione, backup,
riavvio e cancellazione confermata.

La scansione dell’immagine ha rilevato zero segreti e zero vulnerabilità alte
o critiche con correzioni disponibili. Rimangono 390 segnalazioni su pacchetti,
223 CVE distinte, di cui 79 segnalazioni alte o critiche senza correzione
disponibile secondo lo scanner: non equivale ad assenza di vulnerabilità.

Sono stati verificati il download anonimo, manifest, metadati e disponibilità
di tutti i 21 strati dell’immagine. L’inventario delle vulnerabilità corrisponde
alla configurazione pubblicata; versione, sorgente e identità sono corretti.
Lo store 0.1.2 usa `sha256:3fda9f79f7aabe03241c4b523fdef870636f839ffcaf77cd3ec87050d0823f9b`.
Il collaudo direttamente sul dispositivo Umbrel resta da completare.

## Aggiornamento 0.1.1 — 9 settembre 2026

Il [workflow di release](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34314394725)
ha verificato e pubblicato il commit `984ebaf`, con Node.js 24.20.0 e il browser
del lockfile. Controlli di tipo, compilazione, **31 test automatici** e regressione
nel browser sono riusciti, sia localmente sia su Linux. Le nuove prove coprono
l'accesso alle rotte codificate, i limiti di immagini e metadati, le risposte del
worker, le regole robots.txt e il recupero dei lavori interrotti.

L'immagine distribuita ha ripetuto tutte le prove Docker elencate sotto, compreso
il confronto di due immagini da 12 milioni di pixel nel container web con limite
di 1 GiB, verificandone poi lo stato di salute. La scansione Trivy ha rilevato
**zero segreti e zero vulnerabilità alte o critiche con correzioni disponibili**.
Rimangono 390 segnalazioni su pacchetti, corrispondenti a 223 CVE distinte;
79 segnalazioni sono alte o critiche senza una correzione disponibile secondo lo
scanner. Questo risultato non equivale all'assenza di vulnerabilità: le librerie
native richiedono ancora valutazione e aggiornamenti quando disponibili.

Il download anonimo dei manifest, dei metadati e la disponibilità di tutti i 21
strati dell'immagine sono stati verificati il 9 settembre. Architettura, versione,
revisione sorgente e identità pubblica corrispondono alla release. Il pacchetto
0.1.1 usa `sha256:a411e0cd6407bccaffd35f406c4198acf9ed14a49bffc0cca7692f89b8272779`.
Il collaudo di installazione e aggiornamento sul dispositivo Umbrel resta da
completare. I [limiti introdotti](SECURITY-0.1.1.md) sono documentati separatamente.

## Verifiche della prima versione

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
Il caricamento è limitato nel tempo. Dalla versione 0.1.1 lo screenshot ha
limiti su larghezza, altezza e numero totale di pixel; vedere
[SECURITY-0.1.1.md](SECURITY-0.1.1.md).

Il browser riparte con un contesto nuovo a ogni visita. Cookie, personalizzazione,
animazioni e test A/B possono far osservare varianti diverse anche senza una
modifica definitiva della pagina. Non vengono dedotti risultati di conversione.

I controlli leggono nuovamente la pagina per rilevare differenze; è il salvataggio
di nuove versioni a essere evitato quando la pagina è invariata. Non è un sistema
che evita tutti i download di rete su pagine immutate.

## Container Linux amd64: prima versione

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
Il pacchetto 0.1.0 usava `sha256:beb2bfd0c0c79bf632457f753fe8ee05a6bfbbc33c93719483db73e055cd3cd7`.

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
