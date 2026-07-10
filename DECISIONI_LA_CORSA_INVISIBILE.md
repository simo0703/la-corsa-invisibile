# La Corsa Invisibile — Log delle decisioni

Aggiornato al: 10 luglio 2026 (fine sessione, dopo il Passo 12 — lavoro sospeso qui su richiesta)

Questo file serve a non perdersi tra una sessione di lavoro e l'altra: raccoglie cosa
è stato deciso, cosa è ancora un'ipotesi da confermare, e cosa manca. Va aggiornato
ogni 3-4 passaggi di lavoro, non a ogni singola modifica.

**Punto di ripresa**: esiste ora un'identità comandante e un pannello
dedicato nella schermata di gioco (Passo 12). Il comandante non è un ruolo
a parte: è il primo giocatore che fa `/join` in una stanza appena creata
(`session.giocatori.length === 0`), gioca anche lui con uno dei 4 ruoli,
ma vede in più un pannello (margine con soglia, avvio/cambio nodo, modifica
manuale del margine, note private mai inviate al server). Nessun controllo
di autorizzazione lato server: il flag `comandante` sblocca solo l'interfaccia
lato client, coerente con il resto dell'API (nessuna infrastruttura di
sessione/token nel Worker). Limite noto e accettato: se il link viene
condiviso prima che il creatore stesso faccia `/join`, un altro giocatore
potrebbe diventare comandante per primo.
Margine modificabile manualmente estendendo `/risorse` (non un endpoint
dedicato): "margine" è ora una chiave speciale accettata da quell'endpoint,
con lo stesso pattern delta già usato per le risorse di squadra.
Il bug noto di `public/index.html` (non mandava mai `giocatoreId` a
`/scegli`) è corretto dal Passo 11 — `STATO.giocatoreId`
viene salvato dalla risposta di `/join` e incluso nel body di `/scegli`.
**Verificato dal vivo**, non solo a lettura di codice: `wrangler dev` +
browser reale, join di un Esploratore, avvio di `1836-torino`, scelta "A
tutta velocità" — nessuna richiesta fallita (il 400 sparito), ed è uscito
prima il tier "parziale" poi (in una stanza nuova) "fallimento", in
entrambi i casi con il testo composto dal Cronista, non più quello statico
("pieno" non è mai uscito: con la Cadenza base dell'Esploratore, 3, è
matematicamente irraggiungibile — 3 + dado massimo 4 = 7, sotto la soglia
di 8 — non un problema del fix, coerente con quanto già verificato nei
test automatici).
Il Cronista è collegato al flusso di `/scegli` dal Passo 10 — per il nodo
`1836-torino`, l'unico con una risposta reale con tiro finora (Passo 9).
Si attiva **solo** per risposte con `competenzaRichiesta`; quando il pool
del nodo attivo è disponibile, **sostituisce** il testo statico, tramite un
registro `nodoId → pool` (`src/lib/narratore-registro-pool.js`) — nessuna
stringa di nodo o di ruolo scritta in `GameSession.js`.
`storicoFrammenti` (anti-ripetizione del Cronista) resta sempre `[]`:
nessun nuovo campo di sessione per ora, vedi nota più sotto.
Restano da confermare: la definizione del Margine, e poi codice del libro /
chat / chiamata vocale (vedi sotto) — invariato dal Passo 3.

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
- [ ] Pool di frammenti narrativi veri per gli altri 4 nodi (Milano, Carso/Piave,
      Emergenza civile, missione moderna) — quando pronti, basta aggiungerli
      al registro (`src/lib/narratore-registro-pool.js`), zero modifiche a
      `GameSession.js`
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
