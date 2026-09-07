# Componenti di terze parti

Landing Archive usa componenti open source, senza incorporare il codice di
ArchiveBox o changedetection.io. Le versioni esatte sono bloccate in
`package-lock.json`; le dipendenze transitivamente installate mantengono le loro
licenze e attribuzioni nei pacchetti distribuiti.

| Componente | Licenza dichiarata | Sorgente |
| --- | --- | --- |
| Playwright 1.63.0 | Apache-2.0 | https://github.com/microsoft/playwright |
| SingleFile Core 1.5.121 | AGPL-3.0-or-later | https://github.com/gildas-lormeau/single-file-core |
| Fastify e plugin ufficiali | MIT | https://github.com/fastify |
| React e React DOM | MIT | https://github.com/facebook/react |
| Vite | MIT | https://github.com/vitejs/vite |
| TypeScript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| esbuild | MIT | https://github.com/evanw/esbuild |
| Lucide | ISC | https://github.com/lucide-icons/lucide |
| diff | BSD-3-Clause | https://github.com/kpdecker/jsdiff |
| pixelmatch | ISC | https://github.com/mapbox/pixelmatch |
| pngjs | MIT | https://github.com/pngjs/pngjs |
| fast-xml-parser | MIT | https://github.com/NaturalIntelligence/fast-xml-parser |
| archiver | MIT | https://github.com/archiverjs/node-archiver |

Node.js e Chromium includono inoltre le licenze e attribuzioni dei loro
componenti. La distribuzione Linux dell'immagine conserva i documenti di
copyright dei pacchetti di sistema. La compilazione non elimina i file di
licenza delle dipendenze runtime.

## Profilo seccomp

`umbrel-community-store/proof-of-pizza21-landing-archive/seccomp-profile.json.template`
deriva da
https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/seccomp_profile.json.
Il testo della licenza Apache 2.0 con le attribuzioni Microsoft e Google del
progetto originale è distribuito accanto al profilo come `LICENSE-PLAYWRIGHT`.

Le modifiche di Landing Archive sono esplicitamente indicate nei commenti JSON:
risposta ENOSYS per `clone3` e autorizzazione di `close_range`, `epoll_pwait2`,
`faccessat2` per compatibilità con i runtime recenti, coerentemente con le
corrispondenti regole del profilo Docker corrente. La regola `chroot` non è
condizionata alle capability iniziali del container: Chromium la usa per
rinunciare all'accesso al filesystem dopo l'ingresso nel proprio user namespace.
Il kernel continua a verificare i privilegi del namespace e il container
mantiene `cap_drop: [ALL]`. Riferimento al sorgente Chromium:
https://chromium.googlesource.com/chromium/src/sandbox/+/refs/heads/main/linux/services/credentials.cc.
Il resto delle regole deriva dal file Playwright indicato.

## Sorgente corrispondente

Il codice originale di Landing Archive è disponibile sotto AGPL-3.0-or-later.
L'immagine include il sorgente applicativo in `/app/source`, il file di lock,
il packaging e le istruzioni di compilazione. Il collegamento al sorgente
nell'interfaccia scarica uno ZIP tramite `/api/source` per gli utenti autenticati.
Prima di pubblicare una release verificare che questo archivio corrisponda al
binario distribuito e contenga quanto serve per ricompilarlo. Pubblicare inoltre
il sorgente corrispondente insieme alla release e mantenere le licenze dei
componenti. Questo documento non sostituisce l'offerta del sorgente o gli
obblighi delle singole licenze.

I documenti e le immagini archiviati dagli utenti non sono distribuiti con
l'app e mantengono i diritti dei rispettivi titolari.
