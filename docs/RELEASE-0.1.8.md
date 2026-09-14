# Confronti affidabili e vita delle landing — 0.1.8

## Meno copie superflue

Il confronto visivo usa le coordinate originali senza deformare gli screenshot.
Differenze di altezza/larghezza fino a 3 pixel non sono più una modifica automatica.
Un confronto di vicinato sul campione tollera piccoli spostamenti (circa 1–3 pixel
originali, secondo la larghezza); resta la soglia dello 0,5% sui pixel considerati.
Le variazioni di testo, titolo, intestazioni, collegamenti e indirizzi delle
immagini sono controllate separatamente: anche un prezzo piccolo può creare una
versione. Una zona importante usa la propria area come riferimento per il
confronto visivo, evitando che si perda nel totale di una pagina lunga.

Sono esclusi dal confronto soltanto parametri pubblicitari noti: i campi UTM
standard e identificatori come gclid, fbclid e msclkid. Gli indirizzi originali
restano nei file. Parametri di prodotto, lingua, prezzo, esperimento, revisione
immagine o cache non vengono rimossi indiscriminatamente.

Le vecchie firme vengono ricalcolate dai metadati conservati durante il confronto,
senza riscrivere o eliminare lo storico. Un ritorno A → B → A rimane registrato.
Il confronto manuale mostra le copie integrali, anche nelle zone escluse.

## Acquisizioni complete e parziali

Il browser attende in modo limitato anche la decodifica delle immagini dopo lo
scorrimento per i contenuti caricati progressivamente. Immagini visibili non
caricate, fogli di stile mancanti o una pagina vuota producono una segnalazione
strutturata di qualità, visibile nelle copie e nei controlli.

Una copia parziale con contenuto invariato non genera una versione soltanto per
le differenze nello screenshot. Un nuovo contenuto viene conservato con avviso;
la prima copia di una landing viene comunque salvata. Un crollo del testo sotto
il 30% di una copia precedente con oltre 300 caratteri richiede un controllo di
conferma. Ogni tentativo è registrato. È programmato un solo ricontrollo a cinque
minuti per una sequenza incompleta; poi torna la cadenza ordinaria. La pausa e la
disattivazione del coordinatore non vengono aggirate.

Limite: finché una pagina è incompleta, le sole modifiche visive non sono una
prova affidabile e non generano versioni. Testo e metadati continuano a essere
confrontati. La qualità non certifica la completezza del sito: video, servizi
interattivi, risorse offline non incorporate e parti oltre i limiti di cattura
possono essere assenti. Gli avvisi di SingleFile restano consultabili.

## Zone da monitorare

Aprire una pagina e scegliere **Zone da monitorare**. Cliccare un elemento,
eventualmente allargare la selezione, quindi scegliere **Escludi dal confronto**
oppure **Segna come importante**. **Mostra anche la copia precedente** permette
di controllare il numero degli elementi selezionati e il loro contenuto prima
di salvare. Le zone escluse sono arancioni, quelle importanti verdi; una zona
importante ha la precedenza su un’esclusione più ampia.

Le regole valgono per la pagina scelta; le esclusioni avanzate del sito continuano
ad applicarsi. Limite complessivo: 30 esclusioni e 20 zone importanti per pagina.
Le regole identificano elementi della pagina, non coordinate fisse. La vista
offline può avere un’impaginazione diversa e un sito che cambia struttura può
richiedere una nuova scelta. Un elemento importante non trovato produce un avviso.
Il primo controllo completo dopo un cambio di regole salva un riferimento
esplicitamente etichettato, senza segnalarlo come una modifica del sito.

Le copie HTML e gli screenshot nuovi rimangono integrali. I vecchi screenshot
che contenevano già maschere non possono essere ricostruiti. L’editor usa copie
inerti, senza esecuzione di script, moduli o richieste verso Internet; l’API delle
regole richiede la stessa autenticazione e protezione di origine delle altre API.

## Vita delle landing

La scheda del sito mostra prima scoperta, origine, ultima acquisizione riuscita,
evoluzione e ultimo controllo. I filtri distinguono nuove, modificate, non
raggiungibili, tornate online e non più presenti nelle sitemap. Le categorie
rappresentano l’ultimo evento osservato: non attestano quando il sito ha pubblicato
una pagina o i risultati di un test commerciale.

Le assenze dalla sitemap sono determinate solo con letture complete delle stesse
fonti. Sitemap mancanti, errori o risultati limitati non fanno diventare offline
una pagina. Il controllo HTTP resta separato: due risposte consecutive 404/410
confermano la scomparsa e una successiva acquisizione registra il ritorno.

La frequenza di scoperta è indipendente da quella dei controlli (predefinita 24
ore, configurabile da 1 a 8.760 ore). È possibile includere o escludere percorsi;
il prefisso /offerte comprende /offerte e i suoi discendenti, non /offerte-altre.
Le regole valgono per nuove scoperte automatiche, non per le pagine già seguite o
aggiunte manualmente. Restano i limiti di tempo, richieste, pagine e robots.txt.
Le landing non collegate, presenti soltanto in annunci o email, vanno aggiunte a mano.

## Aggiornamento e limiti operativi

La migrazione allo schema 3 aggiunge campi senza cancellare account, versioni,
controlli o file. Prima di aggiornare esportare un backup. Un ritorno alla 0.1.7
richiede il ripristino di un backup precedente alla migrazione. L’aggiornamento
non elimina le copie simili accumulate in passato.

Sono mantenuti isolamento del browser, protezioni della rete interna, decodifica
PNG in un processo separato, limiti di memoria/tempo, archivio in sola lettura
per il worker e assenza di servizi cloud per le acquisizioni.
