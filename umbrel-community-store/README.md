# Landing Archive Community Store — anteprima amd64

Questa directory è la radice del community app store di
[Proof-of-Pizza21](https://github.com/Proof-of-Pizza21/umbrel-community-store).
Landing Archive 0.1.10 è un'anteprima per mini PC Intel/AMD a 64 bit (`linux/amd64`),
destinata al collaudo su umbrelOS 1.7.4. ARM non è incluso nella prima anteprima.

Il [collaudo dei container Linux amd64](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34868831680) è riuscito: avvio con sandbox
Chromium attiva, acquisizione, copia offline, controllo manuale in pausa,
deduplicazione, backup, persistenza dopo riavvio e cancellazione confermata.
Il collaudo di questo aggiornamento sul dispositivo Umbrel resta da eseguire.

## Installazione

La versione 0.1.10 usa un’immagine pubblica e verificata:

1. Apri l'App Store Umbrel e la gestione dei community app store.
2. Aggiungi [https://github.com/Proof-of-Pizza21/umbrel-community-store](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Apri **Landing Archive Community Store**, installa **Landing Archive** e avviala.
4. Crea un nome utente e una password di almeno **12 caratteri**. Non ci sono
   credenziali predefinite.
5. Aggiungi il primo dominio o una pagina, scegli l'intervallo dei controlli e
   apri la timeline dopo l'acquisizione.

La versione dell'immagine è `ghcr.io/proof-of-pizza21/landing-archive:0.1.10`.
Il pacchetto la blocca al digest verificato:
`sha256:97bda6fee9ed1145ddb09d9739de52ee6ac20b63bb8478c3aa854b4bbdc455a7`. Non serve un account GitHub per scaricarla.

## Aggiornamento 0.1.10

Scarica un backup e aggiorna senza disinstallare. Il database passa allo schema 4
conservando account, versioni, controlli e note. Le copie simili già presenti
rimangono; per tornare a una versione precedente serve un backup precedente.

- **Novità da leggere:** eventi per sito e periodo, preferenze, letto/da leggere
  e collegamenti alla versione che documenta la modifica.
- **Raccolta:** tag, preferiti e appunti sulla singola acquisizione, con ricerca
  e filtri combinabili.
- **Esporta sito offline:** ZIP da estrarre e aprire con index.html, cronologia,
  copie navigabili e screenshot. Non sostituisce il backup completo.
- **Backup e ripristino:** caricamento, verifica, conferma con password e copia
  di sicurezza automatica. Il ripristino mantiene il tuo account, sostituisce lo
  storico e mette tutti i siti in pausa. Limiti e procedura nella guida.

Verifica **0.1.10** nella barra laterale.
Vedi [funzioni, limiti e aggiornamento](https://github.com/Proof-of-Pizza21/landing-archive/blob/main/docs/RELEASE-0.1.10.md).

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
