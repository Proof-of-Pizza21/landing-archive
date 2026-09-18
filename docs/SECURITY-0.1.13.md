# Aggiornamento di sicurezza 0.1.13

L’aggiornamento conserva account, impostazioni, copie e storico. Le sessioni
precedenti vengono invalidate: occorre accedere nuovamente con le credenziali
attuali. Lo schema del database rimane 5. Non vengono eseguite pulizie automatiche.

| Area | Correzione | Verifica prevista |
| --- | --- | --- |
| Browser | Chrome Headless Shell 153.0.8010.52, pacchetto ufficiale fissato per URL e SHA-256 indipendentemente da Playwright | Versione effettiva e sandbox attiva nel container Linux |
| Sessioni | Credenziale in `sessionStorage`, inviata come Bearer soltanto alle API della stessa origine; i vecchi cookie non autorizzano più l’accesso | Browser reale con due app sullo stesso host e porte diverse |
| File e anteprime | Ticket di 60 secondi legato a risorsa, query e sessione, revocato all’uscita; download in streaming | Screenshot, iframe, HTML e ZIP; rifiuto di percorsi, date, metodi e sessioni differenti |
| HTML complesso | Processo separato, heap 256 MiB, termine esterno di 8 secondi, un processo attivo e due richieste in attesa; controllo preliminare di attributi e profondità | Input con 120.000 attributi, alberi profondi, annullamento e disponibilità del processo principale |
| Contenuto attivo | Pulizia finale fuori dal JavaScript del sito e CSP incorporata; medesima protezione per vecchi download HTML, vista offline ed esportazione navigabile | Script, eventi, refresh, SVG e collegamenti ostili |
| Scoperta | Analisi progressiva dei tag senza ricerca ripetuta sull’intera parte restante della pagina | Quasi 3 MB di commenti e script senza chiusura, con termine esterno |
| Ripristino | Il blocco attende le vere mutazioni, senza trattenere richieste interrotte prima dell’handler | HTTP reale interrotto, operazioni asincrone disconnesse e corpi completati durante manutenzione |
| Backup importati | Limiti per campo verificati prima della materializzazione delle righe SQLite e del parsing JSON | Campi eccessivi, metadati gonfiati e valori Unicode ai confini; archivio attuale intatto |
| Worker | Monta soltanto la cartella del proprio token, in sola lettura; database, copie e backup non sono montati | Avvio senza directory archivio; migrazione e rotazione del token |

La consegna di risorse dal motore al codice di acquisizione ha inoltre un limite
complessivo, compresi gli accessi serviti dalla cache, e al massimo quattro
operazioni simultanee. L’HTML oltre 32 MiB o strutturalmente eccessivo viene
rifiutato senza modificare copie già conservate. Il backup completo resta un
formato di ripristino: contiene gli oggetti originali, mentre la successiva
consultazione e i download HTML applicano nuovamente la pulizia.

Il controllo dell’immagine blocca anche gli avvisi con correzione disponibile
ma gravità non classificata, oltre a quelli alti e critici. I conteggi degli
avvisi distinguono gli identificatori CVE dalle altre segnalazioni. Uno scanner
di pacchetti non prova l’assenza di vulnerabilità nel browser: per questo la
versione dell’eseguibile viene controllata esplicitamente.

## Limiti residui

- HTTP non cifra il traffico. L’app è destinata a rete locale fidata, VPN o
  accesso attraverso un proxy HTTPS amministrato separatamente. La migrazione
  rimuove il problema del flag Secure dei cookie di sessione, perché quei cookie
  non sono più usati; non aggiunge TLS al collegamento.
- Il browser e le librerie richiedono manutenzione periodica. Nessun risultato
  dei test equivale a una garanzia di assenza di vulnerabilità o a un pentest del
  dispositivo Umbrel effettivo.
- Per cronologie molto grandi resta da introdurre la paginazione dell’elenco
  delle versioni della singola pagina; i controlli sono già paginati. Non è
  stato riprodotto un ulteriore arresto legato a questo caso.
- Le protezioni del processo limitano l’impatto di contenuti complessi. Una
  compromissione del servizio web avrebbe comunque accesso al suo archivio;
  i backup su un dispositivo separato restano necessari.
- La compatibilità completa delle sandbox dipende anche dal kernel e dalla
  configurazione del dispositivo. Le restrizioni non vengono disattivate in
  caso di errore: il motore segnala il mancato avvio.

Riferimenti per il browser: [feed ufficiale Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/),
[aggiornamenti di sicurezza Chrome](https://chromereleases.googleblog.com/),
[browser Playwright](https://playwright.dev/docs/browsers).

I risultati del collaudo sono riportati in [TESTING.md](TESTING.md). Il community
store viene aggiornato al digest effettivo solo dopo i controlli Linux.
