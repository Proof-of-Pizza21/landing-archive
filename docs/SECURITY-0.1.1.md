# Sicurezza e limiti della versione 0.1.1

La versione 0.1.1 rafforza l'accesso alle API, la gestione di pagine anomale,
la scoperta mediante robots.txt e gli aggiornamenti dei componenti distribuiti.
Non modifica lo schema del database e conserva le acquisizioni precedenti.

## Accesso

Le rotte sono private per impostazione predefinita. L'autenticazione dipende
dalla rotta riconosciuta dal server, anche quando un client usa una diversa
codifica dell'indirizzo. Restano pubblici solo la pagina di accesso e i suoi
file, la verifica dello stato, la creazione iniziale dell'account e il login.
Le risposte API non devono essere conservate nella cache.

## Limiti delle acquisizioni

- Screenshot: massimo 1.920 pixel di larghezza, 20.000 di altezza e 12 milioni
  di pixel complessivi. Alla larghezza normale di 1.440 pixel, l'altezza massima
  è 8.333 pixel. Il ritaglio viene stabilito fuori dal codice del sito; se la
  pagina è più lunga, compare un avviso. La copia HTML può conservare contenuto
  oltre il ritaglio dello screenshot.
- PNG: massimo 16 MiB compressi, RGB/RGBA a 8 bit, senza interlacciamento. Le
  dimensioni e la struttura vengono controllate prima della decodifica.
- Confronto visivo: processo temporaneo distinto, heap JavaScript limitato a
  128 MiB e arresto imposto dal coordinatore dopo 5 secondi. I buffer nativi
  sono limitati dalle dimensioni ammesse delle immagini; il limite di 128 MiB
  non va interpretato come tetto di tutta la memoria del processo.
- HTML: massimo 32 MiB. Metadati: massimo 8 MiB serializzati, testo fino a
  1,5 milioni di caratteri, 100 intestazioni da 500 caratteri, 2.000 collegamenti
  e 500 indirizzi di immagini, con limiti anche sui singoli campi.
- Risposta del motore: massimo 64 MiB effettivamente letti, anche senza una
  dichiarazione corretta della lunghezza. La verifica precede la lettura JSON
  completa; i campi vengono poi validati prima del salvataggio.

I metadati vengono estratti in un ambiente del browser isolato dalle modifiche
che il sito può effettuare alle funzioni JavaScript standard. Un superamento
dei limiti produce un errore del controllo; le copie precedenti restano
disponibili. Gli errori permanenti di formato o dimensione non vengono
ritentati immediatamente. Se al riavvio un lavoro resta interrotto e ha già
raggiunto tre tentativi, il sito viene messo in pausa e può essere riattivato
dalle impostazioni.

Screenshot precedenti che superano i nuovi limiti restano scaricabili; il
confronto evita di decodificarli e stabilisce una nuova versione di riferimento.

## Scoperta delle pagine

Le regole robots.txt vengono confrontate senza espressioni regolari con
backtracking. Le ricerche dei segmenti letterali avanzano nel percorso con
l'algoritmo KMP. Il file può contenere fino a 128 KiB, 256 regole complessive e
512 caratteri per regola. Un budget limita anche il lavoro totale di confronto
durante una scoperta. Regole eccessive interrompono la scoperta con un errore
visibile, anziché essere ignorate consentendo ulteriori richieste al sito.

## Componenti e verifica delle immagini

La base è Node 24.20.0 LTS, fissata al digest ufficiale verificato l'8 settembre
2026. La build applica gli aggiornamenti Debian disponibili e rimuove npm e
Yarn dal runtime dopo l'installazione. Il browser rimane quello fissato dalla
versione Playwright del lockfile.

Il processo GitHub verifica il checksum dello scanner Trivy e analizza
l'immagine appena costruita. Vulnerabilità alte o critiche con una correzione
disponibile bloccano la pubblicazione. Il controllo dei segreti blocca anch'esso
la pubblicazione; i valori eventualmente individuati non vengono stampati
o caricati come artefatti. L'inventario delle vulnerabilità rimane disponibile
fra gli artefatti della verifica per esaminare anche quelle senza correzione.

La presenza di una CVE in una libreria non dimostra automaticamente che il suo
percorso vulnerabile sia usato dall'app. Le segnalazioni residue richiedono
valutazione e manutenzione; un'immagine fissata a un digest non si aggiorna
automaticamente. La procedura esegue anche acquisizioni e confronti reali nei
container con i limiti previsti per la distribuzione.

I test di regressione includono richieste HTTP reali con percorsi equivalenti,
risposte del motore troppo grandi o malformate, immagini fuori limite, regole
robots complesse, recupero della coda, confronto visivo e metadati del browser.
La prova dei container esercita il confronto a 12 milioni di pixel sotto il
limite di memoria del servizio web.
