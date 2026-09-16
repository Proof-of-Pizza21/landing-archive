# Qualità delle copie e storico leggibile — 0.1.12

Questa versione interviene sul caso in cui risorse o sezioni non caricate
venivano interpretate come modifiche, facendo crescere inutilmente l'archivio.
La migrazione è additiva: nessuna vecchia copia viene cancellata automaticamente.

## Acquisizione e riferimento

Il motore controlla la stabilità della pagina durante il caricamento e raccoglie
segnali sulle immagini e sulle risorse necessarie alla visualizzazione. La
qualità del caricamento e quella della copia HTML sono registrate separatamente.
Il mancato caricamento di un'immagine non equivale alla sua sostituzione.

Le copie dubbie non sostituiscono automaticamente il riferimento affidabile.
Le prime osservazioni e le evidenze stabili di nuovi contenuti vengono conservate anche
quando non sono ancora confermate: una landing o un'offerta breve può non essere
più presente al controllo successivo. La sola assenza di contenuto richiede una
verifica specifica, distinta dalla generica ripetizione di un errore.

Le differenze solo visive e le assenze richiedono due visite verificate coerenti,
almeno 30 secondi distanti. Un errore interrompe la conferma. Sono previsti al
massimo due tentativi ravvicinati (1 e 5 minuti), poi la frequenza ordinaria. Quando il monitoraggio è in pausa, il
controllo manuale resta disponibile e non riattiva la pianificazione.

## Consultazione

La timeline distingue versioni, osservazioni da verificare e vecchie copie che
non dispongono dei nuovi dati di qualità. Le ricorrenze possono essere raggruppate
conservando le date dei controlli. Il ritorno A → B → A resta consultabile.

Il confronto mostra anche immagini il cui file è cambiato sullo stesso indirizzo,
risorse non caricate e file identici serviti da indirizzi diversi. Queste
indicazioni sono disponibili quando entrambe le copie contengono le relative
informazioni: non vengono inventate per gli archivi precedenti. I dettagli
distinguono anche il testo modificato da sezioni riconosciute che hanno solo
cambiato posizione; l’abbinamento delle sezioni rimane una stima.

## Spazio e revisione delle vecchie copie

I file diagnostici dei tentativi ordinari sono temporanei e separati dalle
versioni dell'archivio. Le nuove evidenze, le prime copie e le versioni conservate
non sono soggette alla scadenza dei diagnostici. I limiti sono 3 campioni per
pagina, 512 complessivi, 48 ore e 1 GiB; il registro dei controlli rimane.

La revisione propone soltanto un insieme limitato di candidati: duplicati con
contenuto e file identici, oppure copie storiche dichiarate parziali che non
aggiungono contenuto fra due stati completi coincidenti. Una copia parziale può
comunque testimoniare un vero stato temporaneo: ogni candidato richiede
selezione e conferma esplicite nell'interfaccia.

Prime copie, ultima copia, riferimento corrente, nuove osservazioni, preferiti,
note e tag sono protetti. Se l'archivio cambia dopo l'anteprima, occorre aggiornarla.
Le date dei controlli e degli eventi restano registrate anche quando vengono
eliminati i file selezionati; l'osservazione indica che i file originali sono
stati rimossi. Per recuperarli serve un backup precedente.

I file identici erano già condivisi: ridurre il numero di voci non significa
necessariamente liberare disco. L'anteprima calcola i byte fisici recuperabili,
tenendo conto dei file ancora usati da altre versioni.

## Ripartire da zero per un sito

Il comando **Azzera copie e riscarica**, nel dettaglio del sito, elimina tutte
le copie del sito selezionato dopo anteprima e conferma: anche prime copie,
riferimenti, preferiti, tag e appunti delle versioni. Conserva invece il sito,
gli indirizzi, le impostazioni e le note delle pagine. Le date dei controlli
restano registrate e indicano che i file originali sono stati rimossi.

I lavori in corso vengono annullati e i risultati tardivi scartati. Tutte le
pagine conosciute ricevono un controllo manuale nuovo; se il limite consente più
pagine, riparte anche la ricerca di indirizzi. Il primo risultato non viene
confrontato con vecchie copie. La pausa del monitoraggio rimane invariata.

L’anteprima si invalida quando le copie o i controlli cambiano. Backup e ripristino
in corso impediscono l’azzeramento. Il pulsante offre un backup da scaricare prima:
i file eliminati non si recuperano dall’app, e una pagina oggi scomparsa non può
essere ricreata dalla scansione. I file condivisi con altri siti rimangono protetti.

## Aggiornamento e backup

App e motore devono essere aggiornati insieme. La pagina iniziale mostra la
versione del motore e segnala incompatibilità; un risultato proveniente dal
vecchio protocollo non può saltare i nuovi controlli di qualità.

Lo schema dell'archivio passa a 5. Il backup completo conserva le versioni,
le osservazioni, le note e i nuovi metadati. I diagnostici temporanei non sono
inclusi nel ZIP. Il ripristino resta isolato, valida i riferimenti e mantiene
i siti in pausa. Anche i backup precedenti compatibili restano importabili.

## Limiti e verifica

Una pagina stabile può essere permanentemente guasta; due visite uguali non
provano da sole che una rimozione sia intenzionale. Le varianti osservate non
dimostrano l'esistenza di un test A/B, e una pagina comparsa e scomparsa fra due
visite non può essere rilevata.

Il collaudo comprende sequenze complete/parziali/recuperate, cambiamenti di
prezzo, risorse fallite, creatività sostituite, conferme specifiche, conservazione
dei primi campioni, ricorrenze, limiti dei diagnostici e protezioni della pulizia.
Gli esiti effettivamente completati e i limiti dell'ambiente sono riportati nel
[resoconto dei test](TESTING.md). Il collaudo sul mini PC dell'utente rimane
distinto da quello locale e dai container Linux.
