# Landing Archive

## Identità Git permanente del progetto

Questa è una regola vincolante richiesta dall'utente. Per questo progetto usare
esclusivamente:

- Git user e author/committer name: `Proof-of-Pizza21`
- Git author/committer email: `259956083+Proof-of-Pizza21@users.noreply.github.com`

Questa identità sostituisce le precedenti indicazioni per Landing Archive,
comprese eventuali istruzioni contrastanti nella directory superiore.
Prima di ogni commit, tag o pubblicazione verificare `git config --local user.name`,
`git config --local user.email` e l'identità effettiva di autore e committer.
Non usare valori ereditati dalla configurazione globale o variabili d'ambiente
che sostituiscano questi dati. Non procedere se l'identità non corrisponde.
Prima di pubblicare su GitHub verificare anche l'account autenticato; la
configurazione Git locale non cambia l'accesso a GitHub. Non modificare le
chiavi di firma senza verificarne l'appartenenza all'account.

## Destinazione della prima pubblicazione

- Nome del repository applicativo scelto dall'utente: `landing-archive`.
- Account GitHub: `Proof-of-Pizza21`.
- Repository dello store previsto: `umbrel-community-store`.
- Versione di umbrelOS indicata dall'utente per il collaudo: `1.7.4`.
- Hardware di destinazione: mini PC AMD 3500U, architettura amd64, 16 GB RAM.

Il nome del repository sostituisce il precedente `landing-history` per la
pubblicazione. Aggiornare i riferimenti del pacchetto in modo coerente prima
della release; la directory locale esistente può conservare il proprio nome.

## Funzionamento

Applicazione locale per archiviare landing page e consultarne le versioni.
UI in italiano, chiara e utilizzabile senza terminale. Nessun invio delle catture
a servizi pubblici. Dati di acquisizione, URL personali di esempio, segreti e
percorsi macchina non entrano nei file distribuiti o nei commit.

Stack: TypeScript, Fastify, SQLite di Node, React/Vite, Playwright, SingleFile.
Non eseguire codice proveniente dai siti archiviati nel contesto dell'app.
Ogni controllo va conservato; file identici possono essere deduplicati, ma un
ritorno A → B → A deve risultare nello storico. Un errore non elimina versioni.

Il progetto è un'app Docker per Umbrel, non un sito da pubblicare su servizi di hosting.

## Privacy prima di ogni pubblicazione

Regola permanente: il nome e il cognome reali dell'utente non devono comparire
in alcun file, percorso versionato, metadato, commit, tag, descrizione, release
o artefatto dei due repository. L'unica identità pubblica consentita è
`Proof-of-Pizza21`, con l'email Git indicata sopra.

Prima di ogni push verificare i file selezionati, i file nascosti e tutti i
commit da pubblicare, inclusi autore e committer. Escludere archivi, URL
personali di collaudo, credenziali, log locali e percorsi della macchina.
Non pubblicare finché il controllo non è pulito.
