# Avvio del browser su Umbrel — 0.1.3

La versione 0.1.3 corregge un'incompatibilità tra la sandbox Chromium e il
profilo AppArmor predefinito del container su alcuni sistemi recenti.
Il sistema rifiutava `userns_create` con il profilo `docker-default`;
Chromium terminava con `Permission denied` prima di visitare la pagina.

## Correzione

Il worker usa il profilo AppArmor dedicato `landing-archive-worker`, derivato
dal [profilo Moby](https://github.com/moby/profiles/blob/apparmor/v0.2.0/apparmor/template.go).
La regola `userns` permette a Chromium di creare la propria sandbox senza
privilegi amministrativi. Rimangono i divieti di mount e di accesso alle aree
sensibili del kernel, oltre alle regole per segnali e ptrace del profilo base.
Con ABI 4 viene autorizzata esplicitamente anche la comunicazione Unix interna,
che nelle ABI precedenti era inclusa nella regola di rete.

L'hook `hooks/pre-start` carica il profilo nel kernel prima dell'avvio del
container. Umbrel 1.7.4 esegue l'hook durante installazione, aggiornamento e
avvio, compresa la ripartenza dopo il riavvio del dispositivo. La directory
`hooks` e i file `.template` fanno parte dei file copiati negli aggiornamenti:
[procedura ufficiale](https://github.com/getumbrel/umbrel/blob/1.7.4/packages/umbreld/source/modules/apps/legacy-compat/app-script).

Il caricamento riguarda soltanto il profilo con questo nome. Non vengono
modificate impostazioni globali, file sotto `/etc` o il profilo `docker-default`.
Il servizio web continua a usare il profilo predefinito. Browser e worker
conservano sandbox Chromium, seccomp, utente `1000:1000`, filesystem in sola
lettura, limiti di risorse e assenza di capability aggiuntive.

Sui parser AppArmor precedenti alla versione 4, l'hook usa ABI 3 e omette la
regola `userns`, allora non mediata separatamente. Se AppArmor è attivo ma
il caricamento del profilo fallisce, il container non deve avviarsi senza
protezione. Non è previsto un ripiego su `unconfined` o `--no-sandbox`.

## Diagnostica

L'app distingue il rifiuto della sandbox, un browser mancante e un timeout di
avvio. Il motore scrive nei log un evento `browser_startup_failed` con codice,
categoria del problema, architettura e kernel. Argomenti di avvio, URL dei siti,
credenziali e percorsi temporanei non vengono copiati nel messaggio o nel log.
L'avvio del browser e la preparazione della pagina sono fasi distinte.

## Aggiornamento

Esportare un backup e aggiornare l'installazione esistente dal community store.
Account, archivio e schema del database rimangono invariati rispetto alla 0.1.2.
Riaprire l'app, verificare **0.1.3** nella barra laterale e premere
**Controlla e scarica ora**. Un semplice riavvio del solo container non carica
un nuovo profilo: usare l'avvio o il riavvio dell'app dall'interfaccia Umbrel.

## Verifica

Il collaudo Docker viene eseguito su un host con AppArmor 4. Una prova negativa
nega esplicitamente `userns` e richiede che l'acquisizione restituisca
`BROWSER_SANDBOX_DENIED`. Il profilo distribuito viene poi caricato due volte
per verificarne il riutilizzo e provato con browser, acquisizione reale,
backup, riavvio e comandi manuali. Gli esiti vengono registrati dopo il
completamento delle prove; il test sul dispositivo resta distinto dal runner.
