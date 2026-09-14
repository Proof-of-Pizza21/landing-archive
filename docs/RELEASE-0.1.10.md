# Novità, raccolta e backup — 0.1.10

## Novità da leggere

La nuova voce laterale raggruppa gli eventi per sito. Parte dagli ultimi sette
giorni dei competitor; puoi cambiare periodo, scegliere i tuoi siti o un singolo
sito, includere gli eventi già letti e scegliere quali tipi seguire. Le date
scelte nell’interfaccia seguono il fuso orario del browser.

Puoi segnare un evento come letto o nuovamente da leggere. Il pulsante cumulativo
riguarda solo gli eventi nella pagina visibile, fino a 200; non include eventi
arrivati successivamente. Un evento con una versione apre esattamente quella
copia. Una scoperta o un errore senza versione apre lo storico della pagina.
Preferenze e stato di lettura sono condivisi nell’archivio locale e inclusi nei
backup. Non cancellano eventi, controlli o versioni. Nessun invio esterno,
notifica email o analisi automatica delle strategie commerciali.

## Raccolta e appunti sulla versione

Nel dettaglio di una pagina, sotto la copia selezionata, trovi gli appunti per
quella specifica acquisizione: annotazione fino a 20.000 caratteri, preferita e
fino a 12 tag di 40 caratteri. Tag come `Webinar` e `webinar` vengono unificati.
Le note già presenti sul sito o sulla pagina rimangono indipendenti.

La Raccolta mostra solo versioni con note, tag o preferiti. Ricerca per titolo,
URL, annotazione e tag; filtri combinabili per sito, data, tag esatto e preferite.
I risultati sono paginati, 100 alla volta, e aprono la versione originale.
Le annotazioni sono testo, senza esecuzione di HTML. Eliminando un sito vengono
eliminate anche le annotazioni e lo stato di lettura relativi a quel sito.

## Esporta sito offline

Dalla scheda di un sito, **Esporta sito offline** prepara uno ZIP da estrarre e
sfogliare aprendo `index.html`. Contiene tutte le versioni del sito in ordine
cronologico, note, tag, preferiti, screenshot e copie HTML di consultazione.
Ogni copia mostra la propria data e i collegamenti all’indice e allo screenshot.

I collegamenti interni portano alla versione più recente entro la data della
pagina da cui si naviga; in mancanza, alla prima copia successiva. La data cambia
navigando e va controllata nella barra. Non è una cattura simultanea dell’intero
sito. I link senza copia restano inattivi. Script, moduli e risorse esterne sono
bloccati: la consultazione non ricrea servizi interattivi, video o risorse che
non erano già incorporate nella cattura.

Le copie originali restano intatte nell’app. Una copia oltre 12 MiB o i limiti di
complessità della vista offline viene sostituita nell’esportazione con un avviso
e il collegamento allo screenshot; l’indice la indica. Un file screenshot
mancante interrompe l’esportazione. Limite di 20.000 versioni per sito: oltre,
usa il backup completo. I documenti vengono elaborati uno per volta; l’indice è
preparato su disco. Questo ZIP è per consultazione, non per il ripristino.

## Backup e ripristino guidato

La nuova voce laterale conserva **Scarica backup completo** e permette di
caricare un backup ZIP dall’interfaccia. Le vecchie copie complete negli schemi
1–3 sono supportate entro gli stessi limiti di sicurezza dello schema 4.

1. Seleziona lo ZIP completo e premi **Carica e verifica backup**. Il caricamento
   procede a blocchi da 1 MiB, con avanzamento visibile. La verifica mostra siti,
   pagine, versioni, controlli, data del backup e dimensione dei file.
2. Conferma la sostituzione di tutto l’archivio e inserisci la password del tuo
   accesso attuale. Il ripristino non unisce due archivi. Scarica prima i backup
   che vuoi conservare anche su un dispositivo separato.
3. L’app attende le operazioni già avviate, sospende il motore, crea una copia
   completa dell’archivio attuale e applica il nuovo storico in una transazione.
   Durante la sostituzione le altre operazioni sull’archivio sono sospese.
4. Al termine il tuo account attuale rimane valido. Gli account del backup non
   sostituiscono l’accesso corrente. Tutti i siti sono in pausa e la coda viene
   azzerata: riattivali dalle impostazioni quando sei pronto.

La sezione **Prima dell’ultimo ripristino** permette di scaricare la copia di
sicurezza. Il ripristino successivo la sostituisce; salvala altrove se vuoi
conservarla. È un backup completo, ricaricabile con la stessa procedura.

La verifica ZIP controlla percorsi consentiti, duplicati, file cifrati, link
simbolici, CRC, hash SHA-256, dimensioni, riferimenti tra dati, metadati e PNG.
Il database caricato viene letto in un processo separato e ricostruito usando
lo schema dell’app: non vengono installati trigger, viste, colonne calcolate o codice
del backup. La memoria nativa SQLite è limitata a 64 MiB e il processo di verifica
ha un limite separato di 256 MiB per la memoria JavaScript.
I file sono verificati prima della modifica del database; un errore della
transazione lascia lo storico precedente intatto. Una interruzione prima della
transazione può lasciare file non referenziati, senza cancellare lo storico.

Limiti del ripristino guidato: ZIP fino a 32 GiB, contenuto estratto fino a
64 GiB (ulteriormente limitato dallo spazio libero), database fino a 1 GiB,
100.000 file di cattura, 500 siti, 100.000 pagine, 5 milioni di righe complessive.
Valgono i limiti correnti sui metadati e sulle immagini; vecchie catture oltre
questi limiti richiedono il ripristino manuale. Verifica entro 10 minuti, un solo
caricamento alla volta, scadenza dopo un’ora di inattività. Un riavvio scarta i
caricamenti incompleti. La verifica e la copia di sicurezza richiedono spazio
aggiuntivo; lo spazio riservato alle emergenze resta protetto. Mantieni aperta
la pagina e una connessione stabile durante il ripristino.

## Aggiornamento

La migrazione allo schema 4 aggiunge tre tabelle e indici, senza riscrivere
copie, account o controlli. Scarica un backup dalla versione precedente e
aggiorna da Umbrel senza disinstallare l’app. Le vecchie copie simili rimangono.
Per tornare a una versione precedente usa anche un backup precedente alla
migrazione. Non sostituire a mano il database mentre i servizi sono avviati.
