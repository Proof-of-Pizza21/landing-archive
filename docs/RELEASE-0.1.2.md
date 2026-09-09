# Controlli manuali, eliminazione e reindirizzamenti — 0.1.2

La versione 0.1.2 aggiunge comandi diretti per gestire un sito e corregge un
errore che impediva di acquisire alcune pagine con reindirizzamenti HTTP.

## Controlla e scarica ora

Il pulsante è disponibile nell'elenco dei siti, nel dettaglio del sito e nella
storia di una pagina. Anticipa i lavori in attesa, azzera l'attesa di un nuovo
tentativo e assegna precedenza rispetto ai controlli automatici. Funziona anche
con il monitoraggio in pausa, senza riattivare la pianificazione.

Quando è già in corso un lavoro sul sito o sulla pagina selezionata, il comando
diventa **Riavvia controllo**: interrompe quel tentativo e ne prepara uno nuovo.
I lavori degli altri siti non vengono annullati. Le visite restano seriali;
un lavoro già in corso su un altro sito deve terminare prima del successivo.

Ogni controllo effettua una nuova visita e scarica la pagina. Se non rileva
modifiche, conserva il controllo nello storico senza duplicare la versione.
Lo stato mostra attesa, tentativo in corso, tempo trascorso e ultimo errore.
Gli errori di acquisizione indicano la fase che non è stata completata.

## Elimina sito

Il comando richiede una conferma nell'interfaccia. Rimuove il sito, le pagine,
le versioni, le note, la cronologia e i lavori associati. Elimina dal disco i
file che nessun altro sito usa; i file condivisi rimangono disponibili agli
altri archivi. Un risultato tardivo di un lavoro interrotto non può ricreare il
sito o le versioni eliminate.

La cancellazione è definitiva nell'app. Il dialogo permette di scaricare prima
un backup; durante la sua esportazione l'eliminazione viene rifiutata con un
messaggio esplicito. I backup già scaricati rimangono copie indipendenti e non
vengono modificati. Se i permessi del disco impediscono la rimozione di un file,
l'app segnala che la liberazione dello spazio non è completa.

## Correzione dei download

Un reindirizzamento HTTP poteva terminare con `ERR_PROXY_CONNECTION_FAILED`:
il passaggio successivo non attraversava nuovamente il gestore delle richieste
del browser. È un limite documentato da
[Playwright](https://playwright.dev/docs/api/class-page#page-route).

Ora i reindirizzamenti vengono risolti dal trasporto controllato dell'app,
verificando ogni destinazione. Il browser apre esplicitamente l'indirizzo finale,
così origine della pagina e collegamenti relativi rimangono corretti. Anche le
risorse reindirizzate vengono recuperate. Cookie e intestazioni sensibili non
vengono inoltrati a un'altra origine. Rimangono attivi i limiti di download,
il blocco delle reti private e l'isolamento del browser.

## Aggiornamento dell'archivio

Al primo avvio viene aggiunto un campo alla coda per riconoscere i controlli
manuali. Il passaggio dallo schema 1 allo schema 2 è automatico e conserva
account, siti, acquisizioni e lavori in attesa. Non richiede una reinstallazione.
Esportare un backup prima dell'aggiornamento resta la procedura consigliata.
I limiti di sicurezza introdotti nella 0.1.1 rimangono attivi.
