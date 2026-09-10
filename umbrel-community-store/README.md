# Landing Archive Community Store — anteprima amd64

Questa directory è la radice del community app store di
[Proof-of-Pizza21](https://github.com/Proof-of-Pizza21/umbrel-community-store).
Landing Archive 0.1.3 è un'anteprima per mini PC Intel/AMD a 64 bit (`linux/amd64`),
destinata al collaudo su umbrelOS 1.7.4. ARM non è incluso nella prima anteprima.

Il [collaudo dei container Linux amd64](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34440663040) è riuscito: avvio con sandbox
Chromium attiva, acquisizione, copia offline, controllo manuale in pausa,
deduplicazione, backup, persistenza dopo riavvio e cancellazione confermata.
Il collaudo sul dispositivo Umbrel non è ancora stato eseguito.

## Installazione

La versione 0.1.3 usa un’immagine pubblica e verificata:

1. Apri l'App Store Umbrel e la gestione dei community app store.
2. Aggiungi [https://github.com/Proof-of-Pizza21/umbrel-community-store](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Apri **Landing Archive Community Store**, installa **Landing Archive** e avviala.
4. Crea un nome utente e una password di almeno **12 caratteri**. Non ci sono
   credenziali predefinite.
5. Aggiungi il primo dominio o una pagina, scegli l'intervallo dei controlli e
   apri la timeline dopo l'acquisizione.

La versione dell'immagine è `ghcr.io/proof-of-pizza21/landing-archive:0.1.3`.
Il pacchetto la blocca al digest verificato:
`sha256:e8cab2dd89b4f74ad251793f4328fbac98a9a7ad534e82ea185799ce76a9dfdf`. Non serve un account GitHub per scaricarla.

## Aggiornamento 0.1.3

Esporta un backup e aggiorna l’app mantenendo l’installazione esistente.
La 0.1.3 risolve il blocco di avvio Chromium causato dal profilo AppArmor
predefinito su sistemi recenti. Umbrel carica automaticamente una regola
dedicata al solo motore, mantenendo la sandbox del browser e le altre protezioni.
Non vengono modificate le impostazioni globali del sistema.

Account e archivio rimangono conservati. Riapri l’app, verifica **0.1.3** nella
barra laterale e premi **Controlla e scarica ora**. I comandi di riavvio ed
eliminazione del sito introdotti nella 0.1.2 rimangono disponibili.
Vedi [correzione e aggiornamento](https://github.com/Proof-of-Pizza21/landing-archive/blob/main/docs/RELEASE-0.1.3.md).

## Struttura del pacchetto

La radice contiene:

```text
umbrel-app-store.yml
proof-of-pizza21-landing-archive/
  umbrel-app.yml
  docker-compose.yml
  seccomp-profile.json.template
  landing-archive.apparmor.template
  hooks/pre-start
  hooks/LICENSE-MOBY
  LICENSE-PLAYWRIGHT
  assets/icon.svg
  data/.gitkeep
```

La directory `data` deve contenere soltanto `.gitkeep` nel repository pubblico.
Il profilo seccomp è un template JSON senza variabili: Umbrel lo copia anche
durante gli aggiornamenti e genera `seccomp-profile.json` prima dell'avvio.
Non aggiungere al repository l'output generato.
Prima di distribuire, completare le verifiche di release descritte nella
[guida di installazione](https://github.com/Proof-of-Pizza21/landing-archive/blob/main/docs/INSTALL.md)
del progetto applicativo e verificare gli indirizzi presenti nel manifest.

Il community store segue il
[template ufficiale Umbrel](https://github.com/getumbrel/umbrel-community-app-store).
Non è uno store ufficiale Umbrel e la sua disponibilità non implica approvazione
o distribuzione da parte del progetto Umbrel.
