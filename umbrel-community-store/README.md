# Landing Archive Community Store — anteprima amd64

Questa directory è la radice del community app store di
[Proof-of-Pizza21](https://github.com/Proof-of-Pizza21/umbrel-community-store).
Landing Archive 0.1.7 è un'anteprima per mini PC Intel/AMD a 64 bit (`linux/amd64`),
destinata al collaudo su umbrelOS 1.7.4. ARM non è incluso nella prima anteprima.

Il [collaudo dei container Linux amd64](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34781450322) è riuscito: avvio con sandbox
Chromium attiva, acquisizione, copia offline, controllo manuale in pausa,
deduplicazione, backup, persistenza dopo riavvio e cancellazione confermata.
Il collaudo sul dispositivo Umbrel non è ancora stato eseguito.

## Installazione

La versione 0.1.7 usa un’immagine pubblica e verificata:

1. Apri l'App Store Umbrel e la gestione dei community app store.
2. Aggiungi [https://github.com/Proof-of-Pizza21/umbrel-community-store](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Apri **Landing Archive Community Store**, installa **Landing Archive** e avviala.
4. Crea un nome utente e una password di almeno **12 caratteri**. Non ci sono
   credenziali predefinite.
5. Aggiungi il primo dominio o una pagina, scegli l'intervallo dei controlli e
   apri la timeline dopo l'acquisizione.

La versione dell'immagine è `ghcr.io/proof-of-pizza21/landing-archive:0.1.7`.
Il pacchetto la blocca al digest verificato:
`sha256:ccf753e8c20d053bd8c48ebb3390955ea00be0d3d2374838cbbe213ac3271ce8`. Non serve un account GitHub per scaricarla.

## Aggiornamento 0.1.7

Esporta un backup e aggiorna l’app mantenendo l’installazione esistente.
La 0.1.7 aggiunge l’evidenziazione delle modifiche: apri una pagina, scegli una
versione e premi **Confronta**. In **Aspetto** le aree arancioni racchiudono le
differenze. Le frecce e **Vai alla zona** portano al punto selezionato; le copie
scorrono insieme. Puoi nascondere le evidenziazioni per leggere gli originali.

Il riepilogo distingue testo, titolo, intestazioni, collegamenti, indirizzi
delle immagini e destinazione finale. Uno screenshot identico non viene
presentato come una modifica visiva quando cambia soltanto un indirizzo.
La funzione usa le copie esistenti, senza riscaricare i siti e senza creare
altri file nell’archivio. Account, dati e soglie di rilevamento sono conservati.
Verifica **0.1.7** nella barra laterale.
Vedi [funzioni, limiti e aggiornamento](https://github.com/Proof-of-Pizza21/landing-archive/blob/main/docs/RELEASE-0.1.7.md).

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
