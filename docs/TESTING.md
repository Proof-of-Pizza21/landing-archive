# Collaudo di Landing Archive

Prove locali del 6 settembre 2026 su macOS con Node.js 24.13.0 e Chromium
tramite Google Chrome installato; prove Docker Linux amd64 del 7 settembre 2026
su GitHub Actions con Node.js 24.13.1 e il Chromium della versione Playwright
bloccata nel file di lock. Non sono misure del dispositivo Umbrel.

## Aggiornamento 0.1.14 — apertura attraverso il proxy Umbrel

Il 19 settembre 2026 sono riusciti localmente compilazione, controlli di tipo,
7 test sull’autenticazione e 2 prove browser mirate, con Node.js 24.20.0.
Il nuovo test riproduce la 0.1.13 escludendo i cookie dalle richieste fetch:
la navigazione iniziale riesce, il proxy rinvia l’API al login e l’interfaccia
mostra l’errore prima dell’accesso.

Con il client corretto, lo stesso proxy consente apertura, login, API private,
HTML offline, screenshot e uscita dall’account. Sono verificati rimozione del
cookie Umbrel prima dell’inoltro, rifiuto dei cookie come credenziale dell’app,
separazione tra porte, revoca dei ticket e mancato inoltro del Bearer alla
pagina di login del proxy quando scade la sessione Umbrel.
La prova usa un proxy locale che riproduce il comportamento del codice di
Umbrel 1.7.4, non un’installazione Umbrel effettiva. La pipeline della release
ripete l’intera suite e il collaudo dei container prima della pubblicazione.

## Aggiornamento 0.1.13 — sicurezza

Il 18 settembre 2026 il collaudo locale ha superato controlli di tipo,
compilazione, **117 test automatici e 16 prove nel browser**. Le nuove prove
comprendono isolamento delle sessioni tra porte, revoca dei ticket, download
nativi, HTML ostile aperto da disco, falsificazione della serializzazione durante
una cattura completa, immagini incorporate da 8 MiB, parser e scoperta con input
patologici, richieste HTTP interrotte e limiti per campo nel ripristino.

Il [workflow della release](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/35367855300)
ha ripetuto con successo i 117 test e le 16 prove browser su Linux, quindi ha
provato e pubblicato la medesima immagine amd64. Nei container reali sono
verificati il browser 153.0.8010.52 fissato per URL e SHA-256, sandbox attiva,
assenza del volume archivio dal worker, acquisizione, HTML offline, confronto,
backup/ripristino, persistenza, uscita dall’account e scansione dopo azzeramento.

L’immagine pubblica è stata verificata senza login: manifest, metadati e
disponibilità di tutti i 24 strati. L’inventario dello scanner corrisponde
all’identificatore dell’immagine pubblicata. Digest:
`sha256:129a5ae8db54e0061ac8ee48c462996bf2bb77ac1c033467c6c641b8fea433da`.

Le dipendenze npm non riportano vulnerabilità note e la scansione dell’immagine
non rileva segreti. L’inventario dei pacchetti di sistema contiene invece
398 corrispondenze e 228 identificatori distinti, di cui 224 CVE: 7 critiche,
79 alte, 149 medie e 163 basse. Nessuna voce indica una versione corretta
disponibile nella distribuzione al momento della scansione. Questo non equivale
all’assenza di rischio: [valutazione e limiti](SECURITY-0.1.13.md).
Il collaudo dell’aggiornamento sul dispositivo Umbrel effettivo resta distinto.

## Aggiornamento 0.1.12 — caricamenti, conferme e storia

Il 2026-09-16 sono passati localmente compilazione, controlli di tipo, **92 test
automatici e 12 prove browser** con Node.js 24.20.0 e Chrome su macOS.
Le sequenze simulate coprono copie complete/incomplete/recuperate, immagini
assenti e corrotte, sfondi CSS, font, testo differito, un prezzo nuovo con
risorse mancanti, conferme coerenti e distanziate, errori intermedi e testo
instabile. Sono verificati riferimento affidabile, ritorno A → B → A con riuso
dei file e mantenimento delle date nell’HTML esportato e nella navigazione offline.

L’azzeramento completo di un sito è verificato con conferma, anteprima scaduta,
origine/autenticazione, backup in corso, annullamento del worker e rifiuto dei
suoi risultati tardivi. Restano sito, impostazioni, note delle pagine e date dei
controlli; le vecchie versioni e le loro annotazioni vengono rimosse, i file
condivisi con altri siti restano, la nuova copia parte da un riferimento vuoto.
La UI verifica annullamento e conferma su telefono; il test Docker esegue anche
la scansione pulita successiva mentre il sito è in pausa.

La qualità dell’HTML viene controllata riaprendolo in un contesto separato senza
script e senza rete. Gli screenshot dei test UI sono stati ispezionati su desktop
e telefono. Sono verificati storico paginato oltre 1.000 controlli, varianti,
selezione inizialmente vuota nella pulizia, conferma, protezioni e anteprima
scaduta. Diagnostici: quota prima della scrittura, scadenza, limite per pagina,
file invalidi, accesso autenticato e guasti alla directory senza bloccare i controlli.

Backup e ripristino coprono lo schema 5 e un vero schema 4 privo delle nuove
colonne, riferimenti fra pagine rifiutati, qualità ed evidenze non valide,
conservazione del riferimento e azzeramento delle conferme dopo il ripristino.
Le prove Docker verificano inoltre la versione del motore, il protocollo di
qualità, la copia offline, la protezione della prima evidenza e il backup schema 5.

La build preparatoria 0.1.11 superava i test funzionali ma riportava ancora
0.1.10 nell’etichetta OCI. Non è stata aggiunta al community store. La 0.1.12
allinea i metadati e verifica automaticamente la coerenza fra pacchetto,
motore e immagine prima della pubblicazione.

Le prove locali non sono un monitoraggio di 48 ore dei siti dell’utente né una
misura del dispositivo Umbrel. Il [collaudo Linux della release](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/35118902075)
è riuscito: 92 test automatici, 12 prove browser e container reali con sandbox,
acquisizione, confronto, backup/ripristino e scansione dopo azzeramento.
L’immagine pubblica è stata verificata senza login, incluso l’accesso ai 23 strati,
e coincide con l’inventario di sicurezza della pipeline. Digest:
`sha256:13475adf6db84a396a4bbfab286389cb35a2c349d5204d88a6987c535ecb262e`.
L’inventario contiene 397 segnalazioni e 228 CVE distinte: zero vulnerabilità
alte o critiche correggibili e zero segreti. Questo non equivale ad assenza
di vulnerabilità.

## Aggiornamento 0.1.10 — novità, raccolta e ripristino

Il 2026-09-14 sono riusciti localmente controlli di tipo, compilazione,
**62 test automatici e 8 prove browser** con Node.js 24.20.0. I test verificano
filtri e lettura eventi senza perdita dello storico, annotazioni sulla copia
esatta, normalizzazione dei tag, ricerca combinata, navigazione dei risultati,
layout desktop e telefono e consultazione del sito esportato senza traffico live.

Il ripristino è verificato con backup valido e schema 3, file alterati,
metadati errati, duplicati, percorsi estranei, viste SQL, colonne calcolate nelle
impostazioni e riferimenti incoerenti. SQLite usa un limite nativo di 64 MiB
nel processo separato. La build preparatoria 0.1.9 non è stata aggiunta al community store;
lo store passa direttamente dalla 0.1.8 alla 0.1.10.
Sono controllati autenticazione, origine, conferma/password, limiti dei blocchi,
sospensione delle altre operazioni, annullamento e ripristino della transazione
dopo un errore simulato. La copia di sicurezza conserva i dati sostituiti;
account corrente, note, tag e stato di lettura sopravvivono al ripristino.
La migrazione allo schema 4 rimane additiva. I test Docker includono caricamento,
verifica nel processo separato, sostituzione, copia di sicurezza e riavvio.
Il [collaudo Linux della release](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34868831680)
è riuscito il 2026-09-14: 62 test automatici, 8 prove browser e prove complete
dei container, incluso un ripristino reale con annotazioni e copia di sicurezza.
Il 2026-09-15 sono stati verificati senza login metadati e disponibilità dei 23
strati dell’immagine pubblica, corrispondenti all’inventario di sicurezza.
Digest: `sha256:97bda6fee9ed1145ddb09d9739de52ee6ac20b63bb8478c3aa854b4bbdc455a7`.
Inventario della build: 397 segnalazioni, 228 CVE distinte, zero segreti e zero
vulnerabilità alte o critiche correggibili. Non equivale all’assenza di
vulnerabilità. Il collaudo dell’aggiornamento sul dispositivo Umbrel resta distinto.

## Aggiornamento 0.1.8 — confronto, qualità e vita delle landing

Il 2026-09-14 sono riusciti localmente i controlli di tipo, la compilazione,
**53 test automatici e 7 prove browser**, con Node.js 24.20.0. Le prove aggiunte
verificano spostamenti di due pixel, altezza variabile, modifiche visive reali,
zone importanti piccole, esclusioni, parametri pubblicitari e varianti reali,
immagini mancanti, tentativi di qualità limitati, prezzi e ritorni A → B → A.

Sono verificate la migrazione additiva allo schema 3, la conservazione delle
copie, la selezione tramite clic, l’anteprima di due versioni, i controlli di
accesso alle regole, la cadenza della scoperta e i filtri di percorso. Le letture
sitemap parziali non fanno scomparire pagine; due risposte 404/410 e un recupero
aggiornano le categorie mantenendo lo storico. Gli screenshot desktop e telefono
sono stati ispezionati; le copie nell’editor non eseguono script né richieste esterne.

Il [collaudo Linux della release](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34835300152)
è riuscito il 2026-09-14, compresi browser con sandbox, acquisizione reale,
confronto su 12 milioni di pixel, archivio invariato senza duplicati, backup,
riavvio, cancellazione e protezioni della rete interna. Verificata anche una
migrazione con lo schema reale della 0.1.7 e file storici: account, note e copie
conservati, nessun duplicato per il solo cambio di un parametro pubblicitario.

Immagine pubblica `sha256:cdf09865c06931405eec31c2162f7d42303b8c2975729e6fe651654db3fc2483`: metadati,
piattaforma e 23 strati scaricabili verificati senza login. L’inventario coincide
con l’immagine pubblicata: 398 segnalazioni, 229 CVE distinte, zero segreti e zero
vulnerabilità alte o critiche correggibili. Questo non equivale all’assenza di
vulnerabilità. Il collaudo sul dispositivo Umbrel rimane distinto.

## Aggiornamento 0.1.7 — modifiche evidenziate

Controlli di tipo, compilazione, **49 test automatici e 5 prove browser**
riusciti localmente con Node.js 24.20.0. I nuovi test localizzano due zone
separate, verificano allineamento e bordi di un pixel, input corrotti e limiti,
annullamento, corrispondenza con il rilevatore esistente e compatibilità delle
firme storiche. Il riepilogo distingue variazioni di testo, metadati e soli
parametri degli indirizzi.

La prova browser verifica evidenziazione attivabile, navigazione fra zone,
scorrimento sincronizzato, differenze di testo, metadati senza variazioni
visive e layout a 390 pixel. L’API richiede autenticazione, rifiuta versioni
di pagine diverse, limita le elaborazioni contemporanee e non crea oggetti o
versioni nell’archivio. La prova Docker include il calcolo su screenshot da
12 milioni di pixel e il nuovo endpoint autenticato.

Il [collaudo Linux della release](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34781450322) è riuscito il 2026-09-13:
49 test automatici, 5 prove browser e prove complete dei container, compreso
il confronto evidenziato su immagini da 12 milioni di pixel.

Immagine pubblica `sha256:ccf753e8c20d053bd8c48ebb3390955ea00be0d3d2374838cbbe213ac3271ce8` verificata senza credenziali,
compresi metadati, disponibilità di 23 strati e corrispondenza dell’inventario.
La scansione ha rilevato zero segreti e zero vulnerabilità alte o critiche
correggibili. L’inventario contiene 396 segnalazioni e 228 CVE distinte; non equivale
all’assenza di vulnerabilità. Il collaudo sul dispositivo Umbrel rimane distinto.

## Aggiornamento 0.1.6 — vista offline

La preparazione 0.1.4 è stata fermata dal controllo Linux per un riferimento
errato a una dipendenza; nessuna immagine o aggiornamento dello store è stato
distribuito per quella versione. La 0.1.5 ha superato i test Linux, ma il controllo di pubblicazione era ancora
limitato alla 0.1.3. La 0.1.6 corregge entrambi i riferimenti e verifica il
rilascio rispetto alla versione del pacchetto, all’identità e al repository.
L’installazione pulita dal file di lock è stata verificata.

Controlli di tipo, compilazione, **44 test automatici e 4 prove browser** riusciti
localmente. La nuova prova apre documenti archiviati con contenuti ostili,
verifica il blocco di script e traffico live, naviga fra copie con date diverse,
controlla ancore, link mancanti, ritorno indietro e interfaccia mobile.
Sono verificati anche autenticazione, intestazioni di sicurezza e limiti di
complessità. Il test dei container include la vista offline autenticata.
Il [collaudo Linux della release](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34747984632) è riuscito il 13 settembre 2026:
44 test automatici, 4 prove browser, riproduzione del blocco AppArmor e prove
complete dei container, compresa la nuova vista offline autenticata.

Immagine pubblica `sha256:0236c013c031198f74089db38f9a80b9473b9d782683d4ba1b1010afadd9f359` verificata senza credenziali,
compresi metadati, disponibilità di 23 strati e corrispondenza dell’inventario.
La scansione ha rilevato zero segreti e zero vulnerabilità alte o critiche
correggibili. L’inventario contiene 396 segnalazioni e 228 CVE distinte; non equivale
all’assenza di vulnerabilità. Il collaudo dell’aggiornamento sul dispositivo
Umbrel resta distinto dalle prove automatiche.

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
