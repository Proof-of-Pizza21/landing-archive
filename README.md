# Landing Archive

Archivio locale per seguire l'evoluzione dei propri siti e delle landing dei
competitor: nuove pagine, cambiamenti nel messaggio e versioni che scompaiono.
Interfaccia in italiano, dati sul proprio disco, nessun account cloud richiesto.

**Stato: anteprima 0.1.11 per mini PC Intel/AMD a 64 bit (`linux/amd64`), con
umbrelOS 1.7.4 come ambiente di destinazione.** Le immagini vengono pubblicate
solo dopo i [collaudi Linux](https://github.com/Proof-of-Pizza21/landing-archive/actions/workflows/verify-and-publish.yml)
e sono bloccate al digest nel community store. Il collaudo dell’aggiornamento
sul mini PC rimane distinto; questa anteprima non include ARM.

La **0.1.11** separa caricamenti incompleti e modifiche, conserva un riferimento
affidabile, verifica la pagina offline e richiede conferme per differenze solo
visive o contenuto scomparso. Offre uno storico raggruppato, diagnostici temporanei
e una revisione delle vecchie copie con selezione esplicita. Nessuna vecchia copia
viene cancellata dall’aggiornamento. Il comando **Azzera copie e riscarica** permette
inoltre di ripartire da zero per un solo sito, dopo conferma. [Guida e limiti](docs/RELEASE-0.1.11.md).

La **0.1.10** aggiunge **Novità da leggere**, tag, preferiti e appunti sulle singole
versioni, una Raccolta filtrabile, esportazione offline per sito e ripristino
con verifica preventiva e copia di sicurezza. [Guida e limiti](docs/RELEASE-0.1.10.md).

La **0.1.8** aggiunge confronti meno sensibili ai piccoli spostamenti, controlli di
qualità delle acquisizioni, scelta visiva delle zone e una vista sulla vita delle
landing. [Funzioni e limiti](docs/RELEASE-0.1.8.md).

Le correzioni di sicurezza della versione 0.1.1 sono descritte in
[docs/SECURITY-0.1.1.md](docs/SECURITY-0.1.1.md) e rimangono attive.

Le nuove funzioni della versione 0.1.2 sono descritte in
[Controlli manuali, eliminazione e reindirizzamenti](docs/RELEASE-0.1.2.md).

## Come funziona

- Aggiungi un dominio o un indirizzo preciso e scegli l'intervallo dei controlli.
- Salva screenshot desktop, HTML tramite SingleFile e testo della pagina.
- Cerca altre pagine attraverso sitemap e collegamenti pubblici.
- Consulta lo storico delle acquisizioni e confronta le versioni.
- Esporta un backup ZIP dell'archivio e scarica il sorgente dell'app dall'interfaccia.
- Conserva le copie esistenti anche quando una nuova visita fallisce.
- Avvia un controllo manuale prioritario e riavvia un tentativo rimasto fermo.
- Elimina un sito e le sue copie, dopo una conferma, conservando i file usati da altri siti.
- Registra il ritorno a una versione precedente: A → B → A rimane nello storico.

I controlli sono distinti dalle versioni: una visita senza cambiamenti aggiorna
lo storico dei controlli senza richiedere un'altra copia identica. La rilevazione
dei cambiamenti non può rivelare i risultati di conversione o garantire che una
variante osservata sia un test A/B.

## Primo avvio su Umbrel

Aggiungi questo indirizzo nella gestione
dei community app store dell'App Store Umbrel:

[https://github.com/Proof-of-Pizza21/umbrel-community-store](https://github.com/Proof-of-Pizza21/umbrel-community-store)

Apri **Landing Archive Community Store**, installa **Landing Archive** e avviala.
Crea un nome utente e una password di almeno **12 caratteri** per l'archivio,
poi aggiungi il primo dominio o una pagina precisa. Scegli l'intervallo dei
controlli e consulta le acquisizioni nella timeline. Non ci sono credenziali
predefinite. Il login dell'archivio si aggiunge alla protezione del proxy Umbrel.

La correzione della versione 0.1.3 per il blocco AppArmor è descritta in
[Avvio del browser su Umbrel](docs/RELEASE-0.1.3.md).

La vista **Pagina offline** della 0.1.6 permette di consultare le copie e seguire
i collegamenti archiviati direttamente nell’app. [Funzioni e limiti](docs/RELEASE-0.1.6.md).

Il codice 0.1.7 aggiunge **Confronta → Aspetto** con aree modificate evidenziate,
navigazione fra le zone e riepilogo delle differenze anche quando gli screenshot
coincidono. [Funzioni e limiti](docs/RELEASE-0.1.7.md).

## Prova locale con Docker

Per provare il progetto su un computer che dispone già di Docker con Compose:

Su Linux con AppArmor attivo, carica prima il profilo dedicato:

```sh
sudo bash umbrel-community-store/proof-of-pizza21-landing-archive/hooks/pre-start
```

Poi avvia i servizi:

```sh
docker compose up --build -d
```

Apri `http://localhost:4310` e crea un nome utente e una password di almeno
12 caratteri per l'archivio.
Il collegamento locale è pubblicato solo su `127.0.0.1`; il worker browser non
espone una porta sul computer. Questa modalità serve al collaudo locale.
L'installazione Umbrel usa invece il suo proxy e il login Umbrel.

Le istruzioni complete e la procedura di distribuzione sono in
[Installazione](docs/INSTALL.md). Per backup, spazio su disco, riavvii e problemi
di acquisizione vedi [Gestione dell'archivio](docs/OPERATIONS.md).
Gli esiti verificati e le prove ancora necessarie sono nel [Resoconto di collaudo](docs/TESTING.md).

## Scelte della prima versione

Una pagina alla volta limita il carico del browser. Come punto di partenza si
usano controlli ogni 6 ore e ricerca di nuove pagine ogni 24 ore; la frequenza è
modificabile dall'interfaccia. L'archivio non cancella automaticamente le vecchie
versioni per fare spazio.

La composizione Docker limita l'app a 1 GB di RAM e il worker a 3 GB; sono limiti
massimi dei container, non consumi costanti. Le prestazioni dipendono dalle
pagine. Il pacchetto deve ancora essere verificato sul kernel di umbrelOS 1.7.4
e sul mini PC destinato al primo collaudo.

Le pagine senza link o sitemap pubblica devono essere aggiunte manualmente. Non
sono inclusi accessi con account, aggiramento di CAPTCHA, catture video,
ricostruzione di interi servizi web o scoperta automatica delle campagne pubblicitarie.
Una copia HTML è un documento conservato, non il sito interattivo funzionante.

## Struttura

| Componente | Ruolo |
| --- | --- |
| React e Vite | Interfaccia, timeline e confronto |
| Fastify su Node.js 24 | API, account, pianificazione e archivio |
| SQLite | Siti, pagine, controlli e riferimenti alle versioni |
| Worker Playwright e Chromium | Visita delle pagine e screenshot |
| SingleFile Core | Copia HTML con risorse incorporate quando acquisibili |
| Docker Compose | App e worker separati con archivio persistente |

Non è un fork di ArchiveBox o changedetection.io. La logica dedicata a siti,
landing e storico è parte di questa app; i componenti browser e HTML vengono
riutilizzati dai rispettivi progetti.

## Dati e distribuzione

L'archivio, gli indirizzi aggiunti dall'utente, le password e i token rimangono
nel volume dati. Non inserire esempi personali o acquisizioni nei sorgenti, nelle
immagini Docker, negli screenshot dello store o nelle segnalazioni pubbliche.
Il contesto di build Docker ammette soltanto i file applicativi necessari.

Copyright © 2026 Proof-of-Pizza21. Il codice applicativo è distribuito con
licenza **AGPL-3.0-or-later**; il testo è in [LICENSE](LICENSE). Le dipendenze
mantengono le proprie licenze, elencate in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
I contenuti archiviati non diventano codice del progetto e mantengono i diritti
dei rispettivi titolari.
