# Landing Archive Community Store — anteprima amd64

Questa directory è la radice del community app store di
[Proof-of-Pizza21](https://github.com/Proof-of-Pizza21/umbrel-community-store).
Landing Archive 0.1.0 è un'anteprima per mini PC Intel/AMD a 64 bit (`linux/amd64`),
destinata al collaudo su umbrelOS 1.7.4. ARM non è incluso nella prima anteprima.

La pubblicazione dell'immagine GHCR e il digest verificato sono in preparazione.
Il collaudo sul dispositivo Umbrel non è ancora stato eseguito.

La radice da pubblicare conterrà:

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
Non è uno store ufficiale Umbrel e questa preparazione non implica approvazione
o distribuzione da parte del progetto Umbrel.
