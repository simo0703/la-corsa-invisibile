# La Corsa Invisibile — Log delle decisioni

Aggiornato al: 12 luglio 2026 (fine sessione, dopo il Passo 21 — profilo
giocatore persistente, Fase 1 di 4: solo schema D1 + registrazione/accesso,
nessun collegamento al gameplay; lavoro sospeso qui su richiesta)

Questo file serve a non perdersi tra una sessione di lavoro e l'altra: raccoglie cosa
è stato deciso, cosa è ancora un'ipotesi da confermare, e cosa manca. Va aggiornato
ogni 3-4 passaggi di lavoro, non a ogni singola modifica.

**Nota su un buco nel log**: tra il Passo 18 e questa sessione sono state fatte
almeno 3 commit (token di sessione per autenticare le azioni comandante, rimozione
della "corsa al comandante" a favore del `tokenCreazione`, cessione volontaria del
ruolo) che non risultano loggate qui sotto come Passi numerati — la sessione che le
ha scritte non ha aggiornato questo file. Non ricostruito retroattivamente in questa
sessione (fuori scope); se serve, va fatto a parte guardando `git log`.

**Punto di ripresa**: con il Passo 21, esiste un primo pezzo di profilo
giocatore persistente cross-stanza: tabella D1 `giocatori_persistenti`
(stesso database già esistente, `la-corsa-invisibile-db`) + endpoint
`POST /profilo/registra` e `POST /profilo/accedi`, completamente isolati dal
resto del gioco — **nessun collegamento a `/join`, a `GameSession.js`, o a
qualunque stanza esistente**. Schema NON ancora applicato al D1 reale
(`npm run db:init`/`db:init:remote` da eseguire). Fase 1 di 4: le fasi
successive (collegare il profilo a `/join`, UI in `public/`, uso reale di
XP/bonus nel gameplay) non sono ancora state discusse né pianificate in
dettaglio. Vedi Passo 21 nel changelog per le tre scelte di design chiarite
con l'autore (dove va il D1, hashing del PIN, struttura di `bonusScelti`).
Con il Passo 20, l'Esploratore ha un primo bilanciamento di classe: dado di
risoluzione 1d6 (invece del default 1d4) quando tira con la propria
competenza principale (Cadenza), e un meccanismo generico di bonus
condizionale (+1 a una competenza, dichiarato a mano su una risposta) pensato
per inseguimento/fuga/terreno non rivelato — vedi Passo 20 nel changelog per i
dettagli e le scelte di design. Nessuna risposta esistente nei 5 nodi è stata
ancora taggata con questo bonus: è infrastruttura pronta, non ancora usata nel
contenuto narrativo reale. Il Passo 19 ha corretto una regressione pre-esistente
(4 file di test rimasti senza token dopo l'introduzione dell'autenticazione,
vedi nota sul buco nel log sopra) — commit separato dal bilanciamento.
Restano invariate le basi descritte per il Passo 18: **tutti e 5 i nodi
temporali** del
gioco (`1836-torino`, `1848-milano`, `1915-carso-piave`,
`emergenza-civile`, `missione-moderna`) hanno ora almeno una risposta
convertita a tiro reale (`competenzaRichiesta`), un pool di contenuto per
il Cronista registrato in `src/lib/narratore-registro-pool.js`, e librerie
di testo libero per **tutte** le loro richieste registrate in
`src/lib/interprete-registro-librerie.js` — stesso schema replicato
identico nodo per nodo, senza mai toccare il motore generico
(`GameSession.js`, `narratore-simulato.js`, `src/lib/interprete-libero/`).
Il testo libero (interprete di linguaggio naturale) è collegato al gioco
dal Passo 13 — si affianca ai bottoni delle risposte, non li sostituisce.
Il matching gira lato server (modulo `src/lib/interprete-libero/`, copiato
da `simulatore-interprete` e convertito in ESM). Quando l'interprete è
ambiguo, la richiesta resta `session.interpretazionePendente` finché il
comandante non la risolve (`POST /risolvi-interpretazione`) — funziona tra
dispositivi diversi, verificato dal vivo con due tab separate.
**Stato per nodo** (competenza a tiro / pool Cronista / librerie testo
libero — tutte e tre ormai presenti ovunque, quello che cambia è quante
risposte per nodo hanno il tiro):
- `1836-torino`: 1 risposta a tiro (cadenza, Passo 9), pool (Passo 5),
  librerie sulle 3 opzioni di `decalogo-ginnastica` più le richieste del
  ramo severo (Passo 13).
- `1848-milano`: 1 risposta a tiro (cadenza, Passo 14), pool (Passo 14),
  librerie su **tutte e 6** le risposte delle due richieste del nodo
  (Passo 14).
- `1915-carso-piave`: 1 risposta a tiro (passoAvanti, Passo 15), pool e
  librerie su **entrambe** le richieste del nodo aggiunti nel Passo 16
  (mancavano ancora al termine del Passo 15).
- `emergenza-civile`: 1 risposta a tiro (spiritoDiCorpo, Passo 17), pool e
  librerie su **entrambe** le richieste del nodo, stesso Passo 17.
- `missione-moderna`: 1 risposta a tiro (ancoraggio, Passo 18), pool e
  librerie su **entrambe** le richieste del nodo, stesso Passo 18.
**Bug reale trovato e corretto nel Passo 13**: il polling di
`public/index.html` (`avviaPolling`) non ha mai aggiornato nulla in tempo
reale per nessun giocatore, da prima di quella sessione —
destrutturava `{ session }` da `GET /state`, che invece restituisce la
sessione senza involucro. Corretto.
Il bug noto di `public/index.html` (non mandava mai `giocatoreId` a
`/scegli`) è corretto dal Passo 11.
Il Cronista è collegato al flusso di `/scegli` dal Passo 10, tramite un
registro `nodoId → pool` (`src/lib/narratore-registro-pool.js`) — ora
copre tutti e 5 i nodi. `storicoFrammenti` (anti-ripetizione del Cronista)
resta sempre `[]`: nessun nuovo campo di sessione per ora, vedi nota più
sotto.
Restano da confermare: la definizione del Margine, e poi codice del libro /
chat / chiamata vocale (vedi sotto) — invariato dal Passo 3. Restano anche
da fare, ora che la copertura di base è completa: convertire altre
risposte fisse a tiro reale (oggi ogni nodo ne ha solo una), tarare le
soglie provvisorie dell'interprete su testo libero reale scritto da
persone vere, e — se emerge un bisogno reale — tracciare
`storicoFrammenti`.

**Nota per il futuro (non lavoro da fare subito)**: `storicoFrammenti` è
stato lasciato sempre `[]` per scelta — il motore lo supporta (evita di
ripetere lo stesso frammento a distanza ravvicinata), ma non è tracciato in
`session.storicoFrammenti`. Se in futuro emerge un bisogno reale (gruppi
che rigiocano più volte lo stesso nodo/risposta e notano ripetizioni),
si aggiunge come nuovo campo di stato con la relativa modifica a
`initState()`/`migrateState()`, come da regola del progetto.

**Nota tecnica su questo file**: per un periodo il repository ha avuto una versione
vecchia di questo log (ferma al Passo 1) caricata per sbaglio insieme ad altri file.
Questa versione è quella corretta e completa; se in futuro trovi discrepanze tra
codice e log, fidati del codice e segnalalo.

---

## Obiettivo del progetto

Adattare a *La Corsa Invisibile* le meccaniche già collaudate su *La Soglia*
(roomzero.online) — **simile, non identico**. L'aspetto grafico si rivede dopo:
per ora il lavoro è solo su motore e regole.

Repository: `github.com/simo0703/la-corsa-invisibile` (reso pubblico il 10/07/2026,
controllato — nessuna credenziale esposta, `ADMIN_PASSWORD` correttamente su
Cloudflare come secret).

Stato di partenza: solo motore backend (Worker + Durable Object + D1), **nessuna
interfaccia di gioco** ancora costruita (cartella `public/` assente all'inizio,
oggi contiene un `index.html` minimo).

---

## Decisioni confermate (dall'utente)

1. **Nodi temporali**: restano l'unità narrativa di base. Le richieste al loro
   interno possono avere risposte **fisse o variabili**, e la scelta fatta deve
   poter determinare **quali richieste/azioni si aprono dopo** — quindi i nodi
   devono poter ramificarsi, non essere solo una sequenza lineare fissa.

2. **Bilanciamento decisione/dado**: le **competenze dei personaggi** pesano
   *molto di più* nel determinare gli esiti; il dado interviene solo come
   correttivo minore. Il sistema NON è "competenza + dado + soglia" come
   meccanismo centrale alla Soglia — è più decisionale, il dado aggiusta
   invece di determinare.
   **Implementato**: 5 competenze (Cadenza, Precisione, Spirito di Corpo,
   Passo Avanti, Ancoraggio), ognuna delle 4 competenze principali legata a
   un ruolo diverso (Esploratore→Cadenza, Fanfarista→Passo Avanti,
   Custode→Spirito di Corpo, Incursore→Precisione; Ancoraggio trasversale,
   di nessun ruolo). Punteggio 1-5, principale parte da 3, le altre da 1,
   + 3 punti extra liberi in creazione (tetto 5). Dado 1d4 sommato al
   punteggio; verificato che la competenza alta batte sempre quella bassa
   anche nel peggior/miglior caso di fortuna incrociata. Soglie: 8+ pieno,
   5-7 parziale, ≤4 fallimento. **Non ancora collegato ai nodi temporali**
   (i nodi restano a effetti fissi per ora).

3. **Narrazione assistita da AI**: architettura ibrida approvata —
   - Gli **effetti meccanici** (variazioni di risorse/tracce, quale nodo si apre
     dopo) restano **regole scritte da voi**, deterministiche, testabili.
   - Il **testo di narrazione** dell'esito può essere generato da AI (modello
     Claude Haiku, economico e adatto a testi brevi e vincolati), eventualmente
     editabile dal narratore prima che i giocatori lo vedano.
   - **Non è ancora stato implementato** — resta l'opzione "premium" da
     agganciare più avanti sopra il Cronista (vedi punto 5), senza riscrivere
     nulla del flusso di gioco.

4. **Costo AI / monetizzazione**: costo reale stimato trascurabile
   (~0,002 $ per singola generazione con Haiku, pochi centesimi a sessione
   intera). Decisione: **nessun sistema di pagamento per ora**. Si procede con:
   - un tetto rigido di generazioni AI per sessione/giorno (il campo
     `aiUsageStanza` è già nello stato, non ancora collegato a una chiamata reale),
   - costo assorbito nei costi correnti del progetto,
   - osservazione dell'uso reale per un paio di mesi dopo il lancio prima di
     valutare se e come far pagare (pacchetto "gettoni" o incluso nel prezzo del
     libro sono le opzioni più semplici, se servirà).

5. **Il Cronista — motore neutro di narrazione a frammenti (fatto nel Passo 4)**:
   costruito `src/lib/narratore-simulato.js`, **completamente neutro**: nessun
   termine specifico di Corsa Invisibile al suo interno, pensato per essere
   riusato identico su futuri giochi. Compone il testo di un esito in tre slot
   in sequenza (apertura → sviluppo → eco), scegliendo per ognuno un frammento
   da un "pool" esterno (il file con la narrativa vera, ancora da scrivere).
   Selezione pesata con tentativo di evitare ripetizioni recenti. Un frammento
   può essere testo con placeholder (`{ruolo}`, `{nodo}`...) oppure una
   funzione programmatica che calcola il testo guardando tutto il contesto
   (esito, competenza, ruolo, margine e la sua "fascia" basso/medio/alto/
   critico calcolata automaticamente dal motore). 21 test automatici, tutti
   passati (`node test-narratore-simulato.mjs`). Vantaggi rispetto alla vera
   AI: costo zero, nessuna chiave API, nessuna dipendenza esterna, latenza
   istantanea. La vera AI (Claude API, punto 3-4 sopra) resta un'opzione
   "premium" agganciabile più avanti senza riscrivere nulla, perché entrambe
   le strade producono lo stesso output (il testo dell'esito) che
   `GameSession.js` già si aspetta.
   **Ancora da fare**: il pool vero di frammenti narrativi per Corsa
   Invisibile (contenuto, non motore) e il collegamento a `GameSession.js`.

6. **Pool di contenuto del Cronista per `1836-torino` (fatto nel Passo 5)**:
   scoped a un solo nodo per scelta deliberata (validare l'approccio prima di
   scalare agli altri 4). Varia per esito (baseline sempre presente per
   apertura/sviluppo/eco), ruolo (apertura), competenza (sviluppo) e fascia
   di margine (eco) — i tre assi decisi esplicitamente, più quello già
   previsto dal motore.

7. **Formato del contenuto: markdown, non JS (fatto nel Passo 6)**: il
   contenuto del punto 6 sopra è stato riscritto da oggetti JS hardcoded a
   un file di testo leggibile (`src/lib/narratore-corsa-invisibile.md`,
   tabelle markdown), con un caricatore separato
   (`src/lib/narratore-corsa-invisibile-loader.js`, puro JS senza I/O) che lo
   trasforma nel formato atteso dal motore. **Vincolo tecnico rispettato**: i
   Cloudflare Workers non hanno accesso al filesystem a runtime, quindi il
   `.md` non può essere letto con `fs.readFile` quando il Worker gira in
   produzione. Soluzione: `src/lib/narratore-corsa-invisibile.js` importa il
   `.md` come testo con la sintassi `import testo from "./file.md"`, risolta
   da Wrangler **in fase di build/deploy** (regola `[[rules]] type = "Text"`
   aggiunta in `wrangler.toml`) — verificato concretamente con
   `wrangler deploy --dry-run` su un entry-point di prova: il contenuto del
   `.md` viene caricato da Wrangler come modulo separato e allegato al
   pacchetto del Worker, non letto da disco quando il Worker risponde a una
   richiesta. Stesso meccanismo che Cloudflare usa per i moduli WASM. Nei
   test locali (`node test-*.mjs`, senza wrangler/miniflare) il `.md` viene
   invece letto con `fs.readFileSync` **dal test stesso**, non dal codice di
   produzione: è legittimo perché il test gira su Node, non sul Worker.
   39 test automatici, tutti passati (`node test-narratore-corsa-invisibile.mjs`),
   inclusi test sul parsing di markdown malformato (id/testo mancanti, slot
   sconosciuto, tabella senza intestazione) che falliscono in modo esplicito.
   Nessun frammento attuale richiede logica programmatica (funzione invece di
   stringa): se in futuro servisse, resta un'eccezione da scrivere in JS a
   parte, il caricatore già lo prevede nei commenti.
   **Ancora da fare**: gli altri 4 nodi, e soprattutto il collegamento — non
   può avvenire finché `risoluzione.js` non è agganciato al flusso dei nodi
   (vedi punto 2 e "Punto di ripresa" sopra).

8. **`/scegli` sa chi sta scegliendo (fatto nel Passo 7)**: `giocatoreId` nel
   body della richiesta, coerente con `/risorse` e `/avvia-nodo` (nessuna
   infrastruttura di sessione/token nel Worker). **Obbligatorio e validato**:
   400 se manca, 400 se non corrisponde a un giocatore già unito alla stanza
   con `/join` (anche se valido in un'altra stanza — l'id è per-Durable-Object,
   non globale). Tracciato **solo** in `storicoScelte` (campo `giocatoreId`
   per voce) — deliberatamente non anche altrove, per restare minimo. Passo
   isolato di proposito, chiesto prima di collegare `risoluzione.js`, così
   che quel collegamento possa già usare le competenze del giocatore giusto
   invece di doverci tornare sopra due volte.

9. **`risoluzione.js` collegato a `/scegli` (fatto nel Passo 8)**: tre
   domande poste e risolte prima di scrivere codice. Come si dichiara un
   tiro: nuovo campo `competenzaRichiesta: "<id>"` sulla risposta. Se
   convivono risposte fisse e con tiro: **sì, nello stesso nodo**, nessuna
   risposta esistente convertita (questo passo era motore, non contenuto).
   Cosa succede al campo `esito`: **diventa un oggetto per tier**
   (`{ pieno, parziale, fallimento }`) per le risposte con tiro, così il
   client (`public/index.html`) continua a vedere sempre un testo senza
   bisogno di modifiche — resta stringa fissa per le risposte senza tiro.
   Effetti anch'essi differenziati per tier (`effettiPerEsito`), non un
   blocco fisso: altrimenti il tiro non avrebbe cambiato nulla di
   meccanico, in contraddizione con la decisione già presa al punto 2
   ("le competenze pesano molto di più nel determinare gli esiti").
   **Scoperta e risolta in corsa**: `/join` assegnava sempre
   `competenze: {}` — `creaCompetenzeIniziali()` non veniva mai chiamato.
   Corretto: `/join` ora popola competenze base reali per il ruolo (nessun
   punto extra, quella distribuzione libera resta un passo a parte); un
   ruolo sconosciuto ora risponde 400 invece di essere accettato in
   silenzio con competenze vuote.
   **Robustezza**: punteggio di competenza mancante nel record di un
   giocatore (es. vecchie sessioni) trattato come 0, non fa crashare;
   `effettiPerEsito`/`esito` mancanti per il tier estratto da un tiro
   fanno fallback rispettivamente a "nessun effetto" e `null`, non
   un'eccezione.
   **Non toccato**: il Cronista (nessuna risposta reale genera ancora un
   `esito` che il pool possa consumare), login/progressione tra stanze.

10. **Prima risposta reale con tiro (fatta nel Passo 9)**: nodo
    `1836-torino`, richiesta `decalogo-ginnastica`, risposta "A tutta
    velocità, senza calcolare i rischi" convertita da effetto fisso a
    `competenzaRichiesta: "cadenza"`. Tier "parziale" ancorato agli stessi
    numeri/testo che questa risposta aveva prima di questo passaggio
    (continuità con la cronologia già giocata); "pieno" e "fallimento"
    scritti per essere rispettivamente migliore e peggiore in modo
    coerente con la scena (corsa a tutta velocità nella nebbia). Le altre
    due risposte della stessa richiesta restano a effetto fisso — le due
    forme convivono nello stesso nodo reale. La ramificazione verso
    `decalogo-vaira-severo` resta legata alla scelta, non al tiro: vale
    per ogni esito del tiro.
    Testato end-to-end su questo nodo reale specifico (non solo sul nodo
    di prova sintetico di `test-scegli-risoluzione.mjs`): tier forzati
    (pieno/fallimento) via punteggio estremo, il tiro con la competenza
    REALE assegnata dal ruolo (Esploratore, Cadenza 3 — mai "pieno" con
    quel punteggio, solo "parziale"/"fallimento", verificato su 30
    tentativi), coesistenza con le altre risposte della stessa richiesta,
    e il percorso completo dalla risposta con tiro alla chiusura del nodo
    passando per il ramo severo.

11. **Il Cronista collegato a `/scegli` (fatto nel Passo 10)**: quattro
    domande poste e risolte prima di scrivere codice. Quando si attiva:
    **solo per risposte con tiro** (`competenzaRichiesta`) — una risposta a
    effetto fisso ha un solo esito, non un tier da cui il Cronista possa
    variare; effetto collaterale voluto, nessuno degli altri 4 nodi ha
    risposte con tiro oggi, quindi il Cronista non viene mai invocato lì.
    Come proteggersi dai nodi senza pool: **un registro esplicito
    `nodoId → pool`** (`src/lib/narratore-registro-pool.js`), non un
    controllo hardcoded su un nodo specifico dentro `GameSession.js` — il
    motore resta generico, aggiungere un pool per un nuovo nodo è
    aggiungere una voce al registro. Sostituzione o affiancamento: il
    testo del Cronista **sostituisce** `esito`, coerente con l'architettura
    decisa fin dall'inizio (punto 3: il testo di narrazione può essere
    generato, il Cronista è la versione gratuita di quell'idea).
    `storicoFrammenti`: **resta sempre `[]`** per ora, nessun nuovo campo
    di stato — annotato come nota per il futuro, non lavoro da fare subito.
    **Vincolo tecnico scoperto e risolto**: i pool reali importano un
    `.md`, risolvibile solo da Wrangler, non da Node puro (usato dai
    test) — un `import` statico di quel modulo dentro `GameSession.js`
    avrebbe rotto TUTTI i test esistenti al solo caricamento. Risolto con
    `import()` dinamico dentro il registro, dentro un `try/catch` **scoped
    al solo caricamento del modulo**: se fallisce (Node puro, o nodo senza
    voce nel registro) si ricade sul testo statico, senza errori. Verificato
    esplicitamente, su richiesta, che quel `try/catch` NON avvolga anche la
    composizione del testo (`componiNarrazione`): un errore vero dentro il
    motore o il pool si propaga sempre, non finisce mai nel fallback
    silenzioso. Per testare la sostituzione vera sotto Node puro (dove il
    caricatore reale non si risolve), il registro espone anche
    `registraPool(nodoId, caricaPool)`, usata SOLO dai test per iniettare
    un pool costruito in modo portabile (stesso `.md`, letto da `fs` come
    negli altri test, non tramite l'import Wrangler-only).
    Aggiunto anche `nomeConArticolo` a ogni ruolo in `game-config.js` (es.
    "L'Esploratore", "Il Fanfarista", "Il Custode" per "Custode /
    Soccorritore" — il doppio nome non si legge bene a metà frase), passato
    come `variabili.ruolo` al Cronista: senza, i frammenti che iniziano con
    `{ruolo}` producevano testo grammaticalmente sbagliato ("Fanfarista
    scandisce" invece di "Il Fanfarista scandisce") — scoperto mostrando
    esempi reali in chat prima di procedere, corretto prima del collegamento
    definitivo.
    Verificato concretamente (non solo a lettura di codice) con
    `wrangler deploy --dry-run` sul vero entry-point (`src/index.js`, non
    più un entry-point di prova come nel Passo 6) che il bundle di
    produzione include correttamente sia il `.md` sia il registro.

12. **Fix del bug noto in `public/index.html` (fatto nel Passo 11)**: il
    client scartava la risposta di `/join` (`await chiamaAPI(...)` senza
    assegnazione) e quindi non salvava mai il `giocatoreId` restituito dal
    server — di conseguenza `/scegli` non lo mandava mai, 400 su ogni
    scelta reale. Corretto: la risposta di `/join` (l'intera sessione, con
    tutti i giocatori della stanza) viene ora catturata, e
    `session.giocatori[session.giocatori.length - 1].id` — l'ultimo
    dell'array, sempre quello appena aggiunto da questa chiamata, dato che
    un Durable Object serializza le richieste — viene salvato in
    `STATO.giocatoreId` (persistito in `localStorage` come il resto di
    `STATO`) e incluso nel body di `/scegli`.
    **Verificato dal vivo**, non solo mentalmente: avviato `wrangler dev`,
    aperto nel browser, join di un Esploratore, avviato `1836-torino`,
    scelto "A tutta velocità" — nessuna richiesta fallita (spuntato via
    `preview_network`), `STATO.giocatoreId` presente in `localStorage`
    dopo il join. Uscito il tier "parziale" al primo tentativo, poi (in una
    stanza nuova) "fallimento" — in entrambi i casi il testo mostrato era
    quello composto dal Cronista (verificato leggendolo, e confermando che
    NON corrispondesse a nessuno dei testi statici per tier), con gli
    effetti meccanici coerenti col tier uscito. "Pieno" non è comparso in
    questi tentativi: con Cadenza base 3 (Esploratore, nessun punto extra)
    è irraggiungibile per costruzione (3 + dado massimo 4 = 7 < soglia 8),
    coerente con quanto già verificato nei test automatici — non indica un
    problema del fix.

13. **Identità comandante + pannello (fatto nel Passo 12)**: il
    comandante/narratore è chi crea la stanza, ma non è un ruolo separato
    nella lista ruoli — è un giocatore normale con un flag in più.
    **Identità**: il primo giocatore che fa `/join` in una stanza appena
    creata (`session.giocatori.length === 0` al momento del join) diventa
    comandante. Limite noto: se il link viene condiviso prima che il
    creatore stesso faccia `/join`, un altro giocatore potrebbe diventare
    comandante per primo — accettabile per ora, da rivedere se diventa un
    problema reale.
    **Nessun nuovo endpoint per "richiesta attiva specifica"**: il
    comandante sceglie quale NODO avviare (`/avvia-nodo`, già esistente),
    il resto procede in automatico via `/scegli` come già implementato.
    **Esito del tiro sempre quello di `risolviAzione()`**: mai
    sovrascrivibile manualmente, il comandante lo vede, non lo cambia —
    `/scegli` non è stato toccato.
    **Margine modificabile manualmente**: estesa la logica esistente di
    `/risorse` (non un endpoint dedicato) — "margine" accettato come chiave
    speciale con lo stesso pattern delta delle risorse di squadra, riuso
    dello stesso modello mentale già presente nel ciclo di effetti di
    `/scegli` (che tratta "margine" allo stesso modo).
    **Nessuna migrazione in `initState()`/`migrateState()`**: `comandante`
    è un campo per-giocatore (dentro l'array `giocatori`), non un campo di
    sessione — stesso trattamento già riservato a `competenze`, mai
    retro-assegnate ai giocatori pre-esistenti. Un giocatore vecchio senza
    `comandante` ha semplicemente `undefined` (falsy, trattato come "non
    comandante").
    **Nessun controllo di autorizzazione lato server**: coerente col resto
    dell'API, che non ha alcuna infrastruttura di sessione/token — il
    vincolo "solo il comandante" è imposto solo lato client (il pannello
    non compare se `STATO.comandante` non è `true`), non impedisce
    tecnicamente a chiunque di chiamare gli stessi endpoint.
    **Pannello lato client**: margine (lettura, con soglia) e
    avvio/cambio nodo (select + bottone) e modifica manuale del margine
    (scrittura); nodo/richiesta attiva NON duplicati (già visibili a tutti
    nell'area principale); risorse di squadra ed elenco giocatori NON
    duplicati (già visibili a tutti sopra). Note libere del comandante
    **solo in `localStorage`**, mai inviate al server — verificato che
    scriverle non generi alcuna richiesta di rete.
    **Verificato dal vivo**, non solo mentalmente: `wrangler dev` +
    browser, due tab con `localStorage` separatamente svuotato per
    simulare due dispositivi diversi (le tab dello stesso browser
    condividono lo stesso `localStorage`, quindi non bastava aprirne una
    seconda). Primo giocatore → comandante, pannello visibile, margine
    modificato da 0 a 3 tramite il pannello, nodo avviato dal pannello
    (si riflette nell'area principale). Secondo giocatore (storage pulito,
    `/join` reale) → `comandante: false`, pannello assente, resto della
    schermata invariato.

14. **Interprete di testo libero collegato, nodo pilota `1836-torino`
    (fatto nel Passo 13)**: architettura decisa esplicitamente prima di
    scrivere codice. Il testo libero **si affianca** ai bottoni delle
    risposte, non li sostituisce. Il matching gira **lato server** (nuovo
    endpoint nel Worker), non nel browser. Il motore
    (`normalizza`/`stopword`/`libreria`/`punteggio`/`interprete`, copiato
    da `github.com/simo0703/simulatore-interprete` e convertito da
    CommonJS a ESM) vive come **file locali** in
    `src/lib/interprete-libero/`, non come dipendenza npm esterna —
    stesso pattern già usato per `narratore-simulato.js` del Cronista.
    Le librerie di frasi d'esempio sono **un file `.md` per richiesta**
    (non dentro `game-config.js`), con un registro
    `richiestaId → libreria` (`src/lib/interprete-registro-librerie.js`,
    stesso schema del registro `nodoId → pool` del Cronista): import
    dinamico dentro `try/catch`, `registraLibreria()` per iniezione nei
    test — se una richiesta non ha una libreria registrata, il client
    resta a soli bottoni per quella richiesta, nessun errore.
    Quando l'interprete è **ambiguo o incerto**, la richiesta resta
    **pendente** nello stato della stanza (`session.interpretazionePendente`,
    con migrazione in `initState()`/`migrateState()`) finché il
    comandante non la risolve con `POST /risolvi-interpretazione`
    (candidato scelto, o `annulla: true` per far riprovare il giocatore
    senza applicare nulla) — deve funzionare tra dispositivi diversi
    (chi scrive il testo e il comandante su browser separati), quindi
    non poteva essere gestita solo nella risposta HTTP immediata.
    **Refactoring necessario**: la logica di "applicare una risposta"
    (tiro, effetti, Cronista, `storicoScelte`, complicazione da margine,
    prossima richiesta/ramificazione, esito del nodo) è stata estratta
    da `/scegli` in `GameSession.applicaRisposta()`, riusata da tre punti
    (`/scegli`, `/interpreta` esito automatico, `/risolvi-interpretazione`)
    senza duplicazione.
    Soglie di decisione (`sogliaAlta: 0.6`, `margineDistacco: 0.15`)
    **esplicitamente provvisorie**, commentate come tali nel codice — non
    ancora tarate su un volume reale di testo scritto da persone vere.
    **Bug reale scoperto durante la verifica dal vivo di questo passo**
    (non introdotto qui, preesistente): `avviaPolling()` in
    `public/index.html` destrutturava `const { session } = await
    chiamaAPI(.../state)`, ma `GET /state` restituisce la sessione senza
    involucro (`Response.json(session)` in `GameSession.js`) — quindi
    `session` era sempre `undefined`, ogni tick lanciava un errore
    ingoiato in silenzio da un `catch(e){}` vuoto, e il polling non ha
    **mai** aggiornato risorse/giocatori/pannello comandante in tempo
    reale per nessun giocatore, in nessuna sessione di gioco precedente
    a questa correzione. Corretto (tolta la destrutturazione errata, in
    due punti: `avviaPolling()` e `aggiornaSchermataGioco()`).
    **Verificato dal vivo** con `wrangler dev` e due tab browser separate
    (localStorage isolato per simulare due dispositivi): testo chiaro →
    selezione automatica identica a un click; testo ambiguo → compare nel
    pannello comandante con i candidati e i punteggi, risolverlo applica
    l'effetto giusto, annullarlo non applica nulla e il giocatore in
    attesa su un dispositivo separato si sblocca **da solo** tramite il
    polling reale (una volta corretto il bug sopra); testo estraneo →
    messaggio "non ho capito", nessuna rottura; nodo senza libreria
    (`1848-milano`, prima del Passo 14) → campo nascosto con grazia dopo
    un 400, bottoni sempre funzionanti.
    **Vincolo tecnico scoperto**: `snowball-stemmers` (dipendenza npm
    aggiunta per lo stemming italiano) espone `newStemmer` in modo che
    Node sintetizza comunque un default export, ma esbuild (bundler di
    Wrangler) no — un `import snowball from "snowball-stemmers"` restava
    `undefined` **solo sotto Workers reali**, non sotto Node puro né nel
    bundling `--dry-run`. Scoperto solo grazie a un vero `wrangler dev`
    (non bastavano i test Node). Risolto con l'import nominale
    (`import { newStemmer } from "snowball-stemmers"`).

15. **`1848-milano`: "Carica diretta" a tiro reale + pool Cronista +
    librerie interprete (fatto nel Passo 14)**: la risposta "Carica
    diretta, sfruttando la Cadenza accumulata" (`milano-barricata`) è
    passata da effetto fisso a `competenzaRichiesta: "cadenza"`, stesso
    schema già usato per `1836-torino`. Aggiunto anche il pool Cronista
    per il nodo (`src/lib/narratore-1848-milano.md`/`.js`, registrato in
    `narratore-registro-pool.js`) e le librerie interprete per
    **entrambe** le richieste del nodo (`milano-barricata`,
    `milano-ferito`, 3 opzioni ciascuna — comprese le risposte rimaste a
    effetto fisso, che il testo libero copre comunque anche senza tiro).
    Verificato dal vivo: il Cronista compone testo variabile sul tiro
    (non più il testo statico), il testo libero funziona su tutte e 6 le
    opzioni, nessuna interferenza tra i registri di `1836-torino` e
    `1848-milano`.

16. **`1915-carso-piave`: "Uscite a recuperarlo sotto il fuoco" a tiro
    reale (fatto nel Passo 15)**: stessa conversione (`carso-bombardamento`
    → `competenzaRichiesta: "passoAvanti"`), ma **senza** pool Cronista né
    libreria interprete per questo nodo in questo passo — non richiesti.
    Il testo d'esito per tier resta quello scritto a mano in
    `game-config.js` (`effettiPerEsito`/`esito`), comportamento atteso e
    coerente con come funzionava già prima dell'esistenza del Cronista.

17. **Pool Cronista e librerie di testo libero completati per
    `1915-carso-piave` (fatto nel Passo 16)**: colmato il divario lasciato
    dal Passo 15. Pool sulla stessa identica struttura degli altri nodi
    (`src/lib/narratore-1915-carso-piave.md`/`.js`, registrato in
    `narratore-registro-pool.js`), contenuto fornito dall'utente. Librerie
    di testo libero su **entrambe** le richieste del nodo (`carso-attesa`,
    `carso-bombardamento`, 2 opzioni ciascuna — meno delle 3 degli altri
    nodi, perché qui ogni richiesta ha solo due risposte in totale), anche
    qui contenuto fornito dall'utente, registrate in
    `interprete-registro-librerie.js`. Verificato dal vivo con
    `wrangler dev`: testo libero con match automatico su entrambe le
    richieste, narrazione composta dal Cronista sul tiro reale di "Uscite
    a recuperarlo", esito del nodo coerente.

18. **`emergenza-civile`: "Restate a parlare, guadagnando la loro fiducia"
    a tiro reale (spiritoDiCorpo) + pool Cronista + librerie di testo
    libero (fatto nel Passo 17)**: stesso schema ormai consolidato —
    richiesta `emergenza-famiglia`, risposta convertita da effetto fisso a
    `competenzaRichiesta: "spiritoDiCorpo"` con `effettiPerEsito`/`esito`
    per tier; l'altra risposta della stessa richiesta ("Insistete con
    fermezza, portandoli via se serve") resta a effetto fisso. Pool
    Cronista (`src/lib/narratore-emergenza-civile.md`/`.js`) e librerie di
    testo libero su **entrambe** le richieste del nodo (`emergenza-scelta`,
    `emergenza-famiglia`), contenuto fornito dall'utente in entrambi i
    casi. Verificato dal vivo con `wrangler dev`, in due passaggi separati
    (prima solo il tiro con testo statico, poi — dopo aver aggiunto pool e
    librerie — la stessa risposta via testo libero con narrazione composta
    dal Cronista): dado variabile, tier coerente col totale, effetti
    corretti per tier, nessuna regressione sull'altra risposta né sulla
    richiesta `emergenza-scelta`.

19. **`missione-moderna`: "Ignorate la provocazione e restate calmi" a
    tiro reale (ancoraggio) + pool Cronista + librerie di testo libero
    (fatto nel Passo 18)**: stesso schema, ultimo dei 5 nodi a essere
    completato. Richiesta `moderna-provocazione`, risposta convertita a
    `competenzaRichiesta: "ancoraggio"` — la prima risposta reale del
    gioco a usare questa competenza (trasversale, di nessun ruolo
    principale: ogni ruolo parte da 1, come le competenze secondarie).
    L'altra risposta della stessa richiesta ("Rispondete con fermezza,
    mostrando autorità") resta a effetto fisso. Pool Cronista
    (`src/lib/narratore-missione-moderna.md`/`.js`) e librerie di testo
    libero su **entrambe** le richieste del nodo (`moderna-fiducia`,
    `moderna-provocazione`), contenuto fornito dall'utente. Verificato dal
    vivo con `wrangler dev`, stesso schema in due passaggi del punto 18:
    dado variabile (osservato anche un tiro minimo, competenza 1 + dado 1
    = totale 2, tier "fallimento" — coerente con le soglie), narrazione
    composta dal Cronista dopo l'aggiunta del pool, nessuna regressione.
    **Con questo, tutti e 5 i nodi temporali hanno almeno una risposta a
    tiro reale, un pool Cronista e librerie di testo libero collegate** —
    vedi "Punto di ripresa" in cima al file per lo stato completo nodo per
    nodo.

---

## Ipotesi in attesa di conferma (NON dare per deciso)

- **Margine**: ipotesi di lavoro implementata nel codice = traccia che misura
  quanto la squadra si allontana dal "binario" della missione; supera una soglia
  (`margineSoglia`, ora 5) e scatta una complicazione, poi si dimezza. **Non
  confermato dall'utente** — va verificato o corretto prima di scrivere altro
  contenuto che ne dipenda.
- **Codice del libro**: il README attuale dice accesso libero, nessun codice
  richiesto per giocare (diverso da Soglia). Non ancora discusso esplicitamente
  se resta così.
- **Chat di gruppo / chiamata vocale integrata**: presenti in Soglia, non ancora
  deciso se includerle in Corsa Invisibile.

---

## Cosa manca (prossimi passi possibili, da scegliere insieme)

- [x] Pool di frammenti narrativi veri per il Cronista — fatto nel Passo 5,
      ma **solo per il nodo `1836-torino`**; gli altri 4 nodi restano da fare
- [x] Contenuto del pool spostato da JS a file di testo (`.md` con tabelle) —
      fatto nel Passo 6, con caricatore compatibile Cloudflare Workers
- [x] Motore neutro del Cronista (`narratore-simulato.js`) — fatto nel Passo 4
- [x] Sistema di competenze personaggio — fatto nel Passo 3, numeri da confermare
- [x] `/scegli` sa chi sta scegliendo (`giocatoreId` obbligatorio e validato,
      tracciato in `storicoScelte`) — fatto nel Passo 7, isolato di proposito
- [x] Collegare le competenze al flusso dei nodi (`competenzaRichiesta` +
      `effettiPerEsito` + `esito` per tier) — fatto nel Passo 8, motore
      pronto ma **nessuna risposta reale nei 5 nodi lo usa ancora**
- [x] Scrivere almeno una risposta reale con tiro in un nodo esistente —
      fatto nel Passo 9 (`1836-torino` → `decalogo-ginnastica`, "A tutta
      velocità, senza calcolare i rischi"); **solo una, le altre risposte
      di quella richiesta e degli altri 4 nodi restano a effetto fisso**
- [x] Collegare il Cronista a `GameSession.js` per il nodo `1836-torino` —
      fatto nel Passo 10, tramite registro `nodoId → pool` generico
- [x] Pool di frammenti narrativi veri per `1848-milano` — fatto nel Passo 14
- [x] Pool di frammenti narrativi veri per gli altri 3 nodi (Carso/Piave,
      Emergenza civile, missione moderna) — fatto nei Passi 16-18; il
      registro (`src/lib/narratore-registro-pool.js`) ora copre tutti e 5
      i nodi, zero modifiche a `GameSession.js`
- [x] Interprete di testo libero collegato al gioco (nodo pilota
      `1836-torino`) — fatto nel Passo 13, esteso a `1848-milano` nel
      Passo 14 (librerie per tutte e 6 le risposte del nodo)
- [x] Interprete di testo libero per gli altri 3 nodi (Carso/Piave,
      Emergenza civile, missione moderna) — fatto nei Passi 16-18, librerie
      su tutte le richieste di tutti e 5 i nodi
- [ ] Tarare le soglie provvisorie dell'interprete (`sogliaAlta: 0.6`,
      `margineDistacco: 0.15` in `GameSession.js`) su testo libero reale
      scritto da persone vere, non solo su frasi di test scritte a mano
- [ ] Convertire altre risposte fisse a tiro reale — ogni nodo ne ha oggi
      solo una; tutti e 5 i nodi (`1836-torino`, `1848-milano`,
      `1915-carso-piave`, `emergenza-civile`, `missione-moderna`) hanno
      già pool e librerie pronti, quindi una nuova risposta a tiro in un
      nodo esistente può riusarli senza altro lavoro di contenuto
- [x] `public/index.html` non mandava `giocatoreId` a `/scegli` — corretto
      nel Passo 11, verificato dal vivo con `wrangler dev` + browser
- [x] Identità comandante (primo giocatore della stanza) + pannello nella
      schermata di gioco (margine, avvio/cambio nodo, note private) —
      fatto nel Passo 12
- [ ] Conferma o correzione della definizione di Margine
- [x] Un nodo scritto come esempio con ramificazione reale — fatto nel Passo 2
      (`decalogo-vaira-severo` in `1836-torino`)
- [ ] Collegare davvero l'AI alla generazione degli esiti (con il tetto per sessione)
- [ ] Decisione su codice del libro, chat, chiamata vocale
- [ ] Interfaccia di gioco (`public/`) — rimandata, si parte dal motore
- [ ] Home del libro su bersaglierisgv.org (checklist già nel README del progetto)
- [ ] Costruire davvero `/admin/genera-codici` e collegare `lib/access-codes.js`
      a `index.js` — il README diceva "fatto" ma la rotta non esiste nel
      codice; corretto in `README.md` il 10/07/2026, segnato qui per non
      perderlo di vista

---

## Changelog tecnico

**12/07/2026 — Passo 21: profilo giocatore persistente, Fase 1 di 4 (schema + registrazione/accesso)**
Nuovi file: `src/lib/profili-giocatore.js`, `test-profili-giocatore.mjs`.
File modificati: `schema.sql`, `src/index.js`, `DECISIONI_LA_CORSA_INVISIBILE.md`.
- Fase 1 di una funzionalità a 4 fasi: profilo giocatore che sopravvive tra
  stanze diverse (oggi ogni stanza è un Durable Object isolato, senza
  identità persistente). **Questa fase è solo schema dati +
  registrazione/accesso: nessun collegamento al gameplay esistente** —
  `GameSession.js`, `/join`, e tutto ciò che riguarda una singola stanza
  non sono stati toccati, come richiesto esplicitamente.
- **Verificato prima di scrivere schema**: esiste un solo D1 nel progetto
  (`la-corsa-invisibile-db`, binding `env.DB`), già usato per
  `access_codes`/`subscribers` — dati non legati a una singola stanza. Lo
  stato di una stanza vive nello storage del Durable Object `GameSession`
  (SQLite-backed, isolato), non in D1: non esisteva quindi "un D1 già
  esistente per lo stato delle stanze" da cui separarsi, come invece
  ipotizzato nella richiesta iniziale.
- Tre scelte di design non ovvie dal codice esistente, poste esplicitamente
  all'autore prima di implementare (**non decise unilateralmente**):
  1. **Dove va il nuovo D1**: nello stesso `la-corsa-invisibile-db` (nuova
     tabella), non in un database separato — confermato, coerente con la
     scoperta sopra, zero provisioning Cloudflare extra.
  2. **Come salvare il PIN**: hash con salt via PBKDF2-SHA256 (Web Crypto,
     `crypto.subtle`, nessuna dipendenza esterna, 100.000 iterazioni) —
     confermato, anche sapendo che un PIN a 6 cifre (1.000.000 di
     combinazioni) resta comunque forzabile offline se il DB trapela:
     l'hashing evita solo che il PIN sia leggibile a colpo d'occhio da chi
     legge il database (backup, bug, accesso non autorizzato), non è una
     protezione forte in assoluto.
  3. **Struttura di `bonusScelti`**: colonna `TEXT` con un array JSON
     serializzato, non una tabella relazionale separata — confermato, il
     sistema di bonus non è ancora progettato (dipende da un game design
     che arriva in una fase successiva a questa), una colonna flessibile
     evita di normalizzare uno schema che potrebbe cambiare del tutto.
- `schema.sql`: nuova tabella `giocatori_persistenti` (`id`, `nome UNIQUE`,
  `pin_hash`, `pin_salt`, `xp_totale` default 0, `bonus_scelti` default
  `'[]'`, `created_at`), stesso stile di `access_codes` (indice esplicito
  sulla colonna univoca, anche se ridondante con l'UNIQUE — per coerenza
  con la convenzione già in uso). **Non ancora applicata al D1 remoto o
  locale** (`npm run db:init`/`db:init:remote` non eseguiti in questa
  sessione — da fare prima che gli endpoint funzionino davvero contro un DB
  reale, non solo nei test).
- `src/lib/profili-giocatore.js`: modulo isolato, stesso pattern di
  `access-codes.js` (funzioni che ricevono `db` come primo argomento, query
  sempre parametrizzate). `validaNome`/`validaPin` esportate a parte
  (riusate sia da `registraGiocatore`/`accediGiocatore` sia dai test
  dedicati al formato). `registraGiocatore` restituisce errori SPECIFICI
  (`nome_troppo_corto`, `nome_troppo_lungo`, `pin_formato_non_valido`,
  `nome_gia_in_uso`) perché lì non c'è rischio di facilitare un accesso
  indebito; `accediGiocatore` restituisce SEMPRE lo stesso
  `credenziali_non_valide` qualunque sia la causa (nome inesistente, pin
  sbagliato, o perfino un formato non valido) — verificato esplicitamente
  nei test che i tre casi producano lo stesso codice, non distinguibile
  dall'esterno. Il profilo restituito (`rigaAProfilo`) esclude sempre
  `pin_hash`/`pin_salt`, mai esposti al client.
  - Nome minimo 3 caratteri (scelto nel range 2-3 proposto, non era un
    punto da discutere esplicitamente), massimo 30 (limite difensivo
    aggiunto di mia iniziativa, non richiesto — evita input abnormi
    sull'endpoint pubblico, segnalato qui per trasparenza).
- `src/index.js`: due nuovi endpoint, `POST /profilo/registra` (201 su
  successo, 409 se nome già in uso, 400 sugli altri errori di validazione)
  e `POST /profilo/accedi` (200 su successo, 401 su credenziali non
  valide). Messaggi in italiano mappati dal codice macchina in una piccola
  tabella locale a `index.js` (il modulo di dominio resta testabile senza
  sapere nulla di HTTP, stesso principio già seguito da `risoluzione.js`).
  Aggiunti PRIMA del proxy verso `/api/stanza/{roomId}/...`, senza toccare
  quel routing.
- `test-profili-giocatore.mjs` (32 verifiche, tutte passate): fake D1
  minimale in memoria (stesso spirito del fake storage usato per
  `GameSession`, ma per `db.prepare().bind().first()/.run()`), che
  riconosce le due sole forme di query emesse dal modulo. Copre: le 4
  richieste esplicite (registrazione riuscita, nome duplicato fallisce,
  login riuscito, login con pin/nome sbagliato fallisce) più validazione
  formato pin isolata, verifica che il profilo non esponga mai
  pin_hash/pin_salt, e verifica che due giocatori con lo stesso PIN si
  autentichino comunque in modo indipendente (salt per record).
- Rilanciata l'intera suite del repository (19 file) dopo la modifica:
  nessuna regressione. `index.js` verificato anche con un import diretto
  sotto Node puro (nessun test esistente lo importa direttamente).
- Non toccato, come richiesto: `GameSession.js`, `/join`, `game-config.js`,
  `public/index.html` — nessun collegamento al gameplay in questa fase.
- **Resta da fare (fasi successive, non ancora discusse)**: applicare
  `schema.sql` al D1 reale; collegare il profilo a `/join` (associare un
  giocatore di stanza a un profilo persistente); UI di
  registrazione/accesso in `public/`; usare `xpTotale`/`bonusScelti` nel
  gameplay una volta che il sistema di bonus sarà progettato.

**11/07/2026 — Passo 20: bilanciamento Esploratore (dado di ruolo + bonus condizionale)**
File modificati: `src/game-config.js`, `src/durable-objects/GameSession.js`,
`src/lib/risoluzione.js`, `test-risoluzione.mjs`, `test-scegli-risoluzione.mjs`,
`test-scegli-1836-torino.mjs`.
- Richiesta dall'autore: dado di Cadenza dell'Esploratore da 1d4 a 1d6 (Cadenza
  base resta 3, invariata) più un nuovo bonus condizionale (+1 a una
  competenza) per inseguimento/fuga/terreno non rivelato.
- **Scoperta prima di scrivere codice**: il dado non era mai stato "per
  classe" — `GAME_CONFIG.risoluzione.dadoFacce` è un unico valore globale
  usato da `tiraDado()`/`risolviAzione()` per qualunque ruolo/competenza.
  Non esisteva nessun bonus condizionale nel codice (cercato "bonus" in
  tutto `src/`, zero risultati) né nessuno stato di "contesto scena" in
  `GameSession` (initState/migrateState non tracciano nulla del genere).
  Due domande poste e risolte con l'utente prima di implementare (**non
  decise unilateralmente**, essendo scelte di design non ovvie dal codice):
  a chi si applica il dado 1d6 (risposta: solo Esploratore + competenza
  Cadenza, non "chiunque tiri con Cadenza" né "Esploratore su qualunque
  competenza") e come si applica il bonus (risposta: dichiarazione manuale
  per-risposta in `game-config.js`, non rilevamento automatico da uno stato
  di scena — zero campi nuovi in `initState()`/`migrateState()`).
- `src/lib/risoluzione.js`: `tiraDado(facce)` e `risolviAzione(competenza,
  dadoForzato, facce)` accettano ora un terzo parametro opzionale `facce`
  (default `GAME_CONFIG.risoluzione.dadoFacce`, backward compatible: le
  chiamate esistenti con 1 o 2 argomenti restano invariate).
- `src/game-config.js`: ruolo `esploratore` ha ora `dadoFacce: 6` (si
  applica in `GameSession.js` SOLO quando `competenzaRichiesta` della
  risposta coincide con la `competenzaPrincipale` del ruolo di chi sceglie
  — nessuna stringa "esploratore"/"cadenza" scritta in `GameSession.js`,
  rispettando la regola del muro). Documentato anche il nuovo pattern
  `bonusContesto: { competenza: "<id>", valore: <n> }`, utilizzabile su
  qualunque risposta con `competenzaRichiesta`: applicato SOLO quando
  `bonusContesto.competenza` coincide con `competenzaRichiesta` della
  stessa risposta. **Nessuna risposta esistente nei 5 nodi è stata taggata
  con questo campo** — non era ovvio quale risposta rappresenti
  narrativamente un inseguimento/fuga/terreno non rivelato, e non è stato
  deciso unilateralmente: resta un campo pronto all'uso, da applicare a
  mano quando si scriverà (o riscriverà) una risposta che lo giustifica.
- `src/durable-objects/GameSession.js` (`applicaRisposta`): `ruoloGiocatore`
  ora calcolato una sola volta (prima era ricalcolato più sotto per la
  narrazione del Cronista, tolta la duplicazione), usato sia per il
  bonusContesto (sommato al punteggio prima del tiro) sia per l'override
  del dado (passato come terzo argomento a `risolviAzione`).
- **Regressione pre-esistente trovata e corretta separatamente (Passo 19,
  vedi sotto)**: senza quel fix, `test-scegli-risoluzione.mjs` e
  `test-scegli-1836-torino.mjs` (che dovevo comunque modificare qui) non
  passavano nemmeno prima di questa modifica — bloccava la verifica.
- **Test aggiornati per evitare falsi negativi/test flaky introdotti dal
  cambio**: `test-scegli-risoluzione.mjs`, blocco "competenza mancante nel
  record del giocatore" — usava ruolo Esploratore su una risposta a
  competenza Cadenza; con 1d6 un dado di 5 o 6 avrebbe dato "parziale"
  invece del "fallimento" atteso (test flaky ~33% delle volte). Cambiato a
  ruolo "custode" (nessun `dadoFacce` di ruolo), comportamento del test
  invariato. `test-scegli-1836-torino.mjs`, blocco "con la competenza
  reale dell'Esploratore" (nodo REALE `1836-torino`, `decalogo-ginnastica`)
  — l'assunzione "mai pieno con Cadenza 3" (vera con 1d4, 3+4=7 sotto la
  soglia di 8) non è più vera con 1d6 (3+6=9): riscritto per verificare che
  tutti e tre i tier compaiano su 60 tentativi, con gli effetti/margine
  attesi per ciascuno (prima verificava solo parziale/fallimento).
- Test nuovi in `test-risoluzione.mjs`: range esatto del dado di ruolo
  forzando gli estremi (Cadenza 3 + 1d6 → 4-9; con bonus +1 → 5-10, come
  richiesto), verifica statistica che "pieno" compaia su 100 tentativi con
  Cadenza 3 reale, verifica che il comportamento di default (senza terzo
  argomento) resti sul vecchio range 4-7.
- Test nuovi in `test-scegli-risoluzione.mjs`: wiring end-to-end
  dell'override del dado (Esploratore vede "pieno" su 60 tentativi,
  Custode con la stessa competenza no — isola l'effetto del ruolo da
  quello della competenza), e del `bonusContesto` (chiamata singola e
  deterministica via `tiro.competenza` restituito da `/scegli`: con bonus
  dichiarato risulta 3+1=4, con bonus su una competenza diversa da
  `competenzaRichiesta` resta 3 — verifica che il mismatch venga ignorato,
  non silenziosamente applicato).
- Non toccato: nessuna risposta reale nei 5 nodi (il bonus resta
  infrastruttura non ancora usata, vedi sopra), `public/index.html` (il
  dettaglio del tiro mostrato è già generico — competenza/dado/totale/esito
  — non serve sapere quante facce ha il dado).

**11/07/2026 — Passo 19: corretti 4 test rimasti senza token dopo l'introduzione dell'auth**
File modificati: `test-scegli-risoluzione.mjs`, `test-scegli-1836-torino.mjs`,
`test-scegli-cronista.mjs`, `test-scegli-giocatore.mjs`.
- **Regressione pre-esistente scoperta per caso**, non richiesta: verificando
  con `git stash` che il fallimento di `test-scegli-risoluzione.mjs` non fosse
  causato dal lavoro del Passo 20, si è trovato che falliva già su `main`
  (HEAD `2015797`, prima di qualunque modifica di questa sessione). Causa:
  le commit precedenti (token di sessione, rimozione della corsa al
  comandante, cessione volontaria — non loggate qui, vedi nota in cima al
  file) hanno reso `/avvia-nodo` e `/scegli` riservati (richiedono
  `giocatoreId`+`token`, vedi `autenticaComandante()`/`autenticaGiocatore()`
  in `GameSession.js`), ma 4 file di test non erano mai stati aggiornati e
  chiamavano ancora quegli endpoint senza credenziali — ogni chiamata
  prendeva 400 e il test crashava al primo assert su `json` (null perché la
  risposta non era JSON).
- Segnalato esplicitamente all'utente prima di agire (non deciso
  unilateralmente), con scelta tra sistemare tutti e 4 subito, solo i 2
  necessari per il Passo 20, o niente. Confermato: sistemarli tutti e 4,
  in un commit separato dal bilanciamento Esploratore.
- Fix identico nei 4 file: aggiunto un helper `joinComandante()` (stesso
  pattern già in uso in `test-game-session.mjs`) che fa `/crea` +
  `/join` con un `tokenCreazione`, cosi' il giocatore risultante e'
  davvero comandante; `giocatoreId`+`token` passati a ogni chiamata
  `/avvia-nodo` e `/scegli`. `test-scegli-giocatore.mjs` ha richiesto due
  aggiustamenti in più, specifici alla natura dei suoi test (verificano
  proprio gli errori di autenticazione): il test "giocatoreId mancante"
  aggiornato per il nuovo testo del messaggio ("giocatoreId o token
  mancante", non più solo "giocatoreId mancante"), e il test "giocatoreId
  sconosciuto" ora passa un token qualsiasi (altrimenti l'errore "token
  mancante" scatterebbe prima di quello "sconosciuto" che il test vuole
  verificare).
- Nessun cambio di comportamento o di asserzioni sul merito: stesso identico
  contenuto testato di prima, solo il plumbing di autenticazione.
- Verificato con `git stash`: applicato il fix da solo (senza le modifiche
  del Passo 20) contro il codice invariato su `main`, tutti e 4 i file
  passano con le stesse asserzioni originali. Poi riapplicato sopra il
  lavoro del Passo 20 (che tocca due di questi stessi file per il
  bilanciamento) e ri-verificato: tutti i 18 file di test del repository
  passano.
- Commit locale creato separatamente da quello del Passo 20 (non pushato,
  in attesa di conferma esplicita per il push, come da metodo di lavoro).

**11/07/2026 — Passo 18: `missione-moderna` — tiro reale (ancoraggio) + pool Cronista + librerie interprete**
Nuovi file: `src/lib/narratore-missione-moderna.md`, `src/lib/narratore-missione-moderna.js`,
`src/lib/interprete-libero/missione-moderna/` (moderna-fiducia.md/.js,
moderna-provocazione.md/.js), `test-narratore-missione-moderna.mjs`,
`test-interprete-libero-missione-moderna.mjs`.
File modificati: `src/game-config.js`, `src/lib/narratore-registro-pool.js`,
`src/lib/interprete-registro-librerie.js`.
- `moderna-provocazione` → risposta "Ignorate la provocazione e restate
  calmi": da effetto fisso a `competenzaRichiesta: "ancoraggio"`, stesso
  schema degli altri nodi — prima risposta reale del gioco a usare questa
  competenza (trasversale, di nessun ruolo principale). L'altra risposta
  della stessa richiesta ("Rispondete con fermezza, mostrando autorità")
  non toccata, resta a effetto fisso.
- Pool Cronista per il nodo e librerie interprete per **entrambe** le
  richieste (`moderna-fiducia`, `moderna-provocazione`), contenuto
  fornito dall'utente, stesso schema esatto di `emergenza-civile`. Nuovi
  test dedicati per entrambi, tutti passati.
- Prima del commit, verifica dal vivo con `wrangler dev` in due fasi
  separate: (1) solo la conversione a tiro reale, tier "fallimento"
  osservato con competenza 1 + dado 1 = totale 2, testo statico da
  `game-config.js` confermato esplicitamente (nessun pool ancora
  presente); (2) dopo l'aggiunta di pool e librerie, la stessa richiesta
  risolta via testo libero produce narrazione composta dal Cronista (non
  più il testo statico), testo libero verificato su tutte e 4 le opzioni
  del nodo, nessuna regressione su "Rispondete con fermezza" (resta a
  effetto fisso senza Cronista) né sulla richiesta `moderna-fiducia`.
- **Con questo, tutti e 5 i nodi temporali hanno almeno una risposta a
  tiro reale, un pool Cronista e librerie di testo libero collegate.**
- Commit `a4131fe`.

**11/07/2026 — Passo 17: `emergenza-civile` — tiro reale (spiritoDiCorpo) + pool Cronista + librerie interprete**
Nuovi file: `src/lib/narratore-emergenza-civile.md`, `src/lib/narratore-emergenza-civile.js`,
`src/lib/interprete-libero/emergenza-civile/` (emergenza-scelta.md/.js,
emergenza-famiglia.md/.js), `test-narratore-emergenza-civile.mjs`,
`test-interprete-libero-emergenza-civile.mjs`.
File modificati: `src/game-config.js`, `src/lib/narratore-registro-pool.js`,
`src/lib/interprete-registro-librerie.js`.
- `emergenza-famiglia` → risposta "Restate a parlare, guadagnando la loro
  fiducia": da effetto fisso a `competenzaRichiesta: "spiritoDiCorpo"`,
  stesso schema degli altri nodi. L'altra risposta della stessa richiesta
  ("Insistete con fermezza, portandoli via se serve") non toccata, resta
  a effetto fisso.
- Pool Cronista per il nodo e librerie interprete per **entrambe** le
  richieste (`emergenza-scelta`, `emergenza-famiglia`), contenuto fornito
  dall'utente, stesso schema esatto di `1915-carso-piave`. Nuovi test
  dedicati per entrambi, tutti passati.
- Prima del commit, verifica dal vivo con `wrangler dev` in due fasi
  separate, come da metodo ormai consolidato: (1) solo la conversione a
  tiro reale, testo statico da `game-config.js` confermato esplicitamente
  (nessun pool ancora presente in quella fase); (2) dopo l'aggiunta di
  pool e librerie, la stessa richiesta risolta via testo libero produce
  narrazione composta dal Cronista, testo libero verificato su tutte e 4
  le opzioni del nodo, nessuna regressione su "Insistete con fermezza"
  (resta a effetto fisso senza Cronista) né sulla richiesta
  `emergenza-scelta`.
- Commit `89b5581`.

**11/07/2026 — Passo 16: `1915-carso-piave` — pool Cronista + librerie interprete (completamento)**
Nuovi file: `src/lib/narratore-1915-carso-piave.md`, `src/lib/narratore-1915-carso-piave.js`,
`src/lib/interprete-libero/1915-carso-piave/` (carso-attesa.md/.js,
carso-bombardamento.md/.js), `test-narratore-1915-carso-piave.mjs`,
`test-interprete-libero-1915-carso-piave.mjs`.
File modificati: `src/lib/narratore-registro-pool.js`,
`src/lib/interprete-registro-librerie.js`.
- Colma il divario lasciato dal Passo 15: quel passo aveva convertito
  `carso-bombardamento` a tiro reale ma esplicitamente senza pool né
  libreria. Qui aggiunti entrambi, stesso schema di `1848-milano` —
  pool sul tiro reale esistente, librerie su **entrambe** le richieste
  del nodo (`carso-attesa`, `carso-bombardamento`, 2 opzioni ciascuna,
  contenuto fornito dall'utente). Nessuna modifica a `game-config.js` in
  questo passo (il tiro reale esisteva già).
- Un test di frase estranea per `carso-attesa` è stato scoperto ambiguo
  in fase di scrittura (la frase inizialmente scelta condivideva una
  radice con un sinonimo di "aspettare" nel pool di questo nodo,
  producendo un match debole invece di nessuna corrispondenza) —
  verificato con uno script ad-hoc prima di correggere la frase di test,
  non un problema del motore.
- Verificato dal vivo con `wrangler dev`: testo libero con match
  automatico su entrambe le richieste, narrazione composta dal Cronista
  sul tiro reale di "Uscite a recuperarlo", esito del nodo coerente.
- Commit `ee2a1b4`.

**11/07/2026 — Passo 15: `1915-carso-piave` — "Uscite a recuperarlo" a tiro reale**
File modificati: `src/game-config.js`.
- `carso-bombardamento` → risposta "Uscite a recuperarlo sotto il fuoco":
  da `effetti`/`esito` fissi a `competenzaRichiesta: "passoAvanti"`,
  `effettiPerEsito`/`esito` per tier (pieno/parziale/fallimento), stesso
  schema del Passo 9 (`1836-torino`) e del Passo 14 (`1848-milano`).
- **Nessun pool Cronista né libreria interprete** aggiunti per questo nodo
  in questo passo (non richiesti): il testo d'esito per tier resta quello
  scritto a mano in `game-config.js`.
- L'altra risposta della stessa richiesta ("Aspettate una pausa nel
  fuoco") non toccata, resta a effetto fisso.
- Verificato dal vivo con `wrangler dev`: dado variabile (1-4) su più
  tentativi, tier corretto applicato con effetti/testo coerenti,
  `competenzaId: "passoAvanti"` restituito, nessuna regressione
  sull'altra risposta della stessa richiesta.
- Commit `18a9293`.

**11/07/2026 — Passo 14: `1848-milano` — tiro reale + pool Cronista + librerie interprete**
Nuovi file: `src/lib/narratore-1848-milano.md`, `src/lib/narratore-1848-milano.js`,
`src/lib/interprete-libero/1848-milano/` (milano-barricata.md/.js,
milano-ferito.md/.js), `test-narratore-1848-milano.mjs`,
`test-interprete-libero-1848-milano.mjs`.
File modificati: `src/game-config.js`, `src/lib/narratore-registro-pool.js`,
`src/lib/interprete-registro-librerie.js`.
- `milano-barricata` → risposta "Carica diretta, sfruttando la Cadenza
  accumulata": da effetto fisso a `competenzaRichiesta: "cadenza"`, stesso
  schema di `1836-torino`.
- Pool Cronista per il nodo, contenuto fornito dall'utente, stessa
  struttura esatta (3 slot apertura/sviluppo/eco, stesse sottotabelle
  baseline/per-ruolo/per-competenza/per-fascia-margine) di
  `narratore-corsa-invisibile.md` — registrato in
  `narratore-registro-pool.js` (`"1848-milano": () =>
  import("./narratore-1848-milano.js")`), voce di `1836-torino` non toccata.
- Librerie interprete per **entrambe** le richieste del nodo
  (`milano-barricata`, `milano-ferito`), 3 opzioni ciascuna, contenuto
  fornito dall'utente, registrate in `interprete-registro-librerie.js` —
  coprono anche le 5 risposte rimaste a effetto fisso: il testo libero
  funziona indipendentemente dal tiro.
- Nuovi test dedicati per entrambi (pool e librerie), stesso schema dei
  test equivalenti per `1836-torino`, adattati ai conteggi reali del
  contenuto di questo nodo (es. 8 frammenti eco invece di 9, 2 varianti
  "critico" invece di 3).
- **Verificato dal vivo**: il Cronista compone testo variabile sul tiro di
  "Carica diretta" (4 tentativi, tutti diversi); testo libero verificato
  su tutte e 6 le opzioni (frase chiara → automatica per ciascuna, frase
  estranea → nessuna_corrispondenza); nessuna regressione su
  `1836-torino` (registri di pool e librerie isolati correttamente per
  nodo/richiesta).
- Commit `83b11c0`.

**11/07/2026 — Passo 13: interprete di testo libero collegato al gioco (nodo pilota `1836-torino`)**
Nuovi file: `src/lib/interprete-libero/` (normalizza.js, stopword.js,
libreria.js, punteggio.js, interprete.js — copiati da
`simulatore-interprete`, convertiti in ESM; più `1836-torino/` con le 3
librerie del nodo pilota e i relativi wrapper `.js`; più
`libreria-prova/opzioni-test.md`), `src/lib/interprete-registro-librerie.js`,
`test-interprete-libero.mjs`, `test-interpreta.mjs`.
File modificati: `package.json`/`package-lock.json` (dipendenza
`snowball-stemmers`), `src/durable-objects/GameSession.js`,
`public/index.html`.
- Architettura decisa esplicitamente con l'utente prima di scrivere
  codice (vedi punto 14 in "Decisioni confermate" per il dettaglio
  completo): il testo libero si affianca ai bottoni, matching lato
  server, motore come file locali (non dipendenza npm), librerie `.md`
  per richiesta con registro dedicato, richieste ambigue restano
  pendenti nello stato della stanza per la risoluzione cross-device.
- `GameSession.js`: logica di "applicare una risposta" estratta da
  `/scegli` in `applicaRisposta(session, richiestaAttiva, risposta,
  giocatoreId)`, riusata da `/scegli`, `/interpreta` (esito automatico) e
  `/risolvi-interpretazione` — zero duplicazione. Nuovo campo di stato
  `session.interpretazionePendente` (default `null`, migrato in
  `initState()`/`migrateState()`). Nuovo `POST /interpreta`
  (`testoLibero`, `richiestaId`, `giocatoreId` → `automatica` applica
  subito, `manuale` salva il pendente per il comandante, `nessuna_corrispondenza`
  nessuna modifica di stato). Nuovo `POST /risolvi-interpretazione`
  (comandante applica un candidato o annulla).
- Soglie di decisione (`sogliaAlta: 0.6`, `margineDistacco: 0.15`)
  esplicitamente commentate come provvisorie nel codice.
- **Bug preesistente scoperto e corretto durante la verifica dal vivo**
  (non introdotto in questo passo): `avviaPolling()` e
  `aggiornaSchermataGioco()` in `public/index.html` destrutturavano
  `{ session }` da `GET /state`, che restituisce invece la sessione
  senza involucro — `session` era sempre `undefined`, ogni tick del
  polling falliva in silenzio (`catch(e){}` vuoto). Il polling non ha
  **mai** aggiornato risorse/giocatori/pannello comandante in tempo
  reale per nessun giocatore, in nessuna sessione precedente a questa
  correzione. Corretto in entrambi i punti.
- `public/index.html`: campo testo libero + bottone "Invia" accanto ai
  bottoni delle risposte (renderizzato sempre, disabilitato con grazia
  su 400 se la richiesta non ha una libreria), gestione dei tre esiti di
  `/interpreta`, sezione nel pannello comandante per risolvere
  un'interpretazione pendente (candidati con punteggio, o annulla),
  polling esteso per sbloccare automaticamente il giocatore in attesa.
- **Vincolo tecnico scoperto**: `snowball-stemmers` — import di default
  funzionante sotto Node ma `undefined` sotto Workers reali (esbuild non
  sintetizza il default in questo caso), scoperto solo con `wrangler dev`
  vero (non con i test Node né col bundling `--dry-run`). Risolto con
  l'import nominale.
- **Verificato dal vivo** con `wrangler dev` e due tab browser separate
  (localStorage isolato per due dispositivi): tutti e 4 gli scenari
  richiesti (testo chiaro, testo ambiguo con risoluzione/annullo
  cross-device, testo estraneo, nodo senza libreria) confermati, incluso
  lo sblocco automatico via polling una volta corretto il bug sopra.
- Commit `ba4cb83`.

**10/07/2026 — Passo 12: identità comandante + pannello comandante**
Nuovo file: nessuno.
File modificati: `src/durable-objects/GameSession.js`, `test-game-session.mjs`,
`public/index.html`.
- Il comandante/narratore è chi crea la stanza, gioca anche lui con uno dei
  4 ruoli, ma non è un ruolo separato nella lista ruoli: è un giocatore
  normale con un flag `comandante` in più. Identità: il primo giocatore che
  fa `/join` in una stanza appena creata diventa comandante. Nessun nuovo
  endpoint per una "richiesta attiva specifica": il comandante sceglie il
  NODO da avviare (`/avvia-nodo`, già esistente), il resto procede via
  `/scegli` come già implementato — **non toccato**. Esito del tiro sempre
  quello di `risolviAzione()`, mai sovrascrivibile manualmente.
- `GameSession.js` — `/join`: `comandante: session.giocatori.length === 0`
  su ogni nuovo giocatore. `/risorse`: estesa per accettare `risorsa:
  "margine"` come chiave speciale (stesso pattern delta delle risorse di
  squadra) invece di un endpoint `/margine` dedicato — scelta motivata
  dal fatto che `/scegli` già tratta "margine" come pseudo-risorsa nello
  stesso modo, nel ciclo di applicazione degli effetti. Nessuna modifica a
  `initState()`/`migrateState()`: `comandante` è un campo per-giocatore,
  non di sessione, stesso trattamento di `competenze`. Nessun controllo di
  autorizzazione lato server aggiunto a nessun endpoint: il vincolo "solo
  il comandante" resta interamente lato client, coerente col resto
  dell'API (nessuna infrastruttura di sessione/token nel Worker).
- `test-game-session.mjs`: 5 nuove verifiche nei blocchi `/join` e
  `/risorse` già esistenti (primo giocatore comandante, secondo no,
  margine sale/scende con `/risorse`) — nessun file di test dedicato
  separato, estensione naturale di copertura già presente.
- `public/index.html`: `STATO.comandante`, salvato dalla risposta di
  `/join` e persistito con `salvaStato()`/`caricaStato()` come gli altri
  campi. Nuovo pannello (`renderPannelloComandante`), visibile solo se
  `STATO.comandante === true`: margine con soglia (lettura), select +
  bottone per avviare/cambiare nodo (scrittura via `/avvia-nodo`),
  variazione manuale del margine (scrittura via `/risorse`), note libere
  **solo in `localStorage`**, mai inviate al server. Nodo/richiesta attiva
  e risorse di squadra/elenco giocatori NON duplicati nel pannello: già
  visibili a tutti nell'area principale e nei box esistenti. Stile con le
  variabili CSS già definite in `:root`, nessuna immagine nuova integrata
  (resta un passo visivo separato, come deciso).
- **Verificato dal vivo**, non solo mentalmente: `wrangler dev` + browser,
  due tab con `localStorage` svuotato separatamente per simulare due
  dispositivi (le tab dello stesso browser condividono lo stesso
  `localStorage`, una singola nuova tab non basta a simulare un secondo
  giocatore). Primo giocatore → comandante, pannello visibile con tutte le
  sezioni, margine cambiato da 0 a 3 tramite il pannello, nodo avviato dal
  pannello e riflesso nell'area principale, note scritte senza generare
  alcuna richiesta di rete (verificato sull'elenco delle richieste).
  Secondo giocatore (storage pulito, `/join` reale, non la stessa
  identità) → `comandante: false`, pannello assente, resto della
  schermata di gioco invariato e corretto.
- Non toccato: il flusso di `/scegli`, la logica di risoluzione esistente,
  gli altri 4 nodi, login/progressione tra stanze.

**10/07/2026 — Passo 11: corretto il bug del `giocatoreId` mancante in `public/index.html`**
File modificati: `public/index.html`.
- Il client scartava la risposta di `POST /join` (`await chiamaAPI(...)`
  senza catturarne il risultato), quindi non salvava mai il `giocatoreId`
  che il server genera e restituisce — di conseguenza `POST /scegli` non
  lo includeva mai nel body, e ogni scelta fatta dall'interfaccia reale
  prendeva 400 fin dal Passo 7 (quando `giocatoreId` è diventato
  obbligatorio).
- Corretto in tre punti: (1) `STATO` iniziale ora ha anche il campo
  `giocatoreId: null`; (2) il gestore del click su "Unisciti alla
  squadra" cattura la risposta di `/join` (l'intera sessione) e salva
  `session.giocatori[session.giocatori.length - 1].id` in
  `STATO.giocatoreId` — l'ultimo dell'array è sempre il giocatore appena
  aggiunto, perché un Durable Object serializza le richieste (nessuna
  corsa possibile con altri join concorrenti); (3) il gestore del click
  su una risposta include `giocatoreId: STATO.giocatoreId` nel body di
  `/scegli`. `STATO` è già persistito in `localStorage`
  (`salvaStato()`/`caricaStato()`), quindi il `giocatoreId` sopravvive
  anche a un refresh della pagina, senza altro lavoro.
- **Verificato dal vivo**, su richiesta esplicita, non solo mentalmente:
  creato `.claude/launch.json` (non versionato, come `.claude/`
  in generale) per avviare `wrangler dev` con lo strumento di preview
  del browser. Flusso reale: creata una stanza, join di un Esploratore,
  avviato il nodo `1836-torino`, scelta "A tutta velocità, senza
  calcolare i rischi". Nessuna richiesta fallita (verificato con l'elenco
  delle richieste di rete): il 400 è sparito. `STATO.giocatoreId` presente
  in `localStorage` subito dopo il join. Il tier uscito al primo
  tentativo è stato "parziale" (Cadenza +2, Spirito di Corpo -1 nella UI),
  con il testo del Cronista mostrato (non quello statico per quel tier).
  Ripetuto in una stanza nuova: uscito "fallimento" (Cadenza +1, Spirito
  di Corpo -2), di nuovo con testo del Cronista, diverso da quello
  statico. "Pieno" non è mai comparso in questi tentativi: con la Cadenza
  base dell'Esploratore (3, nessun punto extra) è matematicamente
  irraggiungibile (3 + dado massimo 4 = 7, sotto la soglia di 8) — non un
  problema del fix, coerente con quanto i test automatici (Passo 9)
  avevano già stabilito per questo ruolo/competenza.
- Nessun test automatico dedicato per `public/index.html` (il progetto non
  ha un framework di test per il client) — verifica end-to-end manuale via
  browser, come da metodo del progetto quando non esiste un test dedicato.
- Non toccato: backend (nessuna modifica a `GameSession.js` o
  `game-config.js` in questo passo), gli altri 4 nodi, login/progressione
  tra stanze.

**10/07/2026 — Passo 10: il Cronista collegato al flusso di `/scegli`**
Nuovi file: `src/lib/narratore-registro-pool.js`, `test-scegli-cronista.mjs`.
File modificati: `src/durable-objects/GameSession.js`, `src/game-config.js`.
- Quattro domande poste e risolte con l'utente prima di scrivere codice
  (vedi punto 11 in "Decisioni confermate" per il dettaglio): quando si
  attiva (solo risposte con tiro), come proteggersi dai nodi senza pool
  (registro esplicito `nodoId → pool`, non un controllo hardcoded), se
  sostituisce o affianca il testo statico (sostituisce), se tracciare
  `storicoFrammenti` in sessione (no, resta sempre `[]`, annotato come nota
  per il futuro).
- Nuovo `src/lib/narratore-registro-pool.js`: mappa `nodoId → pool`
  (oggi una sola voce, `1836-torino`), consultata da `GameSession.js` senza
  che il motore contenga mai una stringa di nodo. Il caricamento di un pool
  reale usa `import()` dinamico dentro un `try/catch` **scoped al solo
  caricamento del modulo**: se il `.md` non è risolvibile nell'ambiente
  corrente (Node puro, senza Wrangler — il caso di tutti i test locali),
  `trovaPoolPerNodo` restituisce `null` e `GameSession.js` ricade sul testo
  statico, stesso trattamento riservato ai nodi senza pool.
- **Verificato esplicitamente su richiesta dell'utente**: quel `try/catch`
  non avvolge la composizione del testo (`componiNarrazione`, chiamata
  fuori da `trovaPoolPerNodo`, dentro `GameSession.js` senza protezione) —
  un errore vero dentro il motore o un pool mal scritto (frammenti mancanti
  per uno slot, bug di sintassi) si propaga sempre come eccezione non
  gestita, non finisce mai nel fallback silenzioso. Confermato leggendo il
  codice riga per riga con l'utente, nessuna modifica necessaria.
- `GameSession.js`: dentro il ramo "risposta con tiro" di `/scegli`, dopo
  aver applicato gli effetti, cerca il pool del nodo attivo nel registro;
  se disponibile, chiama `componiNarrazione()` con il contesto (esito del
  tiro, competenza, ruolo del giocatore, margine e la sua variazione,
  `storicoFrammenti: []`) e il testo composto sostituisce `testoEsito`.
- `src/game-config.js`: aggiunto `nomeConArticolo` a ogni ruolo (es.
  "L'Esploratore", "Il Fanfarista"; "Il Custode" per "Custode /
  Soccorritore" — il doppio nome non si legge bene a metà frase), passato
  come `variabili.ruolo` al Cronista. Scoperto mostrando esempi reali in
  chat: senza, i frammenti che iniziano con `{ruolo}` producevano testo
  scorretto ("Fanfarista scandisce" invece di "Il Fanfarista scandisce").
- Nuovo `test-scegli-cronista.mjs` (15 verifiche, tutte passate): il
  registro restituisce `null` per un nodo senza pool e per il caricatore
  reale sotto Node puro (senza override); `/scegli` usa il testo statico
  quando il pool non è disponibile; con un pool iniettato tramite
  `registraPool()` (costruito in modo portabile, `.md` letto da `fs` come
  negli altri test, non tramite l'import Wrangler-only) `/scegli` usa
  davvero il testo del Cronista, senza toccare effetti meccanici o
  ramificazione; le risposte senza tiro non vengono mai toccate, anche col
  pool registrato.
- **Verificato concretamente** (non solo a lettura di codice) con
  `wrangler deploy --dry-run` sul vero entry-point del Worker
  (`src/index.js`, non un entry-point di prova come nel Passo 6, perché
  ora `GameSession.js` raggiunge davvero `narratore-corsa-invisibile.js`):
  il bundle di produzione include correttamente sia il `.md` sia il
  registro.
- Esempi reali mostrati in chat due volte (prima direttamente dal motore,
  poi attraverso il vero flusso di `/scegli`) prima del commit, su
  richiesta esplicita dell'utente.
- **Non toccato**: gli altri 4 nodi (nessun pool, nessuna risposta con
  tiro), login/progressione tra stanze, `public/index.html` (bug noto del
  `giocatoreId` mancante, ancora aperto).

**10/07/2026 — Passo 9: prima risposta reale con tiro (`1836-torino`)**
Nuovo file: `test-scegli-1836-torino.mjs`.
File modificati: `src/game-config.js`, `test-game-session.mjs`.
- Convertita la prima risposta di `decalogo-ginnastica` nel nodo
  `1836-torino` ("A tutta velocità, senza calcolare i rischi") da effetto
  fisso (`effetti`, `esito` stringa) a risposta con tiro
  (`competenzaRichiesta: "cadenza"`, `effettiPerEsito`, `esito` per tier).
  Tier "parziale" ancorato deliberatamente agli stessi numeri e allo stesso
  testo che questa risposta aveva prima (cadenza +2, spiritoDiCorpo -1,
  margine +2 — gli stessi valori documentati nel Passo 2 come "prima prova
  pratica dell'ipotesi sul Margine"): continuità con quanto già giocato,
  non un ripensamento del bilanciamento. Tier "pieno" migliore (cadenza +3,
  margine +1, nessun costo su spiritoDiCorpo — corsa controllata anche a
  tutta velocità), tier "fallimento" peggiore (cadenza +1, spiritoDiCorpo
  -2, margine +3 — un passo falso), coerenti con la scena (corsa a
  ostacoli nella nebbia) e con l'aggancio narrativo già scritto nella
  richiesta successiva ("la fretta senza controllo vi ha quasi fatto
  cadere"). La ramificazione verso `decalogo-vaira-severo` non è stata
  toccata: resta legata alla scelta (la fretta), non al tiro — vale per
  ogni esito, incluso il fallimento.
- Le altre due risposte di `decalogo-ginnastica` ("con metodo",
  "aiutando chi fatica di più") NON sono state toccate: restano a effetto
  fisso, verificato esplicitamente che coesistano nella stessa richiesta
  con quella a tiro.
- `test-game-session.mjs` aggiornato: i due blocchi che chiamavano questa
  risposta con un effetto fisso presunto ("Ramificazione" e "Soglia del
  margine") ora forzano il punteggio di Cadenza a un valore estremo
  (tramite una nuova funzione helper `impostaCompetenza`, che scrive
  direttamente nello storage — il dado non è forzabile dall'API pubblica,
  giustamente) per rendere il tier deterministico, e le asserzioni sui
  numeri sono state aggiornate di conseguenza. Comportamento verificato
  restare lo stesso nel merito (branching, avanzamento dell'orologio,
  soglia del margine), solo i valori attesi sono cambiati per riflettere
  il tier forzato invece dell'ex-effetto fisso.
- Nuovo `test-scegli-1836-torino.mjs` (22 verifiche, tutte passate),
  dedicato al comportamento end-to-end su questo nodo REALE (non sul nodo
  di prova sintetico di `test-scegli-risoluzione.mjs`, che resta la
  copertura generica del collegamento tiro↔motore): tier pieno e
  fallimento forzati con i numeri/testi veri di game-config.js, il tiro
  con la competenza REALE assegnata dal ruolo Esploratore (Cadenza 3, mai
  "pieno" con quel punteggio — verificato su 30 tentativi che compaiano
  sia "parziale" sia "fallimento"), coesistenza con le altre due risposte
  della stessa richiesta, e il percorso di gioco completo dalla risposta
  con tiro alla chiusura del nodo passando per il ramo severo.
- **Non toccato**: gli altri 4 nodi (nessuna loro risposta ha un tiro), il
  collegamento del Cronista a `GameSession.js` (ora sbloccato per
  `1836-torino`, ma non ancora fatto), login/progressione tra stanze.

**10/07/2026 — Passo 8: `risoluzione.js` collegato al flusso di `/scegli`**
Nuovo file: `test-scegli-risoluzione.mjs`.
File modificati: `src/durable-objects/GameSession.js`, `test-game-session.mjs`.
- Tre domande poste e risolte con l'utente prima di scrivere codice (vedi
  punto 9 in "Decisioni confermate" per il dettaglio): il campo che
  dichiara il tiro (`competenzaRichiesta`), la coesistenza con le risposte
  a effetto fisso (sì, nello stesso nodo, nessuna risposta esistente
  convertita), e cosa succede al campo `esito` (diventa un oggetto per
  tier `{ pieno, parziale, fallimento }` invece di una stringa fissa, solo
  per le risposte con tiro — il client continua a vedere sempre un testo,
  zero modifiche a `public/index.html` necessarie per questo).
- Effetti anch'essi differenziati per tier (`effettiPerEsito`), non un
  blocco `effetti` fisso: scelta legata alla decisione già presa ("le
  competenze pesano molto di più nel determinare gli esiti") — un tiro che
  non cambia i numeri sarebbe stato solo cosmetico.
- **Dipendenza scoperta e risolta durante l'analisi, prima di scrivere il
  codice del tiro**: `/join` assegnava sempre `competenze: {}`,
  `creaCompetenzeIniziali()` di `risoluzione.js` non veniva mai chiamato da
  nessuna parte. Un tiro senza punteggio reale non avrebbe avuto senso.
  Corretto: `/join` ora chiama `creaCompetenzeIniziali(ruolo, {})` (nessun
  punto extra — quella distribuzione libera resta un passo a parte); un
  ruolo sconosciuto ora risponde 400 invece di essere accettato in
  silenzio con `competenze: {}` (comportamento precedente, mai notato
  perché mai testato esplicitamente).
- `POST /scegli`: quando la risposta scelta ha `competenzaRichiesta`, legge
  il punteggio da `giocatore.competenze[...]` (mancante → trattato come 0,
  non crasha), chiama `risolviAzione()`, e usa l'esito del tiro per
  scegliere `effettiPerEsito[tier]` (mancante → fallback a `{}`) ed
  `esito[tier]` (mancante → `null`). La risposta di `/scegli` include ora
  anche `tiro` (competenza, dado, totale, esito — `null` quando la
  risposta non richiede un tiro), e `storicoScelte` lo registra per voce.
- `test-game-session.mjs`: aggiornata l'unica asserzione che dipendeva dal
  vecchio comportamento (competenze vuote a `/join`), aggiunto un test per
  il 400 su ruolo sconosciuto.
- Nuovo `test-scegli-risoluzione.mjs` (15 verifiche, tutte passate),
  dedicato e isolato: un nodo di prova aggiunto a runtime a
  `GAME_CONFIG.nodiTemporali` (nessuna modifica al contenuto narrativo
  reale) con una risposta a tiro e una a effetto fisso nello stesso nodo;
  punteggi estremi per forzare deterministicamente fallimento/pieno (il
  dado non è forzabile dall'API pubblica, giustamente); 40 tentativi con
  un punteggio a cavallo tra parziale e pieno per verificare la coerenza
  interna (effetti ed esito testuale sempre coerenti con il tier estratto,
  qualunque esso sia) invece di provare a indovinare il tiro esatto; due
  test di robustezza (contenuto malformato, competenza mancante nel
  record di un giocatore).
- **Scoperta durante l'analisi, non ancora corretta**: `public/index.html`
  non manda `giocatoreId` a `/scegli` (né lo salva dopo `/join`) — ogni
  scelta dall'interfaccia reale prende 400 dopo il Passo 7. Segnata
  esplicitamente in "Cosa manca", non risolta qui (fuori scope, questo
  passo era solo il motore).
- Non toccato: il Cronista — nessuna risposta reale nei nodi genera ancora
  un `esito` che il pool possa consumare (serve scrivere risposte con tiro
  vere, non solo quelle di test), login/progressione tra stanze.

**10/07/2026 — Passo 7: `/scegli` traccia chi sta scegliendo**
Nuovo file: `test-scegli-giocatore.mjs`.
File modificati: `src/durable-objects/GameSession.js`, `test-game-session.mjs`.
- Passo isolato di proposito, richiesto esplicitamente prima di collegare
  `risoluzione.js`: `POST /scegli` prima non sapeva mai quale giocatore
  della stanza stesse facendo la scelta.
- Tre domande poste e risolte con l'utente prima di scrivere codice: come il
  client comunica il giocatore (`giocatoreId` nel body — coerente con
  `/risorse` e `/avvia-nodo`, nessuna infrastruttura di sessione/token esiste
  nel Worker), cosa succede senza un giocatore valido (reso **obbligatorio e
  validato**: 400 sia se `giocatoreId` manca sia se non corrisponde a un
  giocatore già unito alla stanza con `/join` — scelta consapevole di rompere
  la compatibilità con le chiamate `/scegli` senza `giocatoreId` scritte nei
  test precedenti, aggiornate di conseguenza), e dove tracciarlo (solo in
  `storicoScelte`, nessun nuovo campo a livello di sessione — quindi nessuna
  modifica a `initState()`/`migrateState()`).
- `session.storicoScelte` ha ora un campo `giocatoreId` per voce, oltre a
  quelli già esistenti (`richiestaId`, `risposteTesto`, `esito`, `timestamp`).
- `test-game-session.mjs` aggiornato: le chiamate a `/scegli` già scritte ora
  uniscono prima un giocatore e passano il suo id, senza cambiare nel merito
  cosa veniva verificato prima.
- Nuovo `test-scegli-giocatore.mjs` (12 verifiche, tutte passate), dedicato e
  isolato come gli altri moduli: `giocatoreId` mancante, sconosciuto alla
  stanza, valido in un'ALTRA stanza ma non in questa (l'id è per-Durable-Object,
  non globale — verificato esplicitamente), scelta valida che registra
  correttamente chi l'ha fatta, e due giocatori diversi nella stessa stanza
  che scelgono in sequenza senza confondersi.
- Non toccato: `risoluzione.js`, nessun campo per dichiarare un tiro, login/
  progressione tra stanze (rimandato a una sessione a parte, come deciso).
- **Prossimo passo, deciso e separato**: collegare `risoluzione.js` al flusso
  di `/scegli` — ora che si sa chi sceglie, può usare le competenze del
  giocatore giusto.

**10/07/2026 — Passo 6: contenuto del Cronista spostato da JS a markdown**
Nuovi file: `src/lib/narratore-corsa-invisibile.md` (contenuto), 
`src/lib/narratore-corsa-invisibile-loader.js` (parser + costruzione pool), 
`.gitignore` (node_modules/, .wrangler/ — creati da un `npm install` di verifica).
File modificati: `src/lib/narratore-corsa-invisibile.js` (ora un wrapper sottile
che importa il `.md` e chiama il caricatore), `test-narratore-corsa-invisibile.mjs`
(aggiornato per caricare il `.md` vero da disco con `fs.readFileSync`, come farebbe
un test Node, invece di importare frammenti hardcoded), `wrangler.toml`
(aggiunta `[[rules]] type = "Text"` per gli import di `.md`), `package-lock.json`
(generato dall'`npm install`, prima assente).
- Stesso identico contenuto testuale di prima (nessun frammento nuovo o riscritto),
  riorganizzato in tabelle markdown leggibili: una per ogni combinazione
  slot × asse di variazione (baseline per esito, per ruolo, per competenza,
  per fascia di margine).
- Il caricatore (`narratore-corsa-invisibile-loader.js`) è puro JS senza I/O:
  prende il testo del `.md` già letto come stringa e non sa nulla di come è
  stato ottenuto. Questo lo rende testabile sotto Node esattamente come il
  resto del motore, e riusabile sia dal Worker sia dai test.
- **Verificato concretamente** (non solo per lettura del codice) che il
  meccanismo funzioni sotto Cloudflare: con `npx wrangler deploy --dry-run`
  su un entry-point di prova che importa `narratore-corsa-invisibile.js`, il
  `.md` risulta caricato da Wrangler come modulo di testo separato e allegato
  al pacchetto del Worker (stesso meccanismo dei moduli WASM) — non letto da
  disco a runtime. File di prova cancellati subito dopo la verifica, non
  fanno parte del repository.
- Il test aggiornato (39 verifiche, tutte passate) copre anche il parsing:
  markdown malformato (riga senza `id`, riga senza `testo`, tabella prima di
  un'intestazione `## Slot: ...`, nome di slot sconosciuto) fallisce con un
  errore chiaro invece di produrre dati sbagliati in silenzio.
- Nessun frammento del nodo `1836-torino` richiede logica programmatica
  (funzione invece di stringa) — non c'è stato bisogno di tenere nulla in JS
  a parte, oltre al caricatore stesso.
- Non toccato: login/progressione tra stanze (rimandato a una sessione a
  parte, come deciso), e il collegamento vero a `GameSession.js` (resta
  bloccato da `risoluzione.js`, vedi "Punto di ripresa").

**10/07/2026 — Passo 5: pool di contenuto del Cronista per `1836-torino`**
Nuovi file: `src/lib/narratore-corsa-invisibile.js`, `test-narratore-corsa-invisibile.mjs`.
File modificati: `CLAUDE.md` (correzione stato reale di `access-codes.js` e
architettura), `README.md` (voce `/admin/genera-codici` corretta da "fatto" a
"da fare", non è mai stata collegata), `DECISIONI_LA_CORSA_INVISIBILE.md`.
- Scritto il primo pool di contenuto vero per il Cronista, scoped al solo nodo
  `1836-torino` (decisione: validare l'approccio prima di scalare agli altri
  4 nodi). Varia per esito (baseline sempre garantita per apertura/sviluppo/
  eco), per ruolo (frammenti di apertura), per competenza (frammenti di
  sviluppo) e per fascia di margine (frammenti dell'eco) — i tre assi decisi
  esplicitamente più quello già calcolato dal motore.
- Ogni frammento condizionato dichiara una `condizione` (sottoinsieme di
  `esito`/`ruoloId`/`competenzaId`/`fasciaMargine`); un frammento senza
  ruolo/competenza noti resta comunque coperto dai frammenti baseline per
  esito, quindi il pool non lancia mai errori "candidati mancanti" per un
  contesto valido.
- Nuovo test `test-narratore-corsa-invisibile.mjs`: 28 verifiche, tutte
  passate, incluse le 90 combinazioni di esito × ruolo × competenza senza
  errori, la presenza dei frammenti specifici per ciascun asse, la sostituzione
  affidabile del placeholder `{ruolo}` su 50 tentativi, e il fallimento
  esplicito (non silenzioso) su slot o esito non validi.
- Corretta anche una discrepanza trovata in `README.md`: la checklist diceva
  "fatto" per la protezione di `/admin/genera-codici`, ma quella rotta non
  esiste in `src/index.js` e `lib/access-codes.js` non è importato da nessuna
  parte — segnato come "da fare" nel README e aggiunto a "Cosa manca" qui sopra.
- **Ancora da fare, e nell'ordine giusto**: prima collegare `risoluzione.js`
  al flusso dei nodi (senza, i nodi non generano mai un `esito` pieno/
  parziale/fallimento), solo dopo collegare questo pool a `GameSession.js`;
  infine estendere il pool agli altri 4 nodi.

**10/07/2026 — Passo 4: motore neutro del Cronista + setup Claude Code**
Nuovi file: `src/lib/narratore-simulato.js`, `test-narratore-simulato.mjs`, `CLAUDE.md`.
- Scritto il motore di narrazione a frammenti combinabili, completamente neutro
  (vedi punto 5 sopra per i dettagli). 21 test automatici, tutti passati.
- Un test iniziale (`scegliFrammento` con pesi 100:1 su 50 tentativi) era
  probabilisticamente instabile (falliva per puro caso più della metà delle
  volte anche a motore corretto) — corretto con un rapporto di peso più
  ragionevole (5:1) e più tentativi (300). Ora stabile.
- Scritto `CLAUDE.md` in root per lavorare da qui in poi con Claude Code
  sulla cartella reale del progetto invece che tramite upload manuale:
  contiene la regola del muro (nessun termine di gioco fuori da
  `game-config.js` o dal pool del Cronista), l'avviso sul deploy automatico
  su push a `main`, la regola di non mescolare account GitHub/Cloudflare, e i
  comandi di test.
- **Ancora da fare**: pool di frammenti narrativi veri, collegamento a
  `GameSession.js`.

**10/07/2026 — Passo 3: competenze personaggio e formula di risoluzione**
File modificati: `src/game-config.js`.
Nuovi file: `src/lib/risoluzione.js`, `test-risoluzione.mjs`.
- Aggiunta la sezione `competenze` (5 competenze, riprendendo le etichette già
  presenti in `proveDelDecalogo`) e `competenzaPrincipale` su ogni ruolo.
- Aggiunti i parametri `creazionePersonaggio` (valorePrincipale: 3,
  valoreAltre: 1, puntiExtra: 3, valoreMassimo: 5) e `risoluzione` (dado 1d4,
  soglie 8/5). **Numeri da confermare**, come il Margine — sono un punto di
  partenza ragionevole, non un dato di design definitivo.
- Nuovo modulo `src/lib/risoluzione.js`: `creaCompetenzeIniziali(ruoloId, extra)`
  per la creazione personaggio, `risolviAzione(competenza, dado)` per la
  formula di risoluzione.
- Nuovo test `test-risoluzione.mjs`: 11 verifiche, tutte passate, incluso il
  controllo esplicito che la competenza alta batta sempre quella bassa anche
  nel confronto peggior-caso/miglior-caso di fortuna.
- **Non ancora collegato al flusso dei nodi**: `GameSession.js` /scegli
  continua a usare solo gli effetti fissi scritti nei nodi. Il prossimo passo
  è permettere a una richiesta di chiedere un tiro di competenza invece di
  (o oltre) un effetto fisso.

**10/07/2026 — Passo 2: verifica della ramificazione con test locale**
File modificati: `src/durable-objects/GameSession.js`, `src/game-config.js`.
Nuovo file: `test-game-session.mjs`.
- Corretta un'ambiguità nel Passo 1: ora si distingue "prossima" assente
  (fallback in sequenza, per compatibilità) da `"prossima": null` esplicito
  (fine ramo, anche se nell'array ci sono altre richieste dopo). Senza questa
  distinzione, un nodo con ramificazioni parziali poteva "sbandare" verso una
  richiesta sbagliata.
- Aggiunto un esempio reale di ramificazione al nodo `1836-torino`: la scelta
  aggressiva ("a tutta velocità") ora porta a una nuova richiesta
  `decalogo-vaira-severo` (La Marmora più duro con chi corre senza calcolare
  i rischi), le altre due scelte portano alla richiesta normale
  `decalogo-vaira`. Prima prova pratica dell'ipotesi sul Margine: la scelta
  aggressiva alza il margine (+2), l'ammissione di paura nel ramo severo lo
  abbassa (-1).
- Aggiunto `test-game-session.mjs`: simula il Durable Object in locale (storage
  in memoria, senza bisogno di pubblicare su Cloudflare) e verifica
  automaticamente ramificazione, avanzamento dell'orologio, variazioni del
  margine e chiusura del nodo. **Tutti i test passano.** Si lancia con
  `node test-game-session.mjs` dalla cartella del progetto.
  **Nota**: questo file non risulta ancora caricato su GitHub — se serve,
  va recuperato dal Desktop e caricato.
- La soglia del margine (5) non è ancora stata testata end-to-end nel test
  automatico — il percorso più breve provato arriva a margine 2. Da
  aggiungere un test dedicato quando la definizione di Margine sarà confermata.

**10/07/2026 — Passo 1: stato del Durable Object**
File modificati: `src/durable-objects/GameSession.js`, `src/game-config.js`.
- Aggiunte le tracce `orologio` (avanza a ogni scelta) e `margine` (ipotesi da
  confermare, vedi sopra).
- Aggiunta ramificazione dei nodi: le risposte possono avere un campo opzionale
  `prossima` (id della richiesta successiva). Senza di esso, comportamento
  invariato rispetto a prima (sequenza lineare) — i 5 nodi già scritti
  continuano a funzionare senza modifiche.
- Aggiunto diario dei nodi (`storicoNodo`): inizio/fine/esito di ogni nodo giocato.
- Aggiunto contatore `aiUsageStanza` nello stato (non ancora collegato a una
  chiamata AI reale).
- Migrazione automatica aggiornata per tutti i nuovi campi.
- Nessuna modifica a `index.js`, `schema.sql`, `access-codes.js`.

---

**10/07/2026 — Correzione terminologica: ruolo "fanfarista" → "fanfara"**
File modificati: `src/game-config.js`, `src/lib/narratore-corsa-invisibile.md`,
`test-narratore-corsa-invisibile.mjs`, `test-scegli-cronista.mjs`.
- Su indicazione dell'autore (competenza diretta sui Bersaglieri): il nome
  corretto/accettato del ruolo è "Fanfara", non "Fanfarista". Cambiati i
  tre campi del ruolo in `game-config.js`: `id: "fanfarista"` → `"fanfara"`,
  `nome: "Fanfarista"` → `"Fanfara"`, `nomeConArticolo: "Il Fanfarista"` →
  `"La Fanfara"`.
- **Nota di genere**: "Fanfara" è femminile, "Fanfarista" era maschile —
  stesso tipo di problema grammaticale già risolto una volta per questo
  ruolo (vedi il Passo 10 più sopra, dove era emerso che i frammenti con
  `{ruolo}` avevano bisogno di un `nomeConArticolo` corretto). L'articolo
  cambia di conseguenza da "Il" a "La".
- Rinominata anche la riga corrispondente in
  `narratore-corsa-invisibile.md` (`apertura-ruolo-fanfarista` →
  `apertura-ruolo-fanfara`, colonna `ruoloId` da `fanfarista` a `fanfara`):
  il testo del frammento resta invariato, il placeholder `{ruolo}` si
  risolve automaticamente nel nuovo `nomeConArticolo`.
- Cercato nell'intero repository (`grep -rni "fanfarista" .`, cache di
  build `.wrangler/` esclusa) prima di considerare il lavoro concluso:
  trovati due riferimenti non previsti inizialmente, in
  `test-narratore-corsa-invisibile.mjs` (l'elenco dei ruoli nel test di
  copertura incrociata, e il test dedicato al placeholder `{ruolo}`) e in
  `test-scegli-cronista.mjs` (un `/join` reale con `ruolo: "fanfarista"`,
  che dopo la rinomina avrebbe preso 400 come ruolo sconosciuto). Segnalati
  e corretti su conferma, non decisi unilateralmente.
  Le uniche occorrenze rimaste sono nelle voci passate di questo stesso
  file (Passo 3, Passo 10): storico, non toccato di proposito.
- Tutti i test automatici rilanciati dopo le correzioni: nessuna
  regressione.
- **Non toccato**: contenuto narrativo degli altri ruoli, gli altri 4
  nodi, `public/index.html` (il nome del ruolo arriva dal `focus`/`nome`
  serviti da `/api/config`, non richiede modifiche lato client per questa
  rinomina).
