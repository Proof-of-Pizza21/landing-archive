// Application messages only. Never translate archived content or user input.
// Pairs are [English, Italian]; Italian aliases also localize historical worker messages.
export const translations: readonly (readonly [string, string])[] = [
  [
    "Fresh scan",
    "Scansione pulita"
  ],
  [
    "Evidence saved",
    "Evidenza conservata"
  ],
  [
    "Copy needs review",
    "Copia da verificare"
  ],
  [
    "Rules updated",
    "Regole aggiornate"
  ],
  [
    "Copy completed",
    "Copia completata"
  ],
  [
    "Absent from sitemap",
    "Fuori dalla sitemap"
  ],
  [
    "Back in sitemap",
    "Rientrata nella sitemap"
  ],
  [
    "Archived",
    "Archiviata"
  ],
  [
    "Needs review",
    "Da verificare"
  ],
  [
    "Back online",
    "Tornata online"
  ],
  [
    "Changed",
    "Modificata"
  ],
  [
    "First copy",
    "Prima copia"
  ],
  [
    "Unchanged",
    "Invariata"
  ],
  [
    "Error",
    "Errore"
  ],
  [
    "Unreachable",
    "Non raggiungibile"
  ],
  [
    "Previous version returned",
    "Versione ritornata"
  ],
  [
    "Stopped",
    "Interrotto"
  ],
  [
    "Queued",
    "In attesa"
  ],
  [
    "Running",
    "In corso"
  ],
  [
    "Completed",
    "Completato"
  ],
  [
    "Access blocked",
    "Accesso bloccato"
  ],
  [
    "Page discovered",
    "Pagina scoperta"
  ],
  [
    "Page discovery",
    "Ricerca pagine"
  ],
  [
    "Capture",
    "Acquisizione"
  ],
  [
    "Checked",
    "Controllata"
  ],
  [
    "Not captured yet",
    "Da acquisire"
  ],
  [
    "Loading",
    "Caricamento"
  ],
  [
    "Priority manual check requested. Its status will update below.",
    "Controllo manuale prioritario richiesto. Lo stato si aggiorna qui sotto."
  ],
  [
    "Stop the current attempt and start a new check.",
    "Interrompe il tentativo corrente e avvia un nuovo controllo."
  ],
  [
    "Download the page again even when monitoring is paused. Save a new version when changes are detected.",
    "Scarica di nuovo la pagina anche se il monitoraggio è in pausa. Conserva una nuova versione quando rileva modifiche."
  ],
  [
    "Requesting…",
    "Richiesta in corso…"
  ],
  [
    "Restart check",
    "Riavvia controllo"
  ],
  [
    "Download now",
    "Scarica ora"
  ],
  [
    "Check and download now",
    "Controlla e scarica ora"
  ],
  [
    "Capture status",
    "Stato acquisizioni"
  ],
  [
    "Next attempt: {p0}",
    "Nuovo tentativo previsto: {p0}"
  ],
  [
    "Check ready, waiting for the engine",
    "Controllo pronto, in attesa del motore"
  ],
  [
    "Automatic monitoring paused",
    "Monitoraggio automatico in pausa"
  ],
  [
    "No capture in progress",
    "Nessuna acquisizione in corso"
  ],
  [
    "· attempt",
    "· tentativo"
  ],
  [
    "/3. Each job can take up to 3 minutes.",
    "/3. Il tempo massimo per un lavoro è 3 minuti."
  ],
  [
    "checks queued",
    "controlli in attesa"
  ],
  [
    ". Manual checks take priority.",
    ". I controlli manuali hanno la precedenza."
  ],
  [
    "Manual checks also work while paused and do not resume the schedule.",
    "Il comando manuale funziona anche in pausa e non riattiva la pianificazione."
  ],
  [
    "“Check and download now” starts a new visit. If the content is unchanged, the check is recorded without duplicating the version.",
    "«Controlla e scarica ora» avvia una nuova visita. Se il contenuto è invariato, viene registrato il controllo senza duplicare la versione."
  ],
  [
    "“Restart check” stops the current attempt.",
    "«Riavvia controllo» interrompe il tentativo corrente."
  ],
  [
    "Last recorded error",
    "Ultimo errore registrato"
  ],
  [
    "Delete site from the archive",
    "Elimina sito dall’archivio"
  ],
  [
    "This will delete",
    "Verranno eliminati"
  ],
  [
    "page",
    "pagina"
  ],
  [
    "pages",
    "pagine"
  ],
  [
    "versions",
    "versioni"
  ],
  [
    ", notes and history for this site. Running and scheduled checks will be cancelled.",
    ", note e cronologia di questo sito. I controlli in corso e quelli programmati saranno annullati."
  ],
  [
    "Files shared with other sites will be kept. This cannot be undone in the app; recovering copies requires an earlier backup.",
    "I file usati anche da altri siti verranno conservati. Questa operazione non può essere annullata dall’app; per recuperare le copie serve un backup precedente."
  ],
  [
    "Download an archive backup first",
    "Scarica prima un backup dell’archivio"
  ],
  [
    "I confirm that I want to delete this site and its archived copies.",
    "Confermo l’eliminazione del sito e delle sue copie archiviate."
  ],
  [
    "Cancel",
    "Annulla"
  ],
  [
    "Delete permanently",
    "Elimina definitivamente"
  ],
  [
    "Clear copies and scan again",
    "Azzera copie e riscarica"
  ],
  [
    "Some unshared files could not be removed from disk. Check the data volume permissions.",
    "Alcuni file non condivisi non sono stati rimossi dal disco: controlla i permessi del volume dati."
  ],
  [
    "Preparing preview…",
    "Preparazione dell’anteprima…"
  ],
  [
    "This will delete",
    "Verranno eliminate"
  ],
  [
    "all",
    "tutte le"
  ],
  [
    "copies",
    "copie"
  ],
  [
    "for this site, including screenshots, HTML, favorites, tags and notes on individual copies",
    "di questo sito, inclusi screenshot e HTML, preferiti, tag e appunti sulle singole copie"
  ],
  [
    "({p0} annotated or favorite copies)",
    "({p0} copie annotate o preferite)"
  ],
  [
    "The site, its",
    "Rimangono il sito, i"
  ],
  [
    "addresses, settings and page notes will be kept. The new scan starts from scratch, without comparing against old copies. Check dates remain recorded with a note that their files were removed.",
    "indirizzi, le impostazioni e le note delle pagine. La nuova scansione partirà da zero, senza confrontarsi con le vecchie copie. Le date dei controlli rimangono registrate con l’indicazione dei file rimossi."
  ],
  [
    "Reclaimable space:",
    "Spazio recuperabile:"
  ],
  [
    ". Files shared with other sites remain available. Recovering deleted copies requires an earlier backup; a new scan cannot recreate pages that are no longer online.",
    ". I file usati da altri siti rimangono disponibili. Per recuperare le copie eliminate serve un backup precedente; se il sito oggi non è raggiungibile, la nuova scansione non potrà ricrearle."
  ],
  [
    "I confirm that I want to delete all copies of",
    "Confermo l’eliminazione di tutte le copie di"
  ],
  [
    "and start a fresh scan.",
    "e l’avvio di una scansione pulita."
  ],
  [
    "Refresh preview",
    "Aggiorna anteprima"
  ],
  [
    "Confirm reset and scan",
    "Conferma azzeramento e scansione"
  ],
  [
    "Retry",
    "Riprova"
  ],
  [
    "Opening the archive",
    "Apertura dell’archivio"
  ],
  [
    "Your websites, remembered",
    "La memoria dei tuoi siti"
  ],
  [
    "The passwords do not match.",
    "Le due password non coincidono."
  ],
  [
    "YOUR WEB OBSERVATORY",
    "IL TUO OSSERVATORIO WEB"
  ],
  [
    "Pages change.",
    "Le pagine cambiano."
  ],
  [
    "Their history stays.",
    "La loro storia resta."
  ],
  [
    "Save landing pages, revisit past offers and follow how the websites you track evolve.",
    "Conserva le landing, ritrova le offerte passate e osserva come si evolvono i siti che segui."
  ],
  [
    "Follow websites",
    "Segui i siti"
  ],
  [
    "Keep their versions",
    "Conserva le versioni"
  ],
  [
    "Explore their history",
    "Esplora la storia"
  ],
  [
    "Your archive stays on your device.",
    "Il tuo archivio rimane sul tuo dispositivo."
  ],
  [
    "Set up your access.",
    "Prepariamo il tuo accesso."
  ],
  [
    "Create a local account to protect your sites, captures and notes.",
    "Crea un account locale per proteggere siti, catture e annotazioni."
  ],
  [
    "Sign in to explore the history of the sites you follow.",
    "Accedi per consultare la storia dei siti che segui."
  ],
  [
    "Username",
    "Nome utente"
  ],
  [
    "At least 12 characters. Keep it somewhere safe.",
    "Almeno 12 caratteri. Conservala in un posto sicuro."
  ],
  [
    "Repeat password",
    "Ripeti la password"
  ],
  [
    "Create your archive",
    "Crea il tuo archivio"
  ],
  [
    "Sign in",
    "Accedi"
  ],
  [
    "Site deleted. Some files could not be removed from disk. Check the data volume permissions.",
    "Sito eliminato. Alcuni file non sono stati rimossi dal disco: controlla i permessi del volume dati."
  ],
  [
    "Site and archive deleted. Files shared with other sites have been kept.",
    "Sito e archivio eliminati. I file condivisi con altri siti sono conservati."
  ],
  [
    "YOUR ARCHIVE",
    "IL TUO ARCHIVIO"
  ],
  [
    "Main navigation",
    "Navigazione principale"
  ],
  [
    "Overview",
    "Panoramica"
  ],
  [
    "Monitored sites",
    "Siti monitorati"
  ],
  [
    "Updates",
    "Novità da leggere"
  ],
  [
    "Collection",
    "Raccolta"
  ],
  [
    "RECENT SITES",
    "SITI RECENTI"
  ],
  [
    "Add site",
    "Aggiungi sito"
  ],
  [
    "One of your sites",
    "Un tuo sito"
  ],
  [
    "Sites you add will appear here.",
    "I siti che aggiungi compariranno qui."
  ],
  [
    "Local archive",
    "Archivio locale"
  ],
  [
    "Your data, on your device",
    "I tuoi dati, sul tuo dispositivo"
  ],
  [
    "Backup and restore",
    "Backup e ripristino"
  ],
  [
    "Sign out",
    "Esci"
  ],
  [
    "Close navigation",
    "Chiudi navigazione"
  ],
  [
    "Open navigation",
    "Apri navigazione"
  ],
  [
    "Archive",
    "Archivio"
  ],
  [
    "Detail",
    "Dettaglio"
  ],
  [
    "Search archived pages",
    "Cerca pagine nell’archivio"
  ],
  [
    "Search the archive…",
    "Cerca nell’archivio…"
  ],
  [
    "Clear search",
    "Cancella ricerca"
  ],
  [
    "No pages found.",
    "Nessuna pagina trovata."
  ],
  [
    "Capturing pages",
    "Acquisizioni in corso"
  ],
  [
    "Checks queued",
    "Controlli in attesa"
  ],
  [
    "Monitoring active",
    "Monitoraggio attivo"
  ],
  [
    "Archive ready",
    "Archivio pronto"
  ],
  [
    "Captures unavailable",
    "Acquisizioni non disponibili"
  ],
  [
    "Dismiss error",
    "Chiudi errore"
  ],
  [
    "The capture service is not running. Check the app status in Umbrel.",
    "Il servizio di acquisizione non è attivo. Controlla lo stato dell’app in Umbrel."
  ],
  [
    "Automatic checks are disabled. Use “Check and download now” for a manual visit.",
    "I controlli automatici sono disattivati. Puoi usare «Controlla e scarica ora» per una visita manuale."
  ],
  [
    "Free disk space is below the safety threshold. New captures are paused; existing versions remain available.",
    "Lo spazio libero è sotto la soglia di sicurezza. Le nuove acquisizioni sono sospese; le versioni esistenti restano disponibili."
  ],
  [
    "Loading the archive",
    "Caricamento dell’archivio"
  ],
  [
    "Page unavailable",
    "Pagina non disponibile"
  ],
  [
    "Back to overview",
    "Torna alla panoramica"
  ],
  [
    "The requested content is not available in the archive.",
    "Il contenuto richiesto non è disponibile nell’archivio."
  ],
  [
    "Captures stay in your local archive",
    "Le catture restano nel tuo archivio locale"
  ],
  [
    "Source code · AGPL-3.0",
    "Codice sorgente · AGPL-3.0"
  ],
  [
    "Site added. The first capture is queued.",
    "Sito aggiunto. La prima acquisizione è in coda."
  ],
  [
    "Site settings saved.",
    "Impostazioni del sito salvate."
  ],
  [
    "Dismiss notification",
    "Chiudi notifica"
  ],
  [
    "EVERY CHANGE, IN ITS PLACE",
    "OGNI CAMBIAMENTO, AL SUO POSTO"
  ],
  [
    "The web changes. Keep the story.",
    "Il web cambia. Tu tieni il filo."
  ],
  [
    "The history of your sites and competitors, collected day by day.",
    "La storia dei tuoi siti e dei competitor, raccolta giorno dopo giorno."
  ],
  [
    "Discovered pages",
    "Pagine scoperte"
  ],
  [
    "Landing pages and pages in your archive",
    "Landing e pagine nell’archivio"
  ],
  [
    "Saved versions",
    "Versioni conservate"
  ],
  [
    "Copies saved over time",
    "Copie salvate nel tempo"
  ],
  [
    "Archive storage",
    "Spazio archivio"
  ],
  [
    "{p0} free on disk",
    "{p0} liberi sul disco"
  ],
  [
    "THE FIRST PAGE OF YOUR HISTORY",
    "LA PRIMA PAGINA DELLA TUA STORIA"
  ],
  [
    "Which site shall we start with?",
    "Da quale sito cominciamo?"
  ],
  [
    "Add a domain or landing page. We will save a first copy and check for changes at the interval you choose.",
    "Aggiungi un dominio o una landing. Conserveremo una prima copia e controlleremo i cambiamenti alla frequenza che scegli."
  ],
  [
    "Add your first site",
    "Aggiungi il primo sito"
  ],
  [
    "Sites you follow",
    "I siti che segui"
  ],
  [
    "A starting point for every story.",
    "Un punto di partenza per ogni storia."
  ],
  [
    "View all",
    "Vedi tutti"
  ],
  [
    "Recent activity",
    "Ultimi movimenti"
  ],
  [
    "New pages, versions and checks.",
    "Nuove pagine, versioni e controlli."
  ],
  [
    "Capture engine and temporary storage status",
    "Stato del motore e dello spazio temporaneo"
  ],
  [
    "Capture engine",
    "Motore di acquisizione"
  ],
  [
    "· Engine",
    "· Motore"
  ],
  [
    "version unavailable",
    "versione non disponibile"
  ],
  [
    "The app and engine are incompatible. Update the engine in Umbrel to version",
    "App e motore non sono compatibili. Aggiorna il motore in Umbrel alla versione"
  ],
  [
    "; your saved copies remain available.",
    "; le copie già salvate restano disponibili."
  ],
  [
    "Engine ready for captures.",
    "Motore disponibile per le acquisizioni."
  ],
  [
    "Engine temporarily unavailable.",
    "Motore temporaneamente non disponibile."
  ],
  [
    "Temporary samples",
    "Campioni temporanei"
  ],
  [
    "of",
    "su"
  ],
  [
    "samples",
    "campioni"
  ],
  [
    "Ordinary samples expire within",
    "I campioni ordinari scadono entro"
  ],
  [
    "hours. New evidence stays in the archive.",
    "ore. Le evidenze nuove restano nell’archivio."
  ],
  [
    "Temporary storage is full: further anomaly samples may not be saved.",
    "Spazio temporaneo esaurito: ulteriori campioni delle anomalie possono non essere conservati."
  ],
  [
    "Capture queue",
    "Acquisizioni in coda"
  ],
  [
    "running ·",
    "in corso ·"
  ],
  [
    "queued",
    "in attesa"
  ],
  [
    "A landing page can disappear. Your copy stays.",
    "Una landing può sparire. La tua copia rimane."
  ],
  [
    "Add addresses found in ads and newsletters too: pages without public links may not be discovered by the scan.",
    "Aggiungi anche gli indirizzi trovati negli annunci e nelle newsletter: le pagine senza collegamenti pubblici possono sfuggire alla scansione."
  ],
  [
    "Paused",
    "In pausa"
  ],
  [
    "The story starts with the first check.",
    "La storia comincia con il primo controllo."
  ],
  [
    "Activity from your sites will appear here.",
    "Qui compariranno i movimenti dei tuoi siti."
  ],
  [
    "YOUR OBSERVATORY",
    "IL TUO OSSERVATORIO"
  ],
  [
    "Follow your projects and see how competitors evolve.",
    "Segui i tuoi progetti e osserva come si muovono i competitor."
  ],
  [
    "All sites",
    "Tutti i siti"
  ],
  [
    "My sites",
    "I miei siti"
  ],
  [
    "Filter sites",
    "Filtra siti"
  ],
  [
    "Filter by name or domain",
    "Filtra per nome o dominio"
  ],
  [
    "My site",
    "Il mio sito"
  ],
  [
    "Pages",
    "Pagine"
  ],
  [
    "Versions",
    "Versioni"
  ],
  [
    "Monitoring paused",
    "Monitoraggio in pausa"
  ],
  [
    "Check every {p0} h",
    "Controllo ogni {p0} h"
  ],
  [
    "Last:",
    "Ultimo:"
  ],
  [
    "Delete",
    "Elimina"
  ],
  [
    "No matching sites",
    "Nessun sito corrispondente"
  ],
  [
    "Your archive starts with an address",
    "Il tuo archivio parte da un indirizzo"
  ],
  [
    "Try changing the filter or search.",
    "Prova a cambiare filtro o ricerca."
  ],
  [
    "Add your first site to start keeping its history.",
    "Aggiungi il primo sito per iniziare a conservarne la storia."
  ],
  [
    "Export offline site",
    "Esporta sito offline"
  ],
  [
    "Settings",
    "Impostazioni"
  ],
  [
    "Delete site",
    "Elimina sito"
  ],
  [
    "Every",
    "Ogni"
  ],
  [
    "hours",
    "ore"
  ],
  [
    "Schedule paused",
    "Pianificazione sospesa"
  ],
  [
    "Next check: {p0}",
    "Prossimo controllo: {p0}"
  ],
  [
    "New landing discovery every",
    "Ricerca nuove landing ogni"
  ],
  [
    "Last discovery:",
    "Ultima ricerca:"
  ],
  [
    "Automatic discovery paused",
    "Ricerca automatica in pausa"
  ],
  [
    "Next discovery: {p0}",
    "Prossima ricerca: {p0}"
  ],
  [
    "A manual site check also discovers new addresses.",
    "Il controllo manuale del sito include anche la ricerca di nuovi indirizzi."
  ],
  [
    "Site activity",
    "Attività del sito"
  ],
  [
    "The history of checks and discoveries.",
    "La cronologia dei controlli e delle scoperte."
  ],
  [
    "Found a new landing page?",
    "Hai trovato una nuova landing?"
  ],
  [
    "Addresses found only in ads, emails or private areas can be missed by automatic discovery. Add them here to track their history.",
    "Gli indirizzi presenti solo in annunci, email o aree riservate possono sfuggire alla ricerca automatica. Aggiungili qui per seguirne la storia."
  ],
  [
    "Add an address",
    "Aggiungi un indirizzo"
  ],
  [
    "Earlier versions remain available even when a page changes or disappears.",
    "Le versioni precedenti rimangono disponibili anche quando una pagina cambia o scompare."
  ],
  [
    "Page added. The first capture is queued.",
    "Pagina aggiunta. La prima acquisizione è in coda."
  ],
  [
    "PAGE HISTORY",
    "STORIA DELLA PAGINA"
  ],
  [
    "History summary",
    "Riepilogo dello storico"
  ],
  [
    "confirmed",
    "confermate"
  ],
  [
    "evidence to review",
    "evidenze da verificare"
  ],
  [
    "earlier copies",
    "copie precedenti"
  ],
  [
    "recorded checks",
    "controlli registrati"
  ],
  [
    "A difference observed on",
    "Una differenza osservata il"
  ],
  [
    "still needs verification. The previous reference remains available.",
    "è ancora da verificare. Il riferimento precedente resta disponibile."
  ],
  [
    "You can repeat the check manually.",
    "Puoi ripetere il controllo manualmente."
  ],
  [
    "The limit for closely spaced attempts has been reached; monitoring continues at the site's regular interval.",
    "Raggiunto il limite dei tentativi ravvicinati; il monitoraggio prosegue alla frequenza del sito."
  ],
  [
    "A confirmation check is scheduled.",
    "È previsto un controllo di conferma."
  ],
  [
    "At least two versions are needed for comparison",
    "Servono almeno due versioni per il confronto"
  ],
  [
    "Compare",
    "Confronta"
  ],
  [
    "Checks",
    "Controlli"
  ],
  [
    "Monitoring areas",
    "Zone da monitorare"
  ],
  [
    "Last check:",
    "Ultimo controllo:"
  ],
  [
    "Offline page",
    "Pagina offline"
  ],
  [
    "Desktop view",
    "Vista desktop"
  ],
  [
    "Captured",
    "Acquisita"
  ],
  [
    "Preview unavailable",
    "Anteprima non disponibile"
  ],
  [
    "You can browse the offline page or download the HTML copy.",
    "Puoi consultare la pagina offline o scaricare la copia HTML."
  ],
  [
    "Open full screenshot",
    "Apri lo screenshot completo"
  ],
  [
    "Screenshot of {p0}, captured on {p1}",
    "Screenshot di {p0} acquisito il {p1}"
  ],
  [
    "Download HTML",
    "Scarica HTML"
  ],
  [
    "Screenshot of the archived page.",
    "Screenshot della pagina archiviata."
  ],
  [
    "The first capture failed",
    "La prima acquisizione non è riuscita"
  ],
  [
    "No archived versions",
    "Nessuna versione archiviata"
  ],
  [
    "Once the capture completes, you can explore the page and its versions here.",
    "Quando l’acquisizione sarà completata, qui potrai esplorare la pagina e le sue versioni."
  ],
  [
    "All observations",
    "Tutte le osservazioni"
  ],
  [
    "Checks, anomalies and returns to earlier variants, in the order they happened.",
    "Controlli, anomalie e ritorni a varianti precedenti, nell’ordine in cui sono avvenuti."
  ],
  [
    "Your observations",
    "Le tue osservazioni"
  ],
  [
    "Promises, offers, experiments: keep the context alongside the page.",
    "Promesse, offerte, esperimenti: conserva il contesto insieme alla pagina."
  ],
  [
    "Page notes",
    "Annotazioni sulla pagina"
  ],
  [
    "Write what you noticed on this landing page…",
    "Scrivi cosa hai notato in questa landing…"
  ],
  [
    "Visible changes can suggest hypotheses; they do not reveal conversion results.",
    "Le modifiche visibili aiutano a formulare ipotesi; non rivelano i risultati di conversione."
  ],
  [
    "Notes saved.",
    "Annotazioni salvate."
  ],
  [
    "Save page notes",
    "Salva note"
  ],
  [
    "Close window",
    "Chiudi finestra"
  ],
  [
    "Site settings",
    "Impostazioni del sito"
  ],
  [
    "Add a site",
    "Aggiungi un sito"
  ],
  [
    "Choose how to follow its evolution.",
    "Decidi come seguire la sua evoluzione."
  ],
  [
    "An address today, a history to explore tomorrow.",
    "Un indirizzo oggi, una storia da consultare domani."
  ],
  [
    "Site name",
    "Nome del sito"
  ],
  [
    "How you want it to appear in the archive",
    "Come vuoi chiamarlo nell’archivio"
  ],
  [
    "Starting address",
    "Indirizzo iniziale"
  ],
  [
    "Start from a domain or a specific landing page.",
    "Puoi partire dal dominio o da una landing specifica."
  ],
  [
    "This site is",
    "Questo sito è"
  ],
  [
    "One of my sites",
    "Un mio sito"
  ],
  [
    "A competitor",
    "Un competitor"
  ],
  [
    "Check pages every",
    "Controlla le pagine ogni"
  ],
  [
    "Page limit per site",
    "Limite di pagine per sito"
  ],
  [
    "Discover new landing pages every",
    "Cerca nuove landing ogni"
  ],
  [
    "Discovery of new addresses and checks of known pages have independent schedules. Jobs run one at a time.",
    "La ricerca di nuovi indirizzi e i controlli delle pagine già note hanno frequenze indipendenti. I lavori vengono eseguiti uno alla volta."
  ],
  [
    "Include subdomains",
    "Includi anche i sottodomini"
  ],
  [
    "Find linked public pages on subdomains of the same site.",
    "Per trovare pagine pubbliche collegate su sottodomini dello stesso sito."
  ],
  [
    "Pause monitoring",
    "Metti in pausa il monitoraggio"
  ],
  [
    "Previously archived copies remain available.",
    "Le copie già archiviate restano consultabili."
  ],
  [
    "Advanced options",
    "Opzioni avanzate"
  ],
  [
    "Discover landing pages under these paths",
    "Cerca nuove landing in questi percorsi"
  ],
  [
    "One path per line. Leave empty to search the whole site.",
    "Un percorso per riga. Lascia vuoto per cercare in tutto il sito."
  ],
  [
    "Exclude these paths from discovery",
    "Escludi dalla scoperta questi percorsi"
  ],
  [
    "Applies to new addresses. Archived pages and manually added URLs are still checked.",
    "Si applica ai nuovi indirizzi. Le pagine già archiviate e gli URL aggiunti a mano continuano a essere controllati."
  ],
  [
    "Elements to ignore in comparisons",
    "Elementi da ignorare nei confronti"
  ],
  [
    "One CSS selector per line",
    "Un selettore CSS per riga"
  ],
  [
    "For example, counters or changing widgets. Elements are excluded from comparisons; new HTML copies and screenshots stay complete. You can also select areas by clicking in the page details.",
    "Per esempio contatori o contenuti variabili. Gli elementi sono esclusi dal confronto; le nuove copie HTML e gli screenshot rimangono completi. Puoi anche scegliere le zone con un clic dal dettaglio di una pagina."
  ],
  [
    "Site notes",
    "Note sul sito"
  ],
  [
    "Save settings",
    "Salva impostazioni"
  ],
  [
    "Add and capture",
    "Aggiungi e acquisisci"
  ],
  [
    "Add a page",
    "Aggiungi una pagina"
  ],
  [
    "The new page will belong to {p0}.",
    "La nuova pagina sarà associata a {p0}."
  ],
  [
    "Landing page address",
    "Indirizzo della landing"
  ],
  [
    "Paste the full address found on a website, in an ad or in a newsletter.",
    "Incolla l’indirizzo completo trovato sul sito, in un annuncio o in una newsletter."
  ],
  [
    "Add page",
    "Aggiungi pagina"
  ],
  [
    "Review earlier copies",
    "Rivedi le copie precedenti"
  ],
  [
    "Grouped views keep everything. To reclaim space, review the suggested copies individually first.",
    "Le viste raggruppate mantengono tutto. Per recuperare spazio, esamina prima le singole copie proposte."
  ],
  [
    "Preview cleanup",
    "Anteprima pulizia"
  ],
  [
    "Review copies to delete",
    "Rivedi le copie da eliminare"
  ],
  [
    "No copies are selected automatically.",
    "Nessuna copia è selezionata automaticamente."
  ],
  [
    "Close review",
    "Chiudi revisione"
  ],
  [
    "protected copies: first captures, references, new evidence, favorites and copies with notes or tags.",
    "copie protette: prima acquisizione, riferimenti, evidenze nuove, preferiti e copie con appunti o tag."
  ],
  [
    "Check dates and returns remain available after cleanup. Deleted files will no longer be available.",
    "Le date dei controlli e dei ritorni restano consultabili dopo la pulizia. I file eliminati non saranno più disponibili."
  ],
  [
    "suggested copies out of",
    "copie proposte su"
  ],
  [
    "reclaimable if all are selected",
    "recuperabili selezionandole tutte"
  ],
  [
    "Identical files already share storage. Removing these entries may not free disk space.",
    "I file identici condividono già lo spazio. Eliminare queste voci potrebbe non liberare byte sul disco."
  ],
  [
    "This preview includes up to 100 suggestions. You can reopen it after reviewing them.",
    "Questa anteprima comprende al massimo 100 proposte. Puoi riaprirla dopo la revisione."
  ],
  [
    "Select copy from {p0}",
    "Seleziona copia del {p0}"
  ],
  [
    "Possibly incomplete load",
    "Possibile caricamento incompleto"
  ],
  [
    "Copy with identical files",
    "Copia con file identici"
  ],
  [
    "View suggested copy",
    "Vedi copia proposta"
  ],
  [
    "View retained copy",
    "Vedi copia conservata"
  ],
  [
    "A missing section may really have been removed. Check the images before selecting this copy.",
    "Una sezione assente potrebbe essere stata rimossa davvero. Verifica le immagini prima di selezionare questa copia."
  ],
  [
    "No copies suggested for deletion. Use the variant view to make the history easier to browse.",
    "Nessuna copia eliminabile proposta. Puoi usare la vista per variante per rendere lo storico più leggibile."
  ],
  [
    "I have reviewed the",
    "Ho verificato le"
  ],
  [
    "selected copies and want to delete their unshared files. Checks will stay recorded.",
    "copie selezionate e voglio eliminarne i file non condivisi. I controlli resteranno registrati."
  ],
  [
    "Review completed",
    "Revisione completata"
  ],
  [
    "copies removed ·",
    "copie rimosse ·"
  ],
  [
    "reclaimed.",
    "recuperati."
  ],
  [
    "Some files could not be removed from disk. Check the data volume permissions before another review.",
    "Alcuni file non sono stati rimossi dal disco. Controlla i permessi del volume dati prima di una nuova revisione."
  ],
  [
    "Close",
    "Chiudi"
  ],
  [
    "copies selected",
    "copie selezionate"
  ],
  [
    "Guided restore accepts backups up to 32 GB.",
    "Il ripristino guidato accetta backup fino a 32 GB."
  ],
  [
    "Uploading backup",
    "Caricamento del backup"
  ],
  [
    "Checking backup files, history and integrity",
    "Verifica di file, storico e integrità del backup"
  ],
  [
    "Creating the safety copy and restoring. Keep this page open.",
    "Creazione della copia di sicurezza e ripristino. Lascia aperta questa pagina."
  ],
  [
    "YOUR ARCHIVE, WITH YOU",
    "IL TUO ARCHIVIO, CON TE"
  ],
  [
    "Keep a complete copy or move your archive to another device.",
    "Conserva una copia completa o trasferisci l’archivio su un altro dispositivo."
  ],
  [
    "Full backup",
    "Backup completo"
  ],
  [
    "Includes sites, versions, checks, tags, notes and read status. Keep the ZIP on another drive too. It contains private data and account records (without plaintext passwords): protect it like your archive.",
    "Include siti, versioni, controlli, tag, annotazioni e stato di lettura. Conserva lo ZIP anche su un altro disco. Il file contiene dati privati e i dati dell’account (senza password in chiaro): trattalo come il tuo archivio."
  ],
  [
    "Download full backup",
    "Scarica backup completo"
  ],
  [
    "For a copy you can browse without the app, open a site and choose",
    "Per una copia da sfogliare senza app, apri un sito e scegli"
  ],
  [
    ". That ZIP contains a timeline index, browsable pages and screenshots; it cannot be used for restore.",
    ". Quello ZIP contiene un indice cronologico, pagine navigabili e screenshot; non è utilizzabile per il ripristino."
  ],
  [
    "Guided restore",
    "Ripristino guidato"
  ],
  [
    "Upload a full Landing Archive backup (up to 32 GB). We check the files and show its contents first. Your archive stays intact during this step.",
    "Carica un backup completo di Landing Archive (fino a 32 GB). Prima verifichiamo i file e ti mostriamo il contenuto. In questa fase il tuo archivio resta intatto."
  ],
  [
    "Restore replaces the current history. Your current username and password stay valid; restored sites will be paused. A backup of the current archive is saved automatically before replacement.",
    "Il ripristino sostituisce lo storico attuale. Il tuo nome utente e la password attuali rimangono validi; tutti i siti ripristinati saranno in pausa. Prima della sostituzione viene salvato automaticamente un backup dell’archivio attuale."
  ],
  [
    "Restore is still running. Wait for it to finish.",
    "Ripristino ancora in corso. Attendi il completamento."
  ],
  [
    "Backup ZIP",
    "Backup ZIP"
  ],
  [
    "Upload and verify backup",
    "Carica e verifica backup"
  ],
  [
    "Existing upload:",
    "Caricamento presente:"
  ],
  [
    "of",
    "di"
  ],
  [
    "Verification in progress.",
    "Verifica in corso."
  ],
  [
    "You can cancel it and select the file again.",
    "Puoi annullarlo e selezionare nuovamente il file."
  ],
  [
    "Backup verified",
    "Backup verificato"
  ],
  [
    "Created on",
    "Creato il"
  ],
  [
    "Sites",
    "Siti"
  ],
  [
    "Archived files",
    "File archiviati"
  ],
  [
    "I confirm that I want to replace all current sites and history with this backup.",
    "Confermo di sostituire tutti i siti e lo storico attuali con questo backup."
  ],
  [
    "Your current account password",
    "Password del tuo accesso attuale"
  ],
  [
    "Replace archive and restore",
    "Sostituisci archivio e ripristina"
  ],
  [
    "Cancel upload",
    "Annulla caricamento"
  ],
  [
    "Before the last restore",
    "Prima dell’ultimo ripristino"
  ],
  [
    "This copy contains the archive as it was before the last restore. Download it to keep it: the next restore will replace it with a new safety copy.",
    "Questa copia contiene l’archivio presente prima dell’ultimo ripristino. Scaricala per conservarla: il prossimo ripristino la sostituirà con una nuova copia di sicurezza."
  ],
  [
    "Download safety copy",
    "Scarica copia di sicurezza"
  ],
  [
    "Comparison unavailable. Try again.",
    "Confronto non disponibile. Riprova."
  ],
  [
    "You are comparing full copies: areas excluded from monitoring are also visible.",
    "Qui confronti le copie integrali: sono visibili anche le zone escluse dal monitoraggio."
  ],
  [
    "Original version",
    "Versione di partenza"
  ],
  [
    "Version to compare",
    "Versione da confrontare"
  ],
  [
    "What changed between these copies",
    "Cosa cambia nelle copie selezionate"
  ],
  [
    "View differences: {p0}",
    "Vedi differenze: {p0}"
  ],
  [
    "The text, title, headings, links and image addresses match. The visual comparison may reveal other differences.",
    "Testo, titolo, intestazioni, collegamenti e indirizzi delle immagini coincidono. Il confronto dell’aspetto può rilevare altre differenze."
  ],
  [
    "Appearance",
    "Aspetto"
  ],
  [
    "Text",
    "Testo"
  ],
  [
    "Links",
    "Collegamenti"
  ],
  [
    "Details",
    "Dettagli"
  ],
  [
    "Removed text",
    "Rimosso"
  ],
  [
    "Added text",
    "Aggiunto"
  ],
  [
    "Choose two different versions to see what changed.",
    "Scegli due versioni diverse per osservare cosa è cambiato."
  ],
  [
    "Preparing comparison",
    "Preparazione del confronto"
  ],
  [
    "No differences in the compared text.",
    "Nessuna differenza nel testo confrontato."
  ],
  [
    "Also check Links and Details: they can change without affecting the screenshot.",
    "Controlla anche Collegamenti e Dettagli: possono cambiare senza modificare lo screenshot."
  ],
  [
    "Before",
    "Prima"
  ],
  [
    "Empty",
    "Vuoto"
  ],
  [
    "After",
    "Dopo"
  ],
  [
    "Images replaced at the same address",
    "Immagini sostituite sullo stesso indirizzo"
  ],
  [
    "The downloaded files differ, even though their address stayed the same.",
    "I file scaricati sono diversi, anche se il loro indirizzo è rimasto uguale."
  ],
  [
    "Loading differences",
    "Differenze di caricamento"
  ],
  [
    "These resources were present but failed to load in one copy. This alone does not prove the site changed.",
    "Queste risorse erano presenti ma non sono state caricate in una delle copie. Da sole non provano una modifica del sito."
  ],
  [
    "Not loaded in the second copy",
    "Non caricata nella seconda copia"
  ],
  [
    "Loaded again",
    "Caricata nuovamente"
  ],
  [
    "Same image, different address",
    "Stessa immagine, indirizzo diverso"
  ],
  [
    "The captured files match: a different address does not mean a new image.",
    "I file acquisiti coincidono: il cambio dell’indirizzo non rappresenta una nuova immagine."
  ],
  [
    "Before:",
    "Prima:"
  ],
  [
    "After:",
    "Dopo:"
  ],
  [
    "Section text and position",
    "Testo e posizione delle sezioni"
  ],
  [
    "First",
    "Prime"
  ],
  [
    "differences between elements identified in both copies. A moved section may contain the same text.",
    "differenze fra elementi riconosciuti nelle due copie. Una sezione spostata può contenere lo stesso testo."
  ],
  [
    "Same text in a different position",
    "Stesso testo in una posizione diversa"
  ],
  [
    "Different text in the same section",
    "Testo diverso nella stessa sezione"
  ],
  [
    "Image addresses",
    "Indirizzi delle immagini"
  ],
  [
    "A different address does not prove the image changed: only a parameter may differ. Online resources are not opened.",
    "Un indirizzo diverso non prova che l’immagine sia cambiata: può variare soltanto un parametro. Le risorse online non vengono aperte."
  ],
  [
    "No differences in the title, headings, destination or image addresses.",
    "Nessuna differenza nel titolo, nelle intestazioni, nella destinazione o negli indirizzi delle immagini."
  ],
  [
    "Removed",
    "Rimossi"
  ],
  [
    "Added",
    "Aggiunti"
  ],
  [
    "No items.",
    "Nessun elemento."
  ],
  [
    "Finding changed areas",
    "Ricerca delle zone modificate"
  ],
  [
    "Retry highlighting",
    "Riprova l’evidenziazione"
  ],
  [
    "Highlight changes",
    "Evidenzia le modifiche"
  ],
  [
    "Previous change",
    "Modifica precedente"
  ],
  [
    "No changed areas",
    "Nessuna zona diversa"
  ],
  [
    "Next change",
    "Modifica successiva"
  ],
  [
    "Go to area",
    "Vai alla zona"
  ],
  [
    "Orange areas outline the differences. Different pixels in the compared sample: {p0}.",
    "Le aree arancioni racchiudono le differenze. Pixel diversi nel campione confrontato: {p0}."
  ],
  [
    "No visual differences detected in the compared sample. Check the content summary.",
    "Nessuna differenza visiva rilevata nel campione confrontato. Controlla il riepilogo del contenuto."
  ],
  [
    "The two copies scroll together.",
    "Lo scorrimento delle due copie è sincronizzato."
  ],
  [
    "Different dimensions:",
    "Dimensioni diverse:"
  ],
  [
    "pixels. Images are aligned without stretching. The comparison also shows small shifts that monitoring may ignore.",
    "pixel. Le immagini sono allineate senza deformarle. Il confronto mostra anche i piccoli spostamenti che il monitoraggio può ignorare."
  ],
  [
    "Many differences: the last areas have been grouped into a larger region.",
    "Molte differenze: le ultime zone sono raggruppate in un’area più ampia."
  ],
  [
    "Highlights refer to screenshots. Animations, moved elements or incomplete loads can produce large regions; they do not by themselves prove an intentional site change.",
    "Le evidenziazioni riguardano gli screenshot. Animazioni, elementi spostati o caricamenti incompleti possono produrre zone ampie; non dimostrano da soli una modifica voluta dall’autore."
  ],
  [
    "After screenshot",
    "Screenshot dopo"
  ],
  [
    "Before screenshot",
    "Screenshot prima"
  ],
  [
    "Page captured on {p0}",
    "Pagina acquisita il {p0}"
  ],
  [
    "Difference areas",
    "Zone di differenza"
  ],
  [
    "Area",
    "Zona"
  ],
  [
    "Open screenshot",
    "Apri screenshot"
  ],
  [
    "All pages",
    "Tutte"
  ],
  [
    "New",
    "Nuove"
  ],
  [
    "Changed pages",
    "Modificate"
  ],
  [
    "Unavailable pages",
    "Non raggiungibili"
  ],
  [
    "Pages back online",
    "Tornate online"
  ],
  [
    "Public link",
    "Collegamento pubblico"
  ],
  [
    "Added manually",
    "Aggiunta a mano"
  ],
  [
    "Landing page lifecycle",
    "Vita delle landing"
  ],
  [
    "Discoveries, changes and returns online. Dates show when the archive observed the page.",
    "Scoperte, modifiche e ritorni online. Le date indicano quando l’archivio ha osservato la pagina."
  ],
  [
    "Add URL",
    "Aggiungi URL"
  ],
  [
    "Filter by lifecycle",
    "Filtra per evoluzione"
  ],
  [
    "Filter pages",
    "Filtra pagine"
  ],
  [
    "Search for a landing page or title",
    "Cerca una landing o un titolo"
  ],
  [
    "Limit reached: increase the limit in settings to archive more automatically discovered pages.",
    "Limite raggiunto: aumenta il limite nelle impostazioni per archiviare altre landing trovate automaticamente."
  ],
  [
    "Page and source",
    "Pagina e origine"
  ],
  [
    "First discovered",
    "Prima scoperta"
  ],
  [
    "Last successful copy",
    "Ultima copia riuscita"
  ],
  [
    "Lifecycle and check",
    "Evoluzione e controllo"
  ],
  [
    "Open",
    "Apri"
  ],
  [
    "No longer in the sitemap",
    "Non più nella sitemap"
  ],
  [
    "New to the archive",
    "Nuova nell’archivio"
  ],
  [
    "No pages match the filters.",
    "Nessuna pagina corrisponde ai filtri."
  ],
  [
    "Discovery will find the first landing pages. You can also add an address manually.",
    "La ricerca individuerà le prime landing. Puoi anche aggiungere un indirizzo a mano."
  ],
  [
    "Categories follow the last observed event, not the site's publication date. Removal from a sitemap does not prove a page is offline. Disappearance is confirmed after two 404 or 410 responses; copies stay available.",
    "Le categorie seguono l’ultimo evento osservato, non la data di pubblicazione del sito. Una rimozione dalla sitemap non prova che una pagina sia offline. La scomparsa viene confermata dopo due risposte 404 o 410; le copie restano disponibili."
  ],
  [
    "From",
    "Dal"
  ],
  [
    "dates",
    "date"
  ],
  [
    "To",
    "Al"
  ],
  [
    "No results",
    "Nessun risultato"
  ],
  [
    "Previous",
    "Precedenti"
  ],
  [
    "Next",
    "Successivi"
  ],
  [
    "Notes on this version",
    "Appunti su questa versione"
  ],
  [
    "Copy from",
    "Copia del"
  ],
  [
    ". These notes apply only to this capture.",
    ". Gli appunti riguardano solo questa acquisizione."
  ],
  [
    "Open collection",
    "Apri raccolta"
  ],
  [
    "Favorite",
    "Preferita"
  ],
  [
    "Separate with commas, up to 12 tags.",
    "Separa con virgole, fino a 12 tag."
  ],
  [
    "Note",
    "Annotazione"
  ],
  [
    "What are they testing? Which offer changed?",
    "Cosa stanno testando? Quale offerta è cambiata?"
  ],
  [
    "Save notes",
    "Salva appunti"
  ],
  [
    "Notes saved to the collection",
    "Appunti salvati nella raccolta"
  ],
  [
    "CATCH UP ON THE SITES YOU FOLLOW",
    "IL PUNTO SUI SITI CHE SEGUI"
  ],
  [
    "A summary of recorded events, with links to archived copies.",
    "Un riepilogo degli eventi registrati, con i collegamenti alle copie archiviate."
  ],
  [
    "Refresh",
    "Aggiorna"
  ],
  [
    "All",
    "Tutti"
  ],
  [
    "Individual site",
    "Singolo sito"
  ],
  [
    "Last 7 days",
    "Ultimi 7 giorni"
  ],
  [
    "Unread only",
    "Solo da leggere"
  ],
  [
    "Selected types only",
    "Solo tipi selezionati"
  ],
  [
    "Which updates do you want to follow?",
    "Quali novità vuoi seguire?"
  ],
  [
    "These preferences filter this summary. The full history stays saved. No messages are sent to external services.",
    "Le preferenze filtrano questo riepilogo. Lo storico completo resta conservato. Nessun messaggio viene inviato a servizi esterni."
  ],
  [
    "Preferences saved",
    "Preferenze salvate"
  ],
  [
    "Save preferences",
    "Salva preferenze"
  ],
  [
    "unread with these filters",
    "da leggere nei filtri scelti"
  ],
  [
    "Mark these events as read",
    "Segna questi eventi come letti"
  ],
  [
    "No updates match these filters",
    "Nessuna novità con questi filtri"
  ],
  [
    "Expand the date range or include events you have already read.",
    "Amplia il periodo o includi gli eventi già letti."
  ],
  [
    "events on this page",
    "eventi in questa pagina"
  ],
  [
    "Read",
    "Letto"
  ],
  [
    "Unread",
    "Da leggere"
  ],
  [
    "Open this version",
    "Apri questa versione"
  ],
  [
    "Open page history",
    "Apri storico pagina"
  ],
  [
    "Mark as unread",
    "Segna da leggere"
  ],
  [
    "Mark as read",
    "Segna come letto"
  ],
  [
    "FIND WHAT MATTERS",
    "RITROVA QUELLO CHE CONTA"
  ],
  [
    "Versions with notes, tags or favorites, collected across all your sites.",
    "Le versioni con appunti, tag o preferiti, raccolte da tutti i tuoi siti."
  ],
  [
    "Search notes",
    "Cerca negli appunti"
  ],
  [
    "Site",
    "Sito"
  ],
  [
    "All tags",
    "Tutti i tag"
  ],
  [
    "Favorites only",
    "Solo preferite"
  ],
  [
    "Open version and notes",
    "Apri versione e appunti"
  ],
  [
    "No versions in the collection",
    "Nessuna versione nella raccolta"
  ],
  [
    "Open a page and add notes, tags or a favorite to the version you want to keep track of.",
    "Apri una pagina e aggiungi appunti, tag o un preferito alla versione che ti interessa."
  ],
  [
    "The offline copy is unavailable.",
    "La copia offline non è disponibile."
  ],
  [
    "This link has no copy in the archive. The live site was not opened.",
    "Questo collegamento non ha una copia nell’archivio. Il sito online non è stato aperto."
  ],
  [
    "This copy could not be opened in the offline view. You can download its HTML or view the screenshot.",
    "Non è stato possibile aprire questa copia nella vista offline. Puoi scaricare l’HTML o consultare lo screenshot."
  ],
  [
    "Offline browsing",
    "Consultazione offline"
  ],
  [
    "Back",
    "Indietro"
  ],
  [
    "Copy in your archive",
    "Copia sul tuo archivio"
  ],
  [
    "Opening page…",
    "Apertura della pagina…"
  ],
  [
    "Captured:",
    "Acquisita:"
  ],
  [
    "Shrink offline page",
    "Riduci pagina offline"
  ],
  [
    "Expand offline page",
    "Espandi pagina offline"
  ],
  [
    "This link only has a copy later than the selected date:",
    "Per questo collegamento esiste soltanto una copia successiva alla data scelta:"
  ],
  [
    "Partial copy.",
    "Copia parziale."
  ],
  [
    "Warnings for this copy",
    "Avvisi di questa copia"
  ],
  [
    "Opening offline copy…",
    "Apertura della copia offline…"
  ],
  [
    "Archived offline page",
    "Pagina archiviata offline"
  ],
  [
    "Links open copies from the same site. Reference date:",
    "I link aprono le copie dello stesso sito. Data di riferimento:"
  ],
  [
    ". Forms and features that require online services are disabled.",
    ". Moduli e funzioni che richiedono servizi online non sono attivi."
  ],
  [
    "Download this page",
    "Scarica questa pagina"
  ],
  [
    "This area cannot be uniquely identified. Try a smaller element.",
    "Non riesco a identificare questa zona in modo univoco. Prova un elemento più piccolo."
  ],
  [
    "Copy not available yet",
    "Copia non ancora disponibile"
  ],
  [
    "Invalid rule",
    "Regola non valida"
  ],
  [
    "Site exclusion",
    "Esclusione del sito"
  ],
  [
    "This copy is unavailable for selection. Try capturing a new version.",
    "Questa copia non è disponibile per la selezione. Prova una nuova acquisizione."
  ],
  [
    "Save a first copy before selecting areas by clicking.",
    "Serve una prima copia archiviata per scegliere le zone con un clic."
  ],
  [
    "Save failed",
    "Salvataggio non riuscito"
  ],
  [
    "Rules saved. The next complete check will save a reference using the new rules. Previous copies stay intact.",
    "Regole salvate. Al prossimo controllo completo sarà conservato un riferimento con le nuove regole. Le copie precedenti restano intatte."
  ],
  [
    "Monitoring rules",
    "Regole di monitoraggio"
  ],
  [
    "Choose what matters on the page",
    "Scegli cosa conta nella pagina"
  ],
  [
    "Click the offline copy and add the selected area. Rules apply only to this page.",
    "Clicca sulla copia offline e aggiungi la zona scelta. Le regole valgono solo per questa pagina."
  ],
  [
    "Future HTML copies and screenshots stay complete. Orange marks areas excluded from comparison; green marks important areas, which take priority over exclusions.",
    "Le copie HTML e gli screenshot futuri restano completi. In arancione vedi le zone escluse dal confronto; in verde quelle importanti, che hanno la precedenza sulle esclusioni."
  ],
  [
    "Ignore changes",
    "Ignora variazioni"
  ],
  [
    "Important area",
    "Zona importante"
  ],
  [
    "Also show the previous copy",
    "Mostra anche la copia precedente"
  ],
  [
    "Selected:",
    "Selezionata:"
  ],
  [
    "Expand selection",
    "Allarga selezione"
  ],
  [
    "Exclude from comparison",
    "Escludi dal confronto"
  ],
  [
    "Mark as important",
    "Segna come importante"
  ],
  [
    "Click a heading, image or section. Links stay disabled while you select.",
    "Clicca un titolo, un’immagine o una sezione. I collegamenti restano disattivati durante la scelta."
  ],
  [
    "Latest copy ·",
    "Ultima copia ·"
  ],
  [
    "Select areas on the page",
    "Scegli zone nella pagina"
  ],
  [
    "Previous copy ·",
    "Copia precedente ·"
  ],
  [
    "Preview rules in the previous copy",
    "Anteprima regole nella copia precedente"
  ],
  [
    "Excluded areas",
    "Zone escluse"
  ],
  [
    "Important areas",
    "Zone importanti"
  ],
  [
    "No areas selected.",
    "Nessuna zona selezionata."
  ],
  [
    "Latest copy:",
    "Ultima copia:"
  ],
  [
    "Area not found in one copy: check your selection before saving.",
    "Zona non trovata in una copia: verifica la scelta prima di salvare."
  ],
  [
    "Area identifier",
    "Identificatore della zona"
  ],
  [
    "Remove rule {p0}",
    "Rimuovi regola {p0}"
  ],
  [
    "There are also",
    "Sono attive anche"
  ],
  [
    "exclusions defined in the site settings.",
    "esclusioni definite nelle impostazioni del sito."
  ],
  [
    "The preview shows which elements are selected in saved copies. The offline layout may differ from the live site; rules apply to the live page on the next check. An area whose structure changes may need to be selected again.",
    "L’anteprima mostra quali elementi vengono selezionati nelle copie salvate. L’impaginazione offline può differire dal sito online; al prossimo controllo le regole saranno applicate alla pagina live. Una zona che cambia struttura potrebbe richiedere una nuova scelta."
  ],
  [
    "Discard changes",
    "Annulla modifiche"
  ],
  [
    "Save rules",
    "Salva regole"
  ],
  [
    "Loading image…",
    "Caricamento immagine…"
  ],
  [
    "Quality data unavailable",
    "Dati di qualità non disponibili"
  ],
  [
    "Incomplete load",
    "Caricamento incompleto"
  ],
  [
    "Load verified",
    "Caricamento verificato"
  ],
  [
    "Earlier quality checks",
    "Controlli di qualità precedenti"
  ],
  [
    "Change confirmed",
    "Modifica confermata"
  ],
  [
    "Copy saved",
    "Copia conservata"
  ],
  [
    "Change detected",
    "Modifica rilevata"
  ],
  [
    "Previous variant returned",
    "Variante ritornata"
  ],
  [
    "Check failed",
    "Controllo non riuscito"
  ],
  [
    "Temporarily unreachable",
    "Temporaneamente non raggiungibile"
  ],
  [
    "Check stopped",
    "Controllo interrotto"
  ],
  [
    "Check recorded",
    "Controllo registrato"
  ],
  [
    "Every visit keeps its own date, even when it reuses an earlier copy.",
    "Ogni visita conserva la propria data, anche quando riutilizza una copia precedente."
  ],
  [
    "The files from this visit were removed during a review. The date and check result are kept.",
    "I file di questa visita sono stati rimossi durante una revisione. La data e il risultato del controllo sono conservati."
  ],
  [
    "Open reference copy",
    "Apri la copia di riferimento"
  ],
  [
    "Open associated copy",
    "Apri copia associata"
  ],
  [
    "No completed checks.",
    "Nessun controllo completato."
  ],
  [
    "checks",
    "controlli"
  ],
  [
    "Load earlier checks",
    "Carica controlli precedenti"
  ],
  [
    "Confirmed",
    "Confermata"
  ],
  [
    "Evidence to review",
    "Evidenza da verificare"
  ],
  [
    "Earlier archive",
    "Archivio precedente"
  ],
  [
    "Return to an earlier variant",
    "Ritorno a una variante precedente"
  ],
  [
    "First capture",
    "Prima acquisizione"
  ],
  [
    "Variant",
    "Variante"
  ],
  [
    "occurrences",
    "ricorrenze"
  ],
  [
    "Comparison reference",
    "Riferimento per il confronto"
  ],
  [
    "Page history",
    "Cronologia della pagina"
  ],
  [
    "Timeline",
    "Linea del tempo"
  ],
  [
    "Confirmed changes and new evidence. Every visit stays available.",
    "Modifiche confermate ed evidenze nuove. Ogni visita resta consultabile."
  ],
  [
    "History view",
    "Vista della cronologia"
  ],
  [
    "Useful versions",
    "Versioni utili"
  ],
  [
    "By variant",
    "Per variante"
  ],
  [
    "Repeated occurrences share a group. A return A → B → A keeps every date.",
    "Le ricorrenze condividono un gruppo. Un ritorno A → B → A mantiene tutte le date."
  ],
  [
    "More dates are available by loading earlier checks in “All observations”.",
    "Altre date sono disponibili caricando i controlli precedenti in «Tutte le osservazioni»."
  ],
  [
    "Copy without an assigned variant",
    "Copia senza variante assegnata"
  ],
  [
    "Available copies predate the new checks. You can browse them in the earlier archive below.",
    "Le copie disponibili precedono i nuovi controlli. Puoi consultarle nell’archivio precedente qui sotto."
  ],
  [
    "The quality of older copies may not have been measured. This is not an error. All copies remain available.",
    "La qualità delle copie più vecchie può non essere stata misurata. Questo non indica un errore. Le copie restano tutte disponibili."
  ],
  [
    "Grouping or changing views does not delete copies.",
    "Raggruppare o cambiare vista non elimina copie."
  ],
  [
    "Verified version",
    "Versione verificata"
  ],
  [
    "Saved evidence · needs review",
    "Evidenza conservata · da verificare"
  ],
  [
    "Copy from the earlier archive",
    "Copia dell’archivio precedente"
  ],
  [
    "This evidence is kept because it may contain a new offer or variant. Its presence alone does not confirm a site change.",
    "Questa evidenza è conservata perché potrebbe contenere un’offerta o una variante nuova. La sua presenza non conferma da sola una modifica del sito."
  ],
  [
    "Quality data is unavailable for this historical capture. This does not mean the copy is incomplete.",
    "Dati di qualità non disponibili per questa acquisizione storica. Non significa che la copia sia incompleta."
  ],
  [
    "The offline copy has resources that were not embedded: the screenshot may show elements missing from the HTML.",
    "La copia offline contiene risorse non incorporate: lo screenshot può mostrare elementi assenti nell’HTML."
  ],
  [
    "Offline copy verified.",
    "Copia offline verificata."
  ],
  [
    "Capture details",
    "Dettagli dell’acquisizione"
  ],
  [
    "Check on",
    "Controllo del"
  ],
  [
    "Original files were removed during review; showing the reference copy",
    "I file originali sono stati rimossi nella revisione; viene mostrata la copia di riferimento"
  ],
  [
    "Associated copy captured",
    "Copia associata acquisita"
  ],
  [
    "on",
    "il"
  ],
  [
    "Temporary anomaly samples",
    "Campioni temporanei delle anomalie"
  ],
  [
    "These help explain what failed to load. They expire; the check log remains available.",
    "Aiutano a capire cosa non è stato caricato. Hanno una scadenza; il registro dei controlli resta disponibile."
  ],
  [
    "· Expires",
    "· Scadenza"
  ],
  [
    "Open sample",
    "Apri campione"
  ],
  [
    "No temporary samples available.",
    "Nessun campione temporaneo disponibile."
  ],
  [
    "Request address not allowed.",
    "Indirizzo della richiesta non consentito."
  ],
  [
    "The request could not be completed.",
    "Non è stato possibile completare la richiesta."
  ],
  [
    "Operation cancelled",
    "Operazione annullata"
  ],
  [
    "Page not found",
    "Pagina non trovata"
  ],
  [
    "This page has over 20,000 versions. Save a backup before a dedicated review.",
    "Questa pagina supera 20.000 versioni: conserva il backup prima di una revisione dedicata."
  ],
  [
    "Same content and files as a copy already saved.",
    "Stesso contenuto e stessi file di una copia già conservata."
  ],
  [
    "Incomplete copy between two identical versions: check the images before deleting it.",
    "Copia incompleta fra due versioni uguali: verifica le immagini prima di eliminarla."
  ],
  [
    "Select and confirm copies to delete from the preview.",
    "Seleziona e conferma le copie da eliminare dall’anteprima."
  ],
  [
    "Wait for the backup or restore to finish before deleting copies.",
    "Attendi il termine del backup o del ripristino prima di eliminare copie."
  ],
  [
    "The archive has changed. Reopen the preview before confirming.",
    "L’archivio è cambiato. Riapri l’anteprima prima di confermare."
  ],
  [
    "The selection includes a protected version or one missing from the preview.",
    "La selezione include una versione protetta o non presente nell’anteprima."
  ],
  [
    "Files removed during review; observation kept.",
    "File rimossi dalla revisione; osservazione conservata."
  ],
  [
    "Selected copies deleted. Check and recurrence dates are kept.",
    "Copie selezionate eliminate. Le date dei controlli e delle ricorrenze sono conservate."
  ],
  [
    "Request origin not allowed",
    "Origine della richiesta non consentita"
  ],
  [
    "Invalid request origin",
    "Origine della richiesta non valida"
  ],
  [
    "External request not allowed",
    "Richiesta esterna non consentita"
  ],
  [
    "Sign in to browse the archive",
    "Accedi per consultare l’archivio"
  ],
  [
    "The account has already been created",
    "L’account è già stato creato"
  ],
  [
    "Choose a username with at least 3 characters and a password with at least 12 characters",
    "Scegli un nome di almeno 3 caratteri e una password di almeno 12 caratteri"
  ],
  [
    "Account already created",
    "Account già creato"
  ],
  [
    "Invalid credentials",
    "Credenziali non valide"
  ],
  [
    "Incorrect username or password",
    "Nome utente o password non corretti"
  ],
  [
    "Resource not allowed",
    "Risorsa non consentita"
  ],
  [
    "Open Backup and restore in Landing Archive. Guided restore keeps your current account and pauses restored sites. For manual restore, stop the services and restore archive.sqlite and objects into an empty data directory with UID/GID 1000:1000.",
    "Apri Backup e ripristino in Landing Archive. Il ripristino guidato conserva il tuo accesso attuale e mette i siti in pausa. Per il ripristino manuale arresta i servizi e ripristina archive.sqlite e objects in una directory dati vuota con UID/GID 1000:1000."
  ],
  [
    "· Variant first captured on {p0}",
    "· Variante già acquisita il {p0}"
  ],
  [
    "· Screenshot only",
    "· Solo screenshot"
  ],
  [
    "The browser could not start. Check the engine diagnostics in Umbrel.",
    "Il browser non è riuscito ad avviarsi. Consulta la diagnostica del motore in Umbrel."
  ],
  [
    "The system denied a permission needed for browser isolation. Capture has not started. Make sure Landing Archive is up to date and restart it from Umbrel to load the engine security profile.",
    "Il sistema ha negato un permesso necessario all’isolamento del browser. L’acquisizione non è iniziata. Verifica che Landing Archive sia aggiornato e riavvia l’app da Umbrel per caricare il profilo di sicurezza del motore."
  ],
  [
    "Browser isolation is unavailable on this system. Capture has not started: the engine security configuration needs checking.",
    "L’isolamento del browser non è disponibile su questo sistema. L’acquisizione non è iniziata: occorre verificare la configurazione di sicurezza del motore."
  ],
  [
    "The browser or one of its libraries is missing or not executable. Check for an app update and restart it from Umbrel.",
    "Il browser o una sua libreria non sono disponibili o eseguibili. Verifica l’aggiornamento dell’app e riavviala da Umbrel."
  ],
  [
    "The browser did not start in time. Check available resources and restart the app from Umbrel.",
    "Il browser non si è avviato entro il tempo previsto. Controlla le risorse disponibili e riavvia l’app da Umbrel."
  ],
  [
    "The page exceeds capture limits. Previous copies are kept.",
    "La pagina supera i limiti di acquisizione. Le copie precedenti sono conservate."
  ],
  [
    "Invalid engine response.",
    "Risposta del motore non valida."
  ],
  [
    "The page keeps changing while loading: this capture needs review.",
    "La pagina continua a cambiare durante il caricamento: acquisizione da verificare."
  ],
  [
    "{p0} visible images did not load completely.",
    "{p0} immagini visibili non sono state caricate completamente."
  ],
  [
    "{p0} background images did not load completely.",
    "{p0} immagini di sfondo non sono state caricate completamente."
  ],
  [
    "One or more page fonts did not load completely.",
    "Uno o più caratteri della pagina non sono stati caricati completamente."
  ],
  [
    "An important area was not found: content may be incomplete.",
    "Una zona importante non è stata trovata: il contenuto potrebbe essere incompleto."
  ],
  [
    "The page has no recognizable text or images.",
    "La pagina non contiene testo o immagini riconoscibili."
  ],
  [
    "Capture time limit exceeded.",
    "Tempo massimo di acquisizione esaurito."
  ],
  [
    "Capture cancelled.",
    "Acquisizione annullata."
  ],
  [
    "browser startup",
    "avvio del browser"
  ],
  [
    "page preparation",
    "preparazione della pagina"
  ],
  [
    "Data submission requests were blocked: some interactive features may be missing.",
    "Richieste di invio dati bloccate: alcune funzioni interattive potrebbero non comparire."
  ],
  [
    "Audio and video are not downloaded.",
    "Audio e video non vengono scaricati."
  ],
  [
    "The page could not be reached.",
    "Impossibile raggiungere la pagina."
  ],
  [
    "A resource pointing to a private network was blocked.",
    "Una risorsa verso una rete privata è stata bloccata."
  ],
  [
    "Some resources were not downloaded (network error or capture limit).",
    "Alcune risorse non sono state scaricate (errore di rete o limite di acquisizione)."
  ],
  [
    "opening the page",
    "apertura della pagina"
  ],
  [
    "The site keeps connections open: capture proceeded after a limited wait.",
    "Il sito mantiene connessioni attive: acquisizione eseguita dopo un’attesa limitata."
  ],
  [
    "Too many redirects while loading.",
    "Troppi reindirizzamenti durante il caricamento."
  ],
  [
    "The site did not return a page.",
    "Il sito non ha restituito una pagina."
  ],
  [
    "The site returned HTTP {p0}.",
    "Il sito ha risposto HTTP {p0}."
  ],
  [
    "The address does not return an HTML page.",
    "L’indirizzo non restituisce una pagina HTML."
  ],
  [
    "loading page elements",
    "caricamento degli elementi della pagina"
  ],
  [
    "reading text and links",
    "lettura del testo e dei collegamenti"
  ],
  [
    "The site shows an anti-bot challenge. No new version was archived.",
    "Il sito mostra una verifica anti-bot. Nessuna nuova versione è stata archiviata."
  ],
  [
    "A cookie banner is present; it is kept without giving consent.",
    "È presente un banner cookie; viene conservato senza esprimere consenso."
  ],
  [
    "One or more ignore selectors are invalid.",
    "Uno o più selettori da ignorare non sono validi."
  ],
  [
    "A stylesheet failed to load.",
    "Un foglio di stile non è stato caricato."
  ],
  [
    "A resource needed for page fonts failed to load.",
    "Una risorsa necessaria ai caratteri della pagina non è stata caricata."
  ],
  [
    "A page script failed to load: some sections may be missing.",
    "Uno script della pagina non è stato caricato: alcune sezioni potrebbero mancare."
  ],
  [
    "A content request failed or was blocked: some sections may be missing.",
    "Una richiesta di contenuto non è riuscita o è stata bloccata: alcune sezioni potrebbero mancare."
  ],
  [
    "Screenshot limited to the first {p0} pixels to control memory use; the HTML copy may contain more content below.",
    "Screenshot limitato ai primi {p0} pixel per contenere la memoria; la copia HTML può includere contenuti più in basso."
  ],
  [
    "The HTML copy exceeds the resource limit.",
    "La copia HTML supera il limite di risorse."
  ],
  [
    "Some resources in the offline copy are unavailable on the site.",
    "Alcune risorse della copia offline non sono disponibili sul sito."
  ],
  [
    "Some resources were not embedded in the offline copy.",
    "Alcune risorse non sono state incorporate nella copia offline."
  ],
  [
    "Offline copy: some resources from {p0} were not embedded ({p1}).",
    "Copia offline: alcune risorse di {p0} non sono state incorporate ({p1})."
  ],
  [
    "preparing the HTML copy",
    "preparazione della copia HTML"
  ],
  [
    "The offline copy refers to resources that were not embedded.",
    "La copia offline contiene riferimenti a risorse che non sono state incorporate."
  ],
  [
    "Content changed while files were being created: the screenshot and offline copy need review.",
    "Il contenuto è cambiato durante la creazione dei file: screenshot e copia offline richiedono verifica."
  ],
  [
    "checking the offline copy",
    "verifica della copia offline"
  ],
  [
    "Offline playback loses one or more visible images.",
    "La riproduzione offline perde una o più immagini visibili."
  ],
  [
    "Offline playback cannot load all fonts.",
    "La riproduzione offline non riesce a caricare tutti i caratteri."
  ],
  [
    "Visible text in the offline copy does not match the captured text.",
    "Il testo visibile nella copia offline non coincide con quello acquisito."
  ],
  [
    "An important area is missing from offline playback.",
    "Una zona importante non viene riprodotta nella copia offline."
  ],
  [
    "Offline playback could not be fully verified.",
    "Non è stato possibile verificare completamente la riproduzione offline."
  ],
  [
    "Capture failed during: {p0}.{p1}{p2}",
    "Acquisizione non completata durante: {p0}.{p1}{p2}"
  ],
  [
    "Network error: {p0}.",
    "Errore di rete: {p0}."
  ],
  [
    "Check the engine logs in Umbrel: the browser may be unable to start.",
    "Controlla i log del motore in Umbrel: il browser potrebbe non riuscire ad avviarsi."
  ],
  [
    "Page title",
    "Titolo della pagina"
  ],
  [
    "Headings",
    "Intestazioni"
  ],
  [
    "Page destination",
    "Destinazione della pagina"
  ],
  [
    "Image content",
    "Contenuto delle immagini"
  ],
  [
    "Invalid engine credential",
    "Credenziale del motore non valida"
  ],
  [
    "New page discovered",
    "Nuova pagina individuata"
  ],
  [
    "Invalid comparison data.",
    "Dati del confronto non validi."
  ],
  [
    "Invalid comparison field.",
    "Campo del confronto non valido."
  ],
  [
    "Invalid comparison version.",
    "Versione del confronto non valida."
  ],
  [
    "Invalid comparison type.",
    "Tipo del confronto non valido."
  ],
  [
    "Invalid comparison reference.",
    "Riferimento del confronto non valido."
  ],
  [
    "Invalid comparison signals.",
    "Segnali del confronto non validi."
  ],
  [
    "Invalid comparison fingerprint.",
    "Impronta del confronto non valida."
  ],
  [
    "Invalid comparison counter.",
    "Contatore del confronto non valido."
  ],
  [
    "Invalid visual difference.",
    "Differenza visiva non valida."
  ],
  [
    "Invalid comparison date.",
    "Data del confronto non valida."
  ],
  [
    "Invalid comparison state.",
    "Stato del confronto non valido."
  ],
  [
    "New or changed title",
    "Titolo nuovo o modificato"
  ],
  [
    "New or changed text",
    "Testo nuovo o modificato"
  ],
  [
    "New or changed heading",
    "Intestazione nuova o modificata"
  ],
  [
    "New link or button",
    "Collegamento o pulsante nuovo"
  ],
  [
    "Image content changed",
    "Contenuto di un’immagine modificato"
  ],
  [
    "New image observed",
    "Nuova immagine osservata"
  ],
  [
    "Change in an important area",
    "Modifica in una zona importante"
  ],
  [
    "Page destination changed",
    "Destinazione della pagina modificata"
  ],
  [
    "Invalid sample.",
    "Campione non valido."
  ],
  [
    "The temporary sample has expired or is unavailable.",
    "Il campione temporaneo è scaduto o non è disponibile."
  ],
  [
    "Difference needs verification before creating a version.",
    "Differenza da verificare prima di creare una versione."
  ],
  [
    "robots.txt rules exceed processing limits. Discovery was stopped.",
    "Le regole robots.txt superano i limiti di elaborazione. La scoperta è stata interrotta."
  ],
  [
    "Sitemap contains forbidden declarations.",
    "Sitemap con dichiarazioni non consentite."
  ],
  [
    "Invalid sitemap.",
    "Sitemap non valida."
  ],
  [
    "The document is not a sitemap.",
    "Il documento non è una sitemap."
  ],
  [
    "Page discovery timed out.",
    "Tempo di scoperta pagine esaurito."
  ],
  [
    "robots.txt unavailable; try again to check the site's rules.",
    "robots.txt non disponibile; riprovare per verificare le regole del sito."
  ],
  [
    "robots.txt could not be read.",
    "robots.txt non è stato letto."
  ],
  [
    "A sitemap could not be read completely.",
    "Una sitemap non è stata letta completamente."
  ],
  [
    "Some pages could not be reached during discovery.",
    "Alcune pagine non sono state raggiunte durante la scoperta."
  ],
  [
    "The starting page is excluded by robots.txt: its links were not followed.",
    "La pagina iniziale è esclusa da robots.txt: la scoperta dei suoi collegamenti è stata saltata."
  ],
  [
    "The limit of {p0} pages was reached; you can increase it in site settings.",
    "Raggiunto il limite di {p0} pagine; è possibile aumentarlo nelle impostazioni del sito."
  ],
  [
    "Discovery stopped at the time limit; partial results were kept.",
    "Scoperta interrotta al limite di tempo; i risultati parziali sono conservati."
  ],
  [
    "The engine did not provide quality data for this capture.",
    "Il motore non ha fornito i dati di qualità di questa acquisizione."
  ],
  [
    "Page removed during the check.",
    "Pagina rimossa durante il controllo."
  ],
  [
    "First observation of the page",
    "Prima osservazione della pagina"
  ],
  [
    "Another check updated the reference: repeat the visit.",
    "Un altro controllo ha aggiornato il riferimento: ripetere la visita."
  ],
  [
    "The rules changed during the check. The attempt will be repeated.",
    "Le regole sono state aggiornate durante il controllo. Il tentativo sarà ripetuto."
  ],
  [
    "Some content is missing or reordered: verification in progress.",
    "Una parte del contenuto è assente o ha cambiato ordine: verifica in corso."
  ],
  [
    "Different appearance without recognized new content: verification in progress.",
    "Aspetto diverso senza nuovo contenuto riconosciuto: verifica in corso."
  ],
  [
    "No significant changes",
    "Nessuna modifica significativa"
  ],
  [
    "Return to a previously observed variant · existing files reused",
    "Ritorno a una variante già osservata · file esistenti riutilizzati"
  ],
  [
    "First version archived",
    "Prima versione archiviata"
  ],
  [
    "First evidence saved · capture needs review",
    "Prima evidenza conservata · acquisizione da verificare"
  ],
  [
    "Reference updated to the new comparison rules",
    "Riferimento aggiornato alle nuove regole di confronto"
  ],
  [
    "Complete copy saved after an observation requiring review",
    "Copia completa conservata dopo un’osservazione da verificare"
  ],
  [
    "New content saved · quality needs review",
    "Nuovo contenuto conservato · qualità da verificare"
  ],
  [
    "Content change confirmed in two verified loads",
    "Variazione del contenuto confermata in due caricamenti verificati"
  ],
  [
    "Visual change confirmed in two verified loads",
    "Modifica visiva confermata in due caricamenti verificati"
  ],
  [
    "Difference needs verification: the trusted reference is kept.",
    "Differenza da verificare: il riferimento affidabile è conservato."
  ],
  [
    "Load needs review: {p0} No new version confirmed.",
    "Caricamento da verificare: {p0} Nessuna nuova versione confermata."
  ],
  [
    "Automatic monitoring is paused; you can repeat the check manually.",
    "Il monitoraggio automatico è sospeso; puoi ripetere manualmente il controllo."
  ],
  [
    "Next check in {p0}.",
    "Nuovo controllo tra {p0}."
  ],
  [
    "Further checks will follow the site's interval.",
    "I prossimi controlli seguiranno la frequenza del sito."
  ],
  [
    "Page reachable again",
    "Pagina nuovamente raggiungibile"
  ],
  [
    "Destination updated: {p0}",
    "Destinazione aggiornata: {p0}"
  ],
  [
    "Capture failed",
    "Acquisizione non riuscita"
  ],
  [
    "Page not found in two consecutive checks; earlier copies kept",
    "Pagina non trovata in due controlli consecutivi; copie precedenti conservate"
  ],
  [
    "This copy exceeds safe processing limits. You can view the saved screenshot.",
    "Questa copia supera i limiti di elaborazione sicura. Puoi consultare lo screenshot conservato."
  ],
  [
    "Other copies are already being processed. Try again in a few seconds.",
    "Sono già in elaborazione altre copie. Riprova tra pochi secondi."
  ],
  [
    "Image comparison stopped within safety limits.",
    "Confronto immagine interrotto entro i limiti di sicurezza."
  ],
  [
    "Highlighting is unavailable within safety limits. You can still view the original copies and compare their content.",
    "Evidenziazione non disponibile entro i limiti di sicurezza. Puoi comunque consultare le copie originali e il confronto del contenuto."
  ],
  [
    "The engine is not responding. Check the app status in Umbrel and restart it if the service has stopped.",
    "Il motore non risponde. Controlla lo stato dell’app in Umbrel e riavviala se il servizio è fermo."
  ],
  [
    "The capture engine needs to be updated with the app. Update Landing Archive from the Umbrel store and restart it: earlier copies are kept.",
    "Il motore di acquisizione deve essere aggiornato insieme all’app. Aggiorna Landing Archive dallo store Umbrel e riavviala: le copie precedenti sono conservate."
  ],
  [
    "The capture engine is not responding",
    "Il motore di acquisizione non risponde"
  ],
  [
    "The engine uses earlier quality checks. Update and restart Landing Archive in Umbrel before capturing new copies.",
    "Il motore usa controlli di qualità precedenti. Aggiorna e riavvia Landing Archive in Umbrel prima di acquisire nuove copie."
  ],
  [
    "The site returned error {p0}",
    "Il sito ha risposto con errore {p0}"
  ],
  [
    "The capture does not contain all required files",
    "La cattura non contiene tutti i file richiesti"
  ],
  [
    "Discovery settings changed: the search will be repeated.",
    "Le impostazioni di scoperta sono cambiate: la ricerca sarà ripetuta."
  ],
  [
    "Address present in the sitemap again",
    "Indirizzo nuovamente presente nella sitemap"
  ],
  [
    "Address no longer present in the sitemap. Reachability is checked separately.",
    "Indirizzo non più presente nella sitemap. La raggiungibilità viene verificata separatamente."
  ],
  [
    "Site limit reached: increase it to archive more landing pages.",
    "Limite del sito raggiunto: aumenta il limite per archiviare ulteriori landing."
  ],
  [
    "Discovery completed: {p0} new pages{p1}",
    "Ricerca completata: {p0} nuove pagine{p1}"
  ],
  [
    "Check stopped to start a new manual attempt.",
    "Controllo interrotto per avviare un nuovo tentativo manuale."
  ],
  [
    "Site deleted",
    "Sito eliminato"
  ],
  [
    "New check requested",
    "Nuovo controllo richiesto"
  ],
  [
    "Priority manual check requested. Pages will be downloaded again; a new version will be kept if the content changes.",
    "Controllo manuale prioritario richiesto. Le pagine saranno scaricate di nuovo; una nuova versione verrà conservata se cambia il contenuto."
  ],
  [
    "Monitoring paused: a job stopped after three attempts. Check the site before resuming it.",
    "Monitoraggio in pausa: un lavoro è rimasto interrotto dopo tre tentativi. Controlla il sito prima di riattivarlo."
  ],
  [
    "Capture time limit exceeded (3 minutes). You can restart the check.",
    "Tempo massimo di acquisizione superato (3 minuti). Puoi riavviare il controllo."
  ],
  [
    "Capture error",
    "Errore di acquisizione"
  ],
  [
    "{p0}. New attempt scheduled ({p1}/3).",
    "{p0}. Nuovo tentativo programmato ({p1}/3)."
  ],
  [
    "Service shutdown",
    "Arresto del servizio"
  ],
  [
    "The current check has not stopped yet",
    "Il controllo corrente non si è ancora arrestato"
  ],
  [
    "New pages",
    "Nuove pagine"
  ],
  [
    "First copies",
    "Prime copie"
  ],
  [
    "Changes",
    "Modifiche"
  ],
  [
    "Returning versions",
    "Versioni ritornate"
  ],
  [
    "Unreachable pages",
    "Pagine non raggiungibili"
  ],
  [
    "Pages back online",
    "Pagine tornate online"
  ],
  [
    "Removed from sitemap",
    "Uscite dalla sitemap"
  ],
  [
    "Sitemap returns",
    "Rientri nella sitemap"
  ],
  [
    "Errors",
    "Errori"
  ],
  [
    "Partial copies",
    "Copie parziali"
  ],
  [
    "Completed copies",
    "Copie completate"
  ],
  [
    "New content to review",
    "Nuovi contenuti da verificare"
  ],
  [
    "Invalid filters or notes",
    "Filtri o annotazioni non validi"
  ],
  [
    "The start date must be before the end date",
    "La data iniziale deve precedere quella finale"
  ],
  [
    "Version not found",
    "Versione non trovata"
  ],
  [
    "Use up to 12 tags of 40 characters, separated by commas",
    "Usa fino a 12 tag di 40 caratteri, separati da virgole"
  ],
  [
    "Invalid web address.",
    "Indirizzo web non valido."
  ],
  [
    "Only HTTP/HTTPS URLs without credentials are allowed.",
    "Sono consentiti soltanto URL HTTP/HTTPS senza credenziali."
  ],
  [
    "Address too long.",
    "Indirizzo troppo lungo."
  ],
  [
    "Only web ports 80 and 443 are allowed.",
    "Sono consentite soltanto le porte web 80 e 443."
  ],
  [
    "Local network addresses are not allowed.",
    "Gli indirizzi di rete locale non sono consentiti."
  ],
  [
    "The domain could not be resolved.",
    "Impossibile risolvere il dominio."
  ],
  [
    "The domain points to a private or reserved network.",
    "Il dominio punta a una rete privata o riservata."
  ],
  [
    "Request limit reached.",
    "Limite di richieste raggiunto."
  ],
  [
    "Download timed out.",
    "Tempo di download esaurito."
  ],
  [
    "Resource too large.",
    "Risorsa troppo grande."
  ],
  [
    "Download limit reached.",
    "Limite di download raggiunto."
  ],
  [
    "Download interrupted by the site.",
    "Download interrotto dal sito."
  ],
  [
    "Too many redirects.",
    "Troppi reindirizzamenti."
  ],
  [
    "No copy available in the archive",
    "Nessuna copia disponibile nell’archivio"
  ],
  [
    "Open archived copy",
    "Apri la copia archiviata"
  ],
  [
    "Invalid or incomplete backup, or guided restore limits exceeded.",
    "Backup non valido, incompleto o oltre i limiti del ripristino guidato."
  ],
  [
    "File too large",
    "File troppo grande"
  ],
  [
    "Restore in progress. Wait for it to finish before using the archive.",
    "Ripristino in corso. Attendi il completamento prima di usare l’archivio."
  ],
  [
    "Upload expired or unavailable. Select the backup again.",
    "Caricamento scaduto o non disponibile. Seleziona nuovamente il backup."
  ],
  [
    "No safety copy available",
    "Nessuna copia di sicurezza disponibile"
  ],
  [
    "An upload is already in progress. Cancel it or wait one hour after its last activity.",
    "Un caricamento è già in corso. Annullalo oppure attendi un’ora dalla sua ultima attività."
  ],
  [
    "Select a complete ZIP backup, up to 32 GB.",
    "Seleziona un backup ZIP completo, fino a 32 GB."
  ],
  [
    "Upload already being verified",
    "Caricamento già in verifica"
  ],
  [
    "Invalid upload chunk",
    "Blocco del caricamento non valido"
  ],
  [
    "Verification is in progress. Wait for it to finish before cancelling.",
    "La verifica è in corso. Attendi che termini prima di annullare."
  ],
  [
    "Complete the upload first",
    "Completa prima il caricamento"
  ],
  [
    "The backup is invalid, incomplete or exceeds guided restore limits. The current archive is intact.",
    "Il backup non è valido, è incompleto oppure supera i limiti del ripristino guidato. L’archivio attuale è intatto."
  ],
  [
    "Complete verification and wait for exports to finish.",
    "Completa la verifica e attendi che le esportazioni siano terminate."
  ],
  [
    "Confirm the restore with your current account password.",
    "Conferma il ripristino con la password del tuo accesso attuale."
  ],
  [
    "Another operation is still running. Wait and try again.",
    "Un’altra operazione è ancora in corso. Attendi e riprova."
  ],
  [
    "Archive restored. Your account is unchanged. All sites are paused: resume them in their settings whenever you want.",
    "Archivio ripristinato. Il tuo accesso è invariato. Tutti i siti sono in pausa: riattivali dalle loro impostazioni quando vuoi."
  ],
  [
    "Invalid identifier",
    "Identificatore non valido"
  ],
  [
    "Content not found",
    "Contenuto non trovato"
  ],
  [
    "Invalid data",
    "Dati non validi"
  ],
  [
    "Text is invalid or too long",
    "Testo non valido o troppo lungo"
  ],
  [
    "Enter up to 20 paths, such as /offers, without full addresses or wildcards.",
    "Inserisci fino a 20 percorsi, per esempio /offerte, senza indirizzi completi o caratteri jolly."
  ],
  [
    "At most {p0} areas are allowed.",
    "Sono consentite al massimo {p0} zone."
  ],
  [
    "Invalid area",
    "Zona non valida"
  ],
  [
    "The starting address is fixed. Add a page or a new site to follow another address.",
    "L’indirizzo iniziale è fisso. Aggiungi una pagina o un nuovo sito per seguire un altro indirizzo."
  ],
  [
    "Invalid interval or page limit",
    "Frequenza o limite di pagine non valido"
  ],
  [
    "Invalid landing page discovery interval",
    "Frequenza di ricerca delle landing non valida"
  ],
  [
    "Invalid site options",
    "Opzioni del sito non valide"
  ],
  [
    "Operation failed. Check available disk space and try again.",
    "Operazione non completata. Controlla lo spazio disponibile e riprova."
  ],
  [
    "Too many attempts. Wait a minute and try again.",
    "Troppi tentativi. Attendi un minuto e riprova."
  ],
  [
    "This address is already in the archive",
    "Questo indirizzo è già presente nell’archivio"
  ],
  [
    "Site and page exclusions exceed the combined limit of 30. Reduce the excluded areas first.",
    "Le esclusioni del sito e di una pagina superano il limite complessivo di 30. Riduci prima le zone escluse."
  ],
  [
    "Invalid restart option",
    "Opzione di riavvio non valida"
  ],
  [
    "Confirm the site to delete",
    "Conferma il sito da eliminare"
  ],
  [
    "A backup is running. Wait for it to finish before deleting the site.",
    "Un backup è in corso. Attendi che termini prima di eliminare il sito."
  ],
  [
    "Invalid check date",
    "Data del controllo non valida"
  ],
  [
    "Page and site exclusions are limited to 30 in total.",
    "Le esclusioni della pagina e del sito possono essere al massimo 30 in totale."
  ],
  [
    "Invalid browsing date",
    "Data di consultazione non valida"
  ],
  [
    "This copy exceeds the safe processing limit. You can view the saved screenshot.",
    "Questa copia supera il limite di elaborazione sicura. Puoi consultare lo screenshot conservato."
  ],
  [
    "Choose two versions of the same page",
    "Scegli due versioni della stessa pagina"
  ],
  [
    "Highlighting is already being prepared. Wait a few seconds and try again.",
    "È già in preparazione un’evidenziazione. Attendi qualche secondo e riprova."
  ],
  [
    "This old copy exceeds the highlighting limit. You can view the original screenshot.",
    "Questa vecchia copia supera il limite dell’evidenziazione. Puoi consultare lo screenshot originale."
  ],
  [
    "An export is already running",
    "Un’esportazione è già in corso"
  ],
  [
    "Landing Archive ready on port {p0}",
    "Landing Archive pronta sulla porta {p0}"
  ],
  [
    "Site not found",
    "Sito non trovato"
  ],
  [
    "Confirm the site and preview before clearing copies.",
    "Conferma il sito e l’anteprima prima di azzerare le copie."
  ],
  [
    "Wait for the backup or restore to finish before clearing copies.",
    "Attendi il termine del backup o del ripristino prima di azzerare le copie."
  ],
  [
    "Copies or checks have changed. Refresh the preview before confirming.",
    "Le copie o i controlli sono cambiati. Aggiorna l’anteprima prima di confermare."
  ],
  [
    "Copy removed during site reset; date kept.",
    "Copia rimossa durante l’azzeramento del sito; data conservata."
  ],
  [
    "Site copies cleared on request. Fresh scan started without earlier references.",
    "Copie del sito azzerate su richiesta. Nuova scansione avviata senza riferimenti precedenti."
  ],
  [
    "Copies cleared. A fresh scan is queued; site, pages and settings kept.",
    "Copie azzerate. Nuova scansione in coda; sito, pagine e impostazioni conservati."
  ],
  [
    "Not enough disk space: new captures are paused. Existing versions are safe.",
    "Spazio insufficiente: le nuove acquisizioni sono sospese. Le versioni esistenti sono al sicuro."
  ],
  [
    "File not found",
    "File non trovato"
  ],
  [
    "Service configuration is not ready",
    "Configurazione del servizio non pronta"
  ],
  [
    "Service access not allowed",
    "Accesso al servizio non consentito"
  ],
  [
    "A capture is already in progress",
    "Un’acquisizione è già in corso"
  ],
  [
    "Invalid parameters",
    "Parametri non validi"
  ],
  [
    "Invalid options",
    "Opzioni non valide"
  ],
  [
    "Capture incomplete",
    "Acquisizione non completata"
  ],
  [
    "Capture service ready on port {p0}",
    "Servizio acquisizioni pronto sulla porta {p0}"
  ],
  [
    "{p0} running · {p1} seconds",
    "{p0} in corso · {p1} secondi"
  ],
  [
    "check queued",
    "controllo in attesa"
  ],
  [
    "Deleting…",
    "Eliminazione…"
  ],
  [
    "WELCOME TO YOUR ARCHIVE",
    "BENVENUTO NEL TUO ARCHIVIO"
  ],
  [
    "YOUR PRIVATE SPACE",
    "IL TUO SPAZIO PRIVATO"
  ],
  [
    "Welcome back.",
    "Bentornato."
  ],
  [
    "{p0} yours · {p1} competitors",
    "{p0} tuoi · {p1} competitor"
  ],
  [
    "Every {p0} h",
    "Ogni {p0} h"
  ],
  [
    "Delete {p0}",
    "Elimina {p0}"
  ],
  [
    "Area {p0} of {p1}",
    "Zona {p0} di {p1}"
  ],
  [
    "Open {p0}",
    "Apri {p0}"
  ],
  [
    "{p0}–{p1} of {p2}",
    "{p0}–{p1} di {p2}"
  ],
  [
    "webinar, lead magnet, launch",
    "webinar, lead magnet, lancio"
  ],
  [
    "Saving…",
    "Salvataggio…"
  ],
  [
    "Title, address, tag or note",
    "Titolo, indirizzo, tag o annotazione"
  ],
  [
    "Area {p0}",
    "Zona {p0}"
  ],
  [
    "{p0} elements",
    "{p0} elementi"
  ],
  [
    "· Previous: {p0}",
    "· Precedente: {p0}"
  ],
  [
    "of {p0}",
    "di {p0}"
  ],
  [
    "Variant {p0}",
    "Variante {p0}"
  ],
  [
    "version",
    "versione"
  ],
  [
    "date",
    "data"
  ],
  [
    "App language",
    "Lingua dell’app"
  ],
  [
    "YOUR PREFERENCES",
    "LE TUE PREFERENZE"
  ],
  [
    "Make the archive feel at home.",
    "Personalizza il tuo archivio."
  ],
  [
    "Language",
    "Lingua"
  ],
  [
    "English is the default. Your choice is saved in this browser and applies immediately.",
    "L’inglese è la lingua predefinita. La scelta viene salvata in questo browser e applicata subito."
  ],
  [
    "Archived websites, site names and your notes stay in their original language. Capture settings are unchanged.",
    "I siti archiviati, i nomi dei siti e le tue note rimangono nella lingua originale. Le impostazioni di acquisizione non cambiano."
  ],
  [
    "Connection failed. Reopen the app from Umbrel and try again.",
    "Errore di connessione. Riapri l’app da Umbrel e riprova."
  ],
  [
    "Visual change detected",
    "Modifica visiva rilevata"
  ],
  [
    "Quality unverified",
    "Qualità non verificata"
  ],
  [
    "quality unverified",
    "qualità non verificata"
  ],
  [
    "Visual change detected - quality unverified",
    "Modifica visiva rilevata - qualità non verificata"
  ],
  [
    "Failed to fetch",
    "Failed to fetch"
  ]
];
