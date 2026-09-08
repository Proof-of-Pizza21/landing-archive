# Landing Archive Community Store — anteprima amd64

Questa directory è la radice del community app store di
[Proof-of-Pizza21](https://github.com/Proof-of-Pizza21/umbrel-community-store).
Landing Archive 0.1.0 è un'anteprima per mini PC Intel/AMD a 64 bit (`linux/amd64`),
destinata al collaudo su umbrelOS 1.7.4. ARM non è incluso nella prima anteprima.

Il [collaudo dei container Linux amd64](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34147293202) è riuscito: avvio con sandbox
Chromium attiva, acquisizione, copia offline, controllo invariato, backup e
persistenza dopo riavvio. Il collaudo sul dispositivo Umbrel non è ancora stato
eseguito.

## Installazione

La versione 0.1.0 usa un’immagine pubblica e verificata:

1. Apri l'App Store Umbrel e la gestione dei community app store.
2. Aggiungi [https://github.com/Proof-of-Pizza21/umbrel-community-store](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Apri **Landing Archive Community Store**, installa **Landing Archive** e avviala.
4. Crea un nome utente e una password di almeno **12 caratteri**. Non ci sono
   credenziali predefinite.
5. Aggiungi il primo dominio o una pagina, scegli l'intervallo dei controlli e
   apri la timeline dopo l'acquisizione.

La versione dell'immagine è `ghcr.io/proof-of-pizza21/landing-archive:0.1.0`.
Il pacchetto la blocca al digest verificato:
`sha256:beb2bfd0c0c79bf632457f753fe8ee05a6bfbbc33c93719483db73e055cd3cd7`. Non serve un account GitHub per scaricarla.

## Struttura del pacchetto

La radice contiene:

```text
umbrel-app-store.yml
proof-of-pizza21-landing-archive/
  umbrel-app.yml
  docker-compose.yml
  seccomp-profile.json.template
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
