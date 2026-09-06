# Installazione e preparazione della distribuzione

Questa prima versione è un'anteprima per mini PC Intel/AMD a 64 bit
(`linux/amd64`), con umbrelOS 1.7.4 come ambiente di destinazione. L'immagine e il
pacchetto dello store sono in preparazione per il primo collaudo. ARM sarà
valutato in una release successiva; non è necessario per il mini PC AMD.

Le destinazioni della release sono il repository applicativo
[Landing Archive](https://github.com/Proof-of-Pizza21/landing-archive) e il
[community store](https://github.com/Proof-of-Pizza21/umbrel-community-store).
L'installazione dallo store richiede che l'immagine prevista sia pubblica e
che il pacchetto contenga il suo digest verificato.

## Prova locale con Docker

Richiede Docker Engine o Docker Desktop e il plugin Compose già installati. Non
è necessario eseguire l'app come amministratore, installare un database o avviare
un servizio browser esterno.

Dalla cartella del progetto:

```sh
docker compose config
docker compose up --build -d
docker compose ps
```

Apri `http://localhost:4310`, crea un nome utente e una password di almeno
12 caratteri e aggiungi il primo sito. La password non è predefinita e non viene
inserita nel manifest. L'app
genera i segreti persistenti al primo avvio; il worker attende che l'app sia
pronta e legge il token interno dal volume condiviso in sola lettura.

Il primo build scarica Chromium e le librerie di sistema. Non include gli URL
di collaudo o le copie già presenti sul computer. Se il browser non riesce a
creare il proprio isolamento Linux, la cattura deve fallire: non aggiungere
`--no-sandbox`, privilegi amministrativi o il socket Docker per aggirare l'errore.
Verificare il kernel e il profilo seccomp prima di considerare l'ambiente pronto.

La porta locale è limitata a `127.0.0.1`. Questa impostazione evita che una
postazione di sviluppo appena avviata esponga la configurazione iniziale a tutta
la rete. Per Umbrel usare il pacchetto con `app_proxy` descritto sotto.

Per fermare i servizi conservando l'archivio:

```sh
docker compose stop
```

Per ripartire:

```sh
docker compose up -d
```

Il volume denominato `archive` conserva database, segreti e acquisizioni.
`docker compose down` conserva il volume; aggiungere `--volumes` lo elimina e
quindi distrugge i dati. Non usarlo come procedura di aggiornamento.

## Sviluppo senza container

Sono necessari Node.js 24.13.1 o successivo della linea 24, npm e le dipendenze
di sistema di Chromium. Installazione e compilazione:

```sh
npm ci
npx playwright install chromium
npm run build
```

Su Linux, se mancano le librerie del browser, utilizzare il comando ufficiale
`npx playwright install --with-deps chromium` su una macchina di sviluppo
dedicata. Non modificare manualmente il sistema operativo Umbrel per questa
modalità: il pacchetto Docker include già le librerie.

Avviare app e worker in due terminali dalla stessa cartella, usando la stessa
directory dati e porte separate. Le variabili sono riportate sotto. Questa
modalità è destinata allo sviluppo, non sostituisce i due servizi del pacchetto.

| Variabile | Servizio | Valore del pacchetto |
| --- | --- | --- |
| `HOST` | Entrambi | `0.0.0.0` nei container; usare `127.0.0.1` in sviluppo |
| `PORT` | App | `4310` |
| `PORT` | Worker | `4311` |
| `DATA_DIR` | Entrambi | `/data` nei container; stessa directory locale in sviluppo |
| `CAPTURE_WORKER_URL` | App | `http://worker:4311` in Compose locale |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Worker | Facoltativo; normalmente non impostato |
| `MIN_FREE_GIB` | App | `5`; riserva minima disco in GiB |

## Pacchetto community store Umbrel

La directory `umbrel-community-store/` contiene il futuro contenuto della radice
di un repository dedicato allo store. L'identificatore dello store è
`proof-of-pizza21`, quello dell'app è
`proof-of-pizza21-landing-archive`; devono rimanere stabili dopo la prima
installazione.

Il pacchetto segue il [template ufficiale Umbrel](https://github.com/getumbrel/umbrel-community-app-store)
e le [indicazioni di packaging](https://github.com/getumbrel/umbrel-apps/blob/master/.claude/skills/umbrel-package-app/SKILL.md):

- `app_proxy` presenta l'interfaccia e mantiene attiva l'autenticazione Umbrel.
- L'app e il worker sono servizi distinti, eseguiti come utente `1000:1000`.
- Tutti i dati persistenti sono in `${APP_DATA_DIR}/data`.
- Il worker non espone porte host e deve autenticare ogni operazione interna.
- Non sono richiesti socket Docker, rete host, dispositivi o privilegi aggiuntivi.
- Il worker usa un profilo seccomp per l'isolamento Chromium e 512 MB di memoria
  condivisa privata; non condivide l'IPC con il sistema host.

Il profilo è distribuito come `seccomp-profile.json.template` nella radice del
pacchetto. Umbrel copia i template anche durante gli aggiornamenti e produce
`seccomp-profile.json` prima dell'avvio; il Compose Umbrel usa questo output.
Il file non contiene variabili e la sostituzione non ne cambia il contenuto.
Il Compose locale legge direttamente il template, che è già JSON valido.
Questo evita di lasciare un vecchio profilo installato dopo un aggiornamento.

L'immagine prevista è `ghcr.io/proof-of-pizza21/landing-archive:0.1.0`.
La prima build destinata al collaudo è per `linux/amd64`. Il Compose dello store
riporta il tag senza un digest inventato; prima della distribuzione entrambe
le righe devono diventare
`ghcr.io/proof-of-pizza21/landing-archive:0.1.0@sha256:<digest-verificato>`.

La porta esterna prevista è `4310`; va controllata sul dispositivo e rispetto
alle app installate. Il manifest include le destinazioni del repository, del
supporto e dell'icona, da verificare dopo la pubblicazione. L'icona SVG originale
è presente in `assets/icon.svg`.

## Verifiche che precedono la pubblicazione

1. Eseguire controlli di tipo, test e compilazione; conservare il resoconto di
   collaudo con esiti reali, senza confondere prove locali e prove Umbrel.
2. Compilare e verificare l'avvio dei due container, l'isolamento Chromium,
   l'acquisizione e la consultazione offline su un runner Linux `amd64`.
   Queste prove possono essere eseguite con GitHub Actions senza installare
   Docker sul computer di sviluppo. Pubblicare l'immagine solo dopo il loro
   esito positivo, con permesso `packages: write` del workflow.
3. Pubblicare questa anteprima dichiarando il collaudo sul dispositivo ancora
   da eseguire. Installarla su umbrelOS 1.7.4 e provare autenticazione tramite
   proxy, stop, riavvio del dispositivo, aggiornamento e ripristino di un backup.
   Annotare kernel e consumi osservati prima di dichiararla collaudata su Umbrel.
4. Controllare l'identità Git **locale** con `git config --local user.name` e
   `git config --local user.email`: devono essere `Proof-of-Pizza21` e
   `259956083+Proof-of-Pizza21@users.noreply.github.com`. Prima di pubblicare,
   verificare anche che l'account GitHub autenticato corrisponda.
5. Controllare file distribuiti, diff e metadati: niente URL di collaudo personali,
   catture, credenziali, identità obsolete o percorsi assoluti della macchina.
   Includere le licenze e rendere disponibile il sorgente corrispondente.
6. Pubblicare il codice e l'immagine `amd64` solo dopo la revisione della
   release; verificare che il pull sia pubblico senza autenticazione. Ricavare
   il digest pubblicato e inserirlo nel Compose dello store. Il supporto ARM e
   l'indice multiarch richiederanno build e prove distinte in una release futura.
7. Completare gli URL reali nel manifest, pubblicare la radice dello store e
   provare l'installazione aggiungendone l'URL nell'interfaccia Umbrel.

Questi passaggi descrivono il lavoro di release da svolgere; non attestano che
sia già stato eseguito. Il pacchetto mantiene questo stato finché immagine,
digest e prove sul dispositivo non sono disponibili.

## Verifiche del packaging eseguite

Il 5 settembre 2026 è stata verificata tramite
[Docker Hub API](https://hub.docker.com/v2/repositories/library/node/tags/24.13.1-bookworm-slim)
l'esistenza dell'immagine di base `node:24.13.1-bookworm-slim`, con immagini
`linux/amd64` e `linux/arm64` attive e digest dell'indice
`sha256:a81a03dd965b4052269a57fac857004022b522a4bf06e7a739e25e18bce45af2`.
Il Dockerfile blocca tag e digest a questo risultato e installa la versione
Chromium corrispondente al Playwright del file di lock.

È stata verificata la sintassi YAML di Compose e manifest, la struttura JSON
del profilo seccomp e la coerenza statica di porte, endpoint di salute, utente
dei container e accesso in sola lettura del worker ai dati. Queste verifiche
non eseguono il motore Docker e non equivalgono a un test d'installazione.

La verifica del registro riguarda l'immagine di base, non il build di Landing
Archive. I container non sono stati avviati in questo ambiente di sviluppo,
nel quale Docker non è installato. Restano da provare il profilo seccomp,
i permessi sui volumi appena creati e ripristinati, il consumo di memoria e il
ciclo installazione/aggiornamento su Umbrel.
