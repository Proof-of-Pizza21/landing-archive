# Installazione

Landing Archive 0.1.3 è un'anteprima per mini PC Intel/AMD a 64 bit
(`linux/amd64`), con umbrelOS 1.7.4 come ambiente di destinazione. Le prove
Docker su Linux amd64 sono [riuscite](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34440663040), comprese acquisizione reale,
consultazione offline, backup e riavvio. Il collaudo sul dispositivo Umbrel resta
da eseguire; ARM non è incluso in questa anteprima.

## Installazione su Umbrel

L'immagine pubblica `ghcr.io/proof-of-pizza21/landing-archive:0.1.3` è stata
verificata e il pacchetto dello store la identifica con il digest pubblicato.

1. Apri l'App Store Umbrel e la gestione dei community app store.
2. Aggiungi l'indirizzo [https://github.com/Proof-of-Pizza21/umbrel-community-store](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Apri **Landing Archive Community Store** e installa **Landing Archive**.
4. Avvia l'app e crea un nome utente e una password di almeno **12 caratteri**.
5. Aggiungi un dominio o l'indirizzo di una pagina e scegli l'intervallo dei
   controlli. Dopo la prima acquisizione, apri la pagina per consultare la
   timeline, lo screenshot e la copia HTML.

Non esistono nome utente e password predefiniti. L'account dell'archivio è
separato dal login Umbrel; entrambi proteggono l'accesso. Le nuove acquisizioni
vengono salvate sul dispositivo. Inizia con un sito e verifica che la prima copia
sia leggibile prima di aggiungere gli altri.

Il codice è nel repository [Landing Archive](https://github.com/Proof-of-Pizza21/landing-archive).
Per backup, spazio e gestione continuativa consulta [Gestione dell'archivio](OPERATIONS.md).

## Aggiornamento dalle versioni precedenti

Esporta un backup, poi aggiorna Landing Archive dal community store Umbrel
mantenendo l’installazione esistente. La versione 0.1.3 conserva lo stesso
volume, account e acquisizioni. Dalla 0.1.2 lo schema rimane invariato; per
versioni precedenti viene aggiunto automaticamente il campo dei controlli
manuali. Il profilo AppArmor del motore viene caricato prima dell’avvio. Non occorre disinstallare l’app.

Riapri l’interfaccia e verifica che nella barra laterale compaia **0.1.3**.
Apri un sito e premi **Controlla e scarica ora**; se un tentativo è già attivo,
il comando diventa **Riavvia controllo**. Funziona anche con il sito in pausa.
Per rimuovere un sito usa **Elimina sito** e conferma: la cancellazione è
definitiva. Vedi [funzioni e aggiornamento](RELEASE-0.1.2.md).

I limiti per gli screenshot molto lunghi e le altre protezioni della
[versione 0.1.1](SECURITY-0.1.1.md) rimangono attivi.

## Prova locale con Docker

Richiede Docker Engine o Docker Desktop e il plugin Compose già installati. Non
è necessario eseguire l'app come amministratore, installare un database o avviare
un servizio browser esterno.

Dalla cartella del progetto, su Linux con AppArmor attivo caricare prima
il profilo dedicato del worker (Umbrel lo fa automaticamente tramite hook):

```sh
sudo bash umbrel-community-store/proof-of-pizza21-landing-archive/hooks/pre-start
```

Poi avviare i servizi:

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

Per il codice 0.1.3 sono necessari Node.js 24.20.0 o successivo della linea 24, npm e le dipendenze
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

La directory `umbrel-community-store/` contiene il pacchetto distribuito
nel repository dedicato allo store. L'identificatore dello store è
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

La versione dell'immagine è `ghcr.io/proof-of-pizza21/landing-archive:0.1.3`,
per `linux/amd64`. Entrambi i servizi del Compose usano il digest verificato:
`sha256:e8cab2dd89b4f74ad251793f4328fbac98a9a7ad534e82ea185799ce76a9dfdf`. Il download anonimo dal registro è stato verificato.

La porta esterna prevista è `4310`; va controllata sul dispositivo e rispetto
alle app installate. Il manifest include le destinazioni del repository, del
supporto e dell'icona, da verificare dopo la pubblicazione. L'icona SVG originale
è presente in `assets/icon.svg`.

## Procedura di pubblicazione

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

Le prove automatiche e Docker Linux amd64 sono completate. L'immagine 0.1.3 è
pubblica e il digest dello store è verificato. Il [resoconto di collaudo](TESTING.md)
distingue le verifiche già eseguite da quelle ancora necessarie sul dispositivo.

## Verifiche del packaging eseguite

L’8 settembre 2026 è stata verificata tramite
[Docker Hub API](https://hub.docker.com/v2/repositories/library/node/tags/24.20.0-bookworm-slim)
l'esistenza dell'immagine di base `node:24.20.0-bookworm-slim`, con immagini
`linux/amd64` e `linux/arm64` attive e digest dell'indice
`sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e`.
Il Dockerfile blocca tag e digest a questo risultato e installa la versione
Chromium corrispondente al Playwright del file di lock.

Sono state verificate la sintassi YAML di Compose e manifest, la struttura JSON
del profilo seccomp e la coerenza di porte, endpoint di salute e utenti.
Il [collaudo Docker Linux amd64](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34440663040) ha poi avviato i due container con
le restrizioni distribuite: filesystem in sola lettura, utente non amministratore,
volume del worker in sola lettura e sandbox Chromium attiva. Ha verificato
acquisizione reale, copia offline, controllo forzato durante la pausa,
deduplicazione, backup, persistenza al riavvio ed eliminazione confermata.

Il collaudo del runner usa Compose locale e un volume Docker dedicato; non
riproduce l'installazione attraverso Umbrel. Restano da verificare sul dispositivo
il kernel effettivo, i permessi dei volumi creati e ripristinati da Umbrel,
l'accesso tramite proxy, i consumi e il ciclo installazione/aggiornamento.
