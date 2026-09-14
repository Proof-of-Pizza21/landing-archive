# Landing Archive Community Store — anteprima amd64

Questa directory è la radice del community app store di
[Proof-of-Pizza21](https://github.com/Proof-of-Pizza21/umbrel-community-store).
Landing Archive 0.1.8 è un'anteprima per mini PC Intel/AMD a 64 bit (`linux/amd64`),
destinata al collaudo su umbrelOS 1.7.4. ARM non è incluso nella prima anteprima.

Il [collaudo dei container Linux amd64](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34835300152) è riuscito: avvio con sandbox
Chromium attiva, acquisizione, copia offline, controllo manuale in pausa,
deduplicazione, backup, persistenza dopo riavvio e cancellazione confermata.
Il collaudo sul dispositivo Umbrel non è ancora stato eseguito.

## Installazione

La versione 0.1.8 usa un’immagine pubblica e verificata:

1. Apri l'App Store Umbrel e la gestione dei community app store.
2. Aggiungi [https://github.com/Proof-of-Pizza21/umbrel-community-store](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Apri **Landing Archive Community Store**, installa **Landing Archive** e avviala.
4. Crea un nome utente e una password di almeno **12 caratteri**. Non ci sono
   credenziali predefinite.
5. Aggiungi il primo dominio o una pagina, scegli l'intervallo dei controlli e
   apri la timeline dopo l'acquisizione.

La versione dell'immagine è `ghcr.io/proof-of-pizza21/landing-archive:0.1.8`.
Il pacchetto la blocca al digest verificato:
`sha256:cdf09865c06931405eec31c2162f7d42303b8c2975729e6fe651654db3fc2483`. Non serve un account GitHub per scaricarla.

## Aggiornamento 0.1.8

Esporta un backup e aggiorna senza disinstallare. Le copie simili già presenti
non vengono eliminate. Il database passa allo schema 3 conservando account,
note, versioni e controlli; un ritorno alla 0.1.7 richiede un backup precedente.

- I piccoli spostamenti e i parametri pubblicitari noti non generano copie superflue.
- Le acquisizioni incomplete sono segnalate e ricontrollate; i cambiamenti di
  testo continuano a essere conservati anche quando manca un’immagine.
- **Zone da monitorare** permette di scegliere con un clic cosa ignorare o
  seguire con attenzione, verificando la selezione su due copie.
- **Vita delle landing** mostra scoperte, modifiche, scomparse e ritorni online.
  La presenza in sitemap è separata dalla raggiungibilità HTTP.
- Le impostazioni permettono di scegliere la frequenza di scoperta e i percorsi.

Verifica **0.1.8** nella barra laterale.
Vedi [funzioni, limiti e aggiornamento](https://github.com/Proof-of-Pizza21/landing-archive/blob/main/docs/RELEASE-0.1.8.md).

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
