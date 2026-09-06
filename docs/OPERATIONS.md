# Gestione dell'archivio

## Frequenza e scoperta delle pagine

Partire con controlli ogni 6 ore e ricerca di nuove pagine ogni 24 ore. Aumentare
la frequenza solo sulle landing che cambiano spesso. Le visite sono seriali:
un elenco ampio può richiedere più tempo di quello indicato dall'intervallo.
Un controllo ogni 6 ore non può vedere una pagina pubblicata e rimossa fra due
visite.

Sitemap e collegamenti permettono di trovare molte pagine, ma non rivelano
necessariamente le landing usate solo negli annunci. Gli indirizzi trovati in
newsletter, social o librerie annunci possono essere aggiunti manualmente.
Non provare a indovinare directory riservate o aggirare restrizioni di accesso.

Un errore temporaneo non dimostra che una pagina sia scomparsa. Una risposta
404/410 ripetuta è un segnale distinto da timeout, errori 5xx, CAPTCHA o blocchi
anti-bot. I redirect meritano attenzione: la pagina può aver cambiato indirizzo
oppure essere stata sostituita da una nuova campagna.

## Cosa contiene una versione

Lo screenshot registra l'aspetto osservato dal browser desktop. La copia HTML
conserva le risorse che SingleFile è riuscito a incorporare. Il testo permette
di confrontare messaggi, offerte e intestazioni. Immagini, font o contenuti
caricati da servizi esterni possono mancare se il sito ne impedisce il recupero.

Le vecchie versioni non vengono sovrascritte da un errore. Due catture identiche
possono condividere i file, ma ogni controllo ha la propria data: il ritorno da
B ad A è un nuovo evento nello storico. La data è quella dell'osservazione,
non quella certa della modifica sul sito originale.

Animazioni, caroselli, contatori, popup e annunci possono causare rumore. I
selettori da ignorare aiutano a concentrarsi sulle parti rilevanti. Non ignorare
prezzi o offerte solo per ridurre le segnalazioni: si perderebbe proprio il
cambiamento che si vuole osservare.

## Spazio e limiti

La prima versione conserva tutte le copie e non offre ancora l'eliminazione
selettiva dall'interfaccia. Non cancella l'archivio in automatico.
La soglia iniziale di riserva disco è 5 GiB
(circa 5,4 GB):
va intesa come protezione d'emergenza, non come spazio operativo consigliato.
Controllare lo spazio dall'interfaccia e dall'area storage di Umbrel e mantenere
un margine molto più ampio per il sistema e le altre applicazioni.

Esempio di dimensionamento, non misura delle pagine reali: 100 pagine con una
nuova versione da 5 MB al giorno producono circa 183 GB all'anno. Il numero
effettivo dipende soprattutto dalle modifiche conservate e dalle risorse
incorporate; il controllo senza modifiche non richiede altre copie complete.

La composizione Docker assegna al worker un limite di 3 GB e 2 CPU logiche e
all'app 1 GB e 1 CPU logica. Una singola pagina pesante può comunque esaurire il
limite. Un errore di memoria va analizzato e registrato; non deve cancellare
le copie precedenti. I limiti sono modificabili nel pacchetto per il collaudo,
ma la loro efficacia va misurata sul dispositivo.

## Backup e ripristino

L'esportazione ZIP dall'interfaccia produce una copia coerente del database e
dei file referenziati, anche con l'app attiva. Include `archive.sqlite`, la
directory `objects/` e `manifest.json`. Conserva l'account e la password sotto
forma di hash; revoca le sessioni nella copia esportata e non include il token
interno del worker, che sarà rigenerato al ripristino. L'archivio ZIP non è
cifrato: conservarlo come dato privato, su un supporto protetto.

Per ripristinare un'esportazione ZIP:

1. Verificare che il file sia integro e che `manifest.json` indichi la versione
   prevista. Conservare una seconda copia del ZIP prima di intervenire.
2. Arrestare app e worker. Ripristinare su un'installazione vuota della stessa
   versione o conservare separatamente tutti i dati dell'installazione esistente;
   non mescolare il vecchio database con un'altra directory di oggetti.
3. Estrarre `archive.sqlite` e l'intera directory `objects/` direttamente nella
   directory dati vuota. `manifest.json` è informativo. Non ripristinare file
   SQLite `-wal` o `-shm` di un'altra installazione né vecchi token o sessioni.
4. Assicurare la proprietà UID/GID `1000:1000` dei file e delle directory
   estratti nel volume Docker/Umbrel. Non usare permessi scrivibili da chiunque.
5. Riavviare prima l'app e poi il worker, come gestito dal Compose. L'app genera
   il token mancante e le directory temporanee. Accedere con il nome utente e
   la password originali; i dispositivi precedentemente collegati devono
   effettuare nuovamente il login.
6. Controllare alcuni siti, versioni e screenshot prima di riprendere il
   monitoraggio normale. Le pianificazioni sono incluse nel database, quindi
   le attività scadute possono ripartire dopo il riavvio.

La prima versione non offre un pulsante per importare il ZIP. Il ripristino è
un'operazione amministrativa sul volume dati, da collaudare prima della release.
Non caricare l'esportazione nel community store e non copiarla dentro i sorgenti.

### Copia completa del volume

Salvare su un altro disco l'intera directory persistente, inclusi database,
file acquisiti e segreti. Copiare soltanto i file HTML perde la timeline e le
impostazioni. Copiare solo il database perde le pagine archiviate. Un backup
sullo stesso SSD non protegge dal guasto del disco.

Su Umbrel i dati sono in `${APP_DATA_DIR}/data`. Non sono esclusi dai backup
dell'app. Prima di una copia manuale arrestare l'app e il worker dall'interfaccia
Umbrel, copiare l'intera directory con proprietario e permessi, poi riavviare.
Per il Compose locale usare `docker compose stop` prima del backup del volume
e `docker compose up -d` dopo. Una copia dei file SQLite durante una scrittura
può essere incoerente; l'arresto evita questo caso.

Provare il ripristino in un'installazione separata prima di affidarsi a un
backup. Per una copia completa del volume, arrestare i servizi, ripristinare
tutti i dati con UID/GID `1000:1000`,
avviare la stessa versione dell'app e verificare login, conteggio delle versioni
e apertura di alcune catture. Solo in seguito aggiornare. Non mettere la
directory del backup in un repository o nell'immagine Docker.

## Riavvii e aggiornamenti

Le impostazioni e i controlli pianificati sono dati persistenti, non attività
cron del sistema Umbrel. L'avvio prima prepara il database e i segreti, poi
rende disponibile il worker. I container ricevono SIGTERM e hanno 90 secondi
per terminare; l'opzione `init` aiuta a raccogliere i processi browser figli.

Prima di un aggiornamento creare un backup. In sviluppo, ricostruire l'immagine
con `docker compose up --build -d`. Nello store, usare gli aggiornamenti Umbrel
solo quando una release con immagine verificata è disponibile. Non effettuare
un downgrade del database senza indicazioni esplicite di compatibilità.

## Diagnosi

| Sintomo | Cosa verificare |
| --- | --- |
| Nessuna acquisizione parte | Stato worker, coda, prossima esecuzione e spazio libero |
| Browser non si avvia | Versione Playwright coerente con i browser installati, user namespace Linux e seccomp |
| Cattura bianca o parziale | Cookie banner, caricamento lento, blocco anti-bot, risorse esterne |
| Continui cambiamenti | Caroselli, date dinamiche, contenuti personalizzati, selettori da ignorare |
| Permesso negato nei dati | Proprietà della directory persistente `1000:1000` dopo un ripristino |
| Immagine dello store non trovata | Pacchetto ancora in preparazione oppure immagine non pubblicata: non è un errore dell'archivio |

Nel collaudo locale, `docker compose ps` mostra lo stato dei container e
`docker compose logs --tail=100 web worker` gli ultimi messaggi. I log possono
contenere URL monitorati: rimuoverli insieme a token e percorsi locali prima di
condividerli. Non inviare il database o una copia dell'archivio per segnalare
un problema.

## Isolamento

L'app serve l'interfaccia; il worker visita i siti esterni. Il worker non riceve
accesso in scrittura al volume persistente, ma può leggere il token interno
necessario alle operazioni. Entrambi eseguono il processo come utente non root,
senza capability aggiuntive. Il worker richiede l'isolamento Chromium; il profilo
seccomp permette i namespace previsti dalla documentazione Playwright.

Il profilo incluso deriva da Playwright 1.63.0. Sono documentate nel JSON due
modifiche per runtime recenti: `clone3` restituisce ENOSYS, permettendo il fallback
a `clone`, e sono ammesse `close_range`, `epoll_pwait2`, `faccessat2`, già presenti
nel profilo Docker corrente. Queste impostazioni vanno verificate sul kernel
Umbrel; non usare `seccomp=unconfined` o privilegi host per far partire una
cattura fallita.

Nel pacchetto il sorgente è `seccomp-profile.json.template`: a ogni avvio o
aggiornamento Umbrel lo rende come `seccomp-profile.json`, usato dai container.
Per aggiornare il profilo modificare il template distribuito, non l'output
generato nella directory dell'app installata. Il template non contiene
variabili e può essere letto direttamente come JSON dal Compose locale.

Riferimenti: [Docker con Playwright](https://playwright.dev/docs/docker),
[profilo Playwright originale](https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/seccomp_profile.json),
[profilo Docker corrente](https://github.com/moby/profiles/blob/main/seccomp/default.json).
