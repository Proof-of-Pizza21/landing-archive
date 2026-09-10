# Pagina offline nell’archivio — 0.1.4

Ogni versione può essere consultata nella nuova scheda **Pagina offline**,
accanto a **Screenshot**. La vista usa l’HTML già archiviato: funziona anche
con le acquisizioni precedenti e non richiede un nuovo download del sito.
Il documento può essere scorso, ingrandito con il browser e letto con testo
selezionabile. Il comando di espansione aumenta l’altezza della vista.

## Navigazione e date

I collegamenti aprono soltanto copie appartenenti allo stesso sito monitorato.
La data selezionata nella linea del tempo rimane il riferimento durante tutta
la navigazione. Per ogni pagina viene scelta l’ultima copia acquisita entro
quella data; se non esiste, viene mostrata la prima copia successiva con un
avviso esplicito. Indirizzo e data effettiva della pagina aperta sono sempre
indicati sopra il documento. I parametri degli URL vengono conservati.

**Indietro** torna alle pagine visitate nella vista, fino a 50 passaggi.
Le ancore interne permettono di saltare a una sezione. Un collegamento senza
una copia disponibile mostra un avviso e non apre il sito online.
**Scarica questa pagina** esporta l’HTML originale della copia attualmente
aperta; il file scaricato mantiene i collegamenti originali e non è un export
dell’intero sito con navigazione locale.

Le copie delle diverse pagine non sono necessariamente simultanee: la data
mostrata è quella dell’acquisizione effettiva, non una ricostruzione certa di
come appariva l’intero sito in un preciso istante.

## Isolamento e limiti

La vista genera un documento derivato senza modificare i file conservati.
Un parser HTML rimuove script, eventi, moduli attivi, frame, redirect automatici,
destinazioni esterne dei link e attributi che possono avviare navigazioni.
Le immagini e gli stili incorporati restano disponibili. Un iframe senza
permesso di eseguire script e una Content Security Policy separata bloccano
script, richieste esterne, frame, moduli, popup e navigazioni della finestra
principale. L’app gestisce i clic con identificatori verificati delle copie.

L’iframe mantiene l’origine dell’app esclusivamente per permettere al genitore
di leggere i link riscritti; non include `allow-scripts`. Le risposte della
vista richiedono l’autenticazione, non vengono memorizzate nella cache e possono
essere incorporate soltanto dalla stessa origine. Le altre pagine dell’app
mantengono il divieto di incorporamento.

La preparazione della vista accetta al massimo 12 MiB di HTML, 50.000 nodi e
150 livelli di annidamento. Copie oltre questi limiti restano scaricabili e
consultabili tramite screenshot. Menu basati su JavaScript, form, video,
caroselli e servizi online possono non funzionare. Le risorse che non erano
state incorporate durante l’acquisizione non vengono recuperate da Internet.

## Aggiornamento

Esportare un backup e aggiornare l’installazione esistente dal community store.
Account, archivio, pianificazione e schema del database restano invariati.
Verificare **0.1.4** nella barra laterale, aprire una pagina e scegliere una
versione nella linea del tempo: **Pagina offline** è la vista iniziale.

Il collaudo comprende navigazione reale nel browser, scelta delle date,
collegamenti mancanti, ancore, interfaccia mobile, autenticazione e tentativi
ostili di eseguire script o contattare la rete. Gli esiti della pubblicazione
sono riportati in [Verifiche](TESTING.md).
