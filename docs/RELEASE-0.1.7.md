# Evidenziare le modifiche — 0.1.7

Apri una pagina, seleziona una versione e scegli **Confronta**. L’app propone
il confronto con la copia precedente; per la prima acquisizione usa la copia
successiva. Puoi scegliere liberamente le due date nei menu.

## Dove è cambiata la pagina

In **Aspetto**, le aree arancioni racchiudono le differenze tra gli screenshot.
**Modifica precedente**, **Modifica successiva** e **Vai alla zona** portano
alla regione selezionata in entrambe le copie. Lo scorrimento è sincronizzato.
La casella **Evidenzia le modifiche** permette di nascondere i contorni e
consultare l’immagine originale. Su telefono le copie sono disposte una sotto
l’altra. I comandi per aprire gli screenshot e scaricare l’HTML restano disponibili.

Le immagini con dimensioni diverse vengono allineate all’angolo superiore
sinistro, senza deformare una copia per adattarla all’altra. Le parti mancanti
sono riconoscibili dallo sfondo tratteggiato. Una differenza nelle dimensioni
viene indicata esplicitamente, anche quando è di un solo pixel.

## Cosa ha rilevato il confronto

Il riepilogo distingue **testo**, **titolo**, **intestazioni**, **collegamenti**,
**indirizzi delle immagini** e **destinazione finale della pagina**. I pulsanti
portano al dettaglio corrispondente. **Testo** evidenzia le parole rimosse e
aggiunte; **Collegamenti** mostra gli indirizzi prima e dopo. **Dettagli**
riporta titolo, intestazioni, destinazione e indirizzi delle immagini modificati.
Questi ultimi vengono mostrati come testo, senza aprire risorse online.

Se due screenshot coincidono ma è cambiato un parametro di un collegamento o
dell’indirizzo di un’immagine, il confronto lo spiega senza inventare una zona
modificata. Gli stessi criteri di normalizzazione sono condivisi con il motore
che decide se creare una versione.

## Limiti e sicurezza

Questa release aggiunge la spiegazione delle differenze: **non cambia le
soglie che fanno scattare il salvataggio**. Il confronto descrive le due copie
selezionate, che possono anche non essere consecutive. Animazioni, spostamenti,
banner e caricamenti incompleti possono evidenziare ampie zone; non dimostrano
da soli una modifica intenzionale al sito.

Il confronto visivo usa un campione di massimo 480 × 6.000 pixel, la stessa
tolleranza cromatica del rilevamento esistente e raggruppa i pixel diversi in
aree vicine. Può non rilevare dettagli molto piccoli. La percentuale riguarda
i pixel del campione, non le parole modificate né l’importanza del cambiamento.
Le differenze nelle dimensioni sono mostrate separatamente dalla percentuale.
Oltre 100 regioni, le ultime vengono raggruppate in un’area più ampia.

Il calcolo richiede una sessione autenticata e due versioni della stessa pagina.
La risposta non viene memorizzata nella cache del browser. Il server consente
una sola elaborazione manuale per volta, con limite di richieste, e conserva
al massimo otto risultati di coordinate in memoria. Le immagini sono validate
prima di decodificarle in un processo separato con memoria V8 limitata e termine
di cinque secondi. Il processo viene interrotto se la richiesta viene chiusa.
Gli screenshot storici troppo grandi o non validi rimangono consultabili come
originali, con un avviso sull’indisponibilità dell’evidenziazione.

## Aggiornamento

La funzione lavora sulle copie già archiviate, senza acquisirle nuovamente e
senza creare file di confronto permanenti. Account, archivio, pianificazione e
schema del database sono conservati. Esporta un backup, aggiorna l’app esistente
dal community store e verifica **0.1.7** nella barra laterale.
