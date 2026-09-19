# Correzione dell’apertura su Umbrel — 0.1.14

La 0.1.13 poteva mostrare «Failed to fetch» prima della schermata di accesso.
La prima richiesta a `/api/auth/status` escludeva tutti i cookie, compreso
quello richiesto dal proxy di Umbrel. Il proxy rispondeva con un rinvio al
proprio accesso, che il client rifiutava come previsto per proteggere le credenziali.

La 0.1.14 consente al browser di inviare i cookie nelle richieste alla stessa
origine dell’app. Il proxy può così verificare il proprio cookie e inoltrare
la richiesta. Landing Archive continua a richiedere la propria credenziale
Bearer per le API private: il cookie di Umbrel, da solo, non apre l’archivio.
I vecchi cookie di sessione di Landing Archive restano invalidi.

Restano attivi il vincolo alle API della stessa origine, il rifiuto dei
reindirizzamenti, i ticket limitati alla singola risorsa, la separazione delle
sessioni tra porte, la sandbox del browser e le altre
[protezioni della 0.1.13](SECURITY-0.1.13.md).

Il comportamento del proxy è documentato nel codice di Umbrel 1.7.4:
[autenticazione tramite cookie](https://github.com/getumbrel/umbrel/blob/1.7.4/containers/app-proxy/utils/auth.js)
e [inoltro con rimozione del cookie del proxy](https://github.com/getumbrel/umbrel/blob/1.7.4/containers/app-proxy/utils/proxy.js).

## Aggiornamento

Aggiornare dal community store senza disinstallare, poi riaprire l’app da
Umbrel. Account, impostazioni e archivio rimangono invariati; lo schema resta 5.
Se viene richiesto l’accesso, usare il nome utente e la password già esistenti.
La versione visualizzata nell’interfaccia e nel motore deve essere 0.1.14.

## Collaudo

Una prova browser dedicata attraversa un proxy locale che riproduce i passaggi
di autenticazione di Umbrel, compresa la rimozione del suo cookie prima
dell’inoltro al servizio web. Il collaudo sul dispositivo Umbrel dell’utente
resta distinto. Gli esiti delle verifiche sono riportati in [TESTING.md](TESTING.md).
