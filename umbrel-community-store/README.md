# Landing Archive Community Store — anteprima amd64

Community app store di [Proof-of-Pizza21](https://github.com/Proof-of-Pizza21/umbrel-community-store).
Landing Archive **0.1.14** è destinata a umbrelOS 1.7.4 su mini PC Intel/AMD
64 bit. Il supporto ARM non è incluso.

La **0.1.14** corregge «Failed to fetch» all’apertura attraverso il proxy
Umbrel e conserva tutte le protezioni della 0.1.13.
[Dettagli](https://github.com/Proof-of-Pizza21/landing-archive/blob/main/docs/RELEASE-0.1.14.md).

## Installazione e aggiornamento

1. Apri la gestione dei community app store nell’App Store Umbrel.
2. Aggiungi [questo repository](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Installa **Landing Archive**, oppure aggiorna l’installazione esistente.
4. Al primo avvio crea un account con password di almeno 12 caratteri.
   Dopo un aggiornamento alla 0.1.13 accedi di nuovo con le credenziali attuali.

Scarica un backup prima di aggiornare e non disinstallare l’app. Account,
siti, impostazioni, copie e storico restano conservati; lo schema rimane 5.
Controlla **0.1.14** nella barra laterale e nello stato del motore.

## Sicurezza nella 0.1.13

- Browser aggiornato, fissato per versione e SHA-256, con sandbox attiva.
- Sessioni separate da quelle delle altre app che condividono lo stesso host.
- Anteprime e download autorizzati per singola risorsa, con scadenza breve.
- HTML elaborato in un processo limitato e ripulito anche nei vecchi download.
- Correzioni dei blocchi nella scoperta e nel ripristino; limiti più precisi
  per i campi dei backup importati.
- Il motore monta soltanto la cartella del proprio token, in sola lettura.
  Database, copie e backup restano accessibili al solo servizio web.

Il pacchetto finale viene bloccato al digest dell’immagine 0.1.14 verificata
nei container Linux. I dati esistenti restano sul dispositivo.

HTTP rimane non cifrato: usa una rete fidata, una VPN oppure un proxy HTTPS.
[Interventi e limiti](https://github.com/Proof-of-Pizza21/landing-archive/blob/main/docs/SECURITY-0.1.13.md).

## Pacchetto

L’identificatore dell’app resta `proof-of-pizza21-landing-archive`.
Il pacchetto include manifest, Compose, icona, profili seccomp/AppArmor e
relative licenze. L’hook `hooks/pre-start` prepara la sola cartella
`APP_DATA_DIR/worker-auth` e carica il profilo dedicato senza modificare
le impostazioni globali del dispositivo.

Nel repository la directory dati contiene soltanto `.gitkeep`. Token,
archivi e file seccomp generati da Umbrel non devono essere versionati.
Il community store segue il [template Umbrel](https://github.com/getumbrel/umbrel-community-app-store)
e non è uno store ufficiale del progetto Umbrel.
