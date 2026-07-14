# La Corsa Invisibile — Log delle decisioni

Aggiornato al: 14 luglio 2026 (in produzione e su `origin/main` fino a
`3b553d2`; questo aggiornamento allinea al codice reale le sezioni rimaste
indietro). Batteria di test corrente: **25 file `test-*.mjs`, 757
asserzioni, 0 FAIL** — verificata due volte il 14/07/2026.
Interventi della sessione serale del 13 luglio: **Riconoscimento** — rientro
in partita e presa di comando (`1d9b592`), **anti-ripetizione del Cronista**
(`23c402e`), **decisione di design su `bonusContesto`** + commenti allineati
al 1d6 (`3e14e22`), **verifica dal vivo di `POSTI_TAVOLO`** (nessun file
toccato) — vedi le prime quattro voci del changelog.
**Buco colmato (14/07/2026)**: i commit `9119409` (chat di squadra, layout a
tre zone, colonna dei romanzi), `c0fabb2` (ribilanciamento del tiro: 1d6 per
tutti, competenze non principali a 2), `1d9b592` (Riconoscimento) e `23c402e`
(anti-ripetizione del Cronista) sono in produzione E ora allineati in questo
log: la Decisione confermata #2 (numeri del tiro), le note su
`storicoFrammenti`, l'ipotesi sulla chat, la definizione di Margine e la voce
sull'interfaccia `public/` sono state riscritte per dire il vero — vedi le
rispettive sezioni.
La sessione mattutina del 13 luglio aveva chiuso: titolo del pannello
comandante WCAG AA (`1caefcb`), messaggi 401/403 distinti (`0a0bc88`),
asse `richiestaId` del Cronista (`a33880c`); quella del 12 luglio i tre
filoni post-Fase 4: UI di accesso reale, token di sessione per il profilo,
riconoscimento del grado nel gameplay — vedi "Punto di ripresa" sotto.

Questo file serve a non perdersi tra una sessione di lavoro e l'altra: raccoglie cosa
è stato deciso, cosa è ancora un'ipotesi da confermare, e cosa manca. Va aggiornato
ogni 3-4 passaggi di lavoro, non a ogni singola modifica.

**Nota su un buco nel log**: tra il Passo 18 e questa sessione sono state fatte
almeno 3 commit (token di sessione per autenticare le azioni comandante, rimozione
della "corsa al comandante" a favore del `tokenCreazione`, cessione volontaria del
ruolo) che non risultano loggate qui sotto come Passi numerati — la sessione che le
ha scritte non ha aggiornato questo file. Non ricostruito retroattivamente in questa
sessione (fuori scope); se serve, va fatto a parte guardando `git log`.

**Punto di ripresa**: chiuso l'intero ciclo di lavoro apertosi dopo la Fase 4
del profilo persistente (Passo 24) — **tre filoni indipendenti, tutti
completi e pushati su main**:

1. **UI di accesso reale** (4 passi, commit `04a8b76`→`aa55517`→`407d132`→`47d1e0b`):
   - **Passo 1** (`04a8b76`): link discreto "Arruolati" su schermo-codice e
     schermo-join + pagina placeholder `public/arruolati.html` — solo
     routing/scheletro, nessuna logica di login. **Premessa verificata prima
     di implementare**: il repo non aveva (e non ha tuttora) un vero "codice
     stanza" digitabile a mano — solo link con roomId — quindi "codice
     stanza" nella richiesta originale è stato interpretato come il
     meccanismo già esistente, non una nuova UI di inserimento manuale.
   - **Passo 2** (`aa55517`): sostituito il placeholder con login/
     registrazione veri (tab Accedi/Registrati, chiamano `/profilo/accedi`
     e `/profilo/registra` di Fase 1, non toccati).
   - **Passo 3** (`407d132`): dopo login/registrazione, il profiloId veniva
     salvato in `localStorage` e passato al `/join` se presente — **poi
     superato dal sistema di token al punto 2 sotto** (oggi si passa un
     token, non più il profiloId puro). Percorso ospite invariato in tutti
     e 4 i passi.
   - **Passo 4** (`47d1e0b`): invito post-sessione ("Vuoi conservare questo
     grado? Arruolati...") agganciato alla schermata di fine nodo esistente
     (`.esito-finale-box`), solo per ospiti. **Premessa verificata e
     corretta durante il lavoro**: non esisteva (e non esiste tuttora) un
     numero di XP/grado visibile durante la partita — l'invito resta
     narrativo, senza cifra precisa, agganciato al momento concettuale
     "fine nodo" invece che a un contatore reale.

2. **Sistema di token di sessione per il profilo** (3 passi, commit
   `81eb548`→`32505c9`→`aad64ca`) — **chiude il rischio di impersonazione**
   segnalato come nota aperta dopo il Passo 3 sopra (fino ad allora, un
   profiloId bastava dichiararlo al `/join`, senza prova di possesso):
   - **Passo 1** (`81eb548`): nuova tabella `sessioni_profilo` (**una riga
     per sessione, non per profilo**: più dispositivi possono restare
     collegati insieme, un nuovo login non invalida gli altri). Token da
     256 bit (`crypto.getRandomValues`), salvato in D1 SOLO come hash
     SHA-256, scadenza 30 giorni. `/profilo/registra` e `/profilo/accedi`
     restituiscono ora anche `token`+`tokenScadenza`.
   - **Passo 2** (`32505c9`): `/join` accetta un `profiloToken` (nome scelto
     per non confondersi col token in-partita già esistente sullo stesso
     endpoint — **punto di formato chiarito con l'autore prima di
     implementare**) e ne ricava il profiloId verificandolo contro
     `sessioni_profilo` — un profiloId dichiarato a parte, senza token
     valido, viene SEMPRE ignorato da qui in poi. Fallback silenzioso a
     ospite per token assente/scaduto/inesistente o un fallimento D1
     isolato: il join non si blocca mai.
   - **Passo 3** (`aad64ca`): migrazione client (`arruolati.html` salva
     nome+profiloToken+scadenza, mai più il profiloId puro, mai il PIN) +
     nuovo `POST /profilo/logout` che invalida la sessione anche
     server-side (cancella la riga, non solo `localStorage`); scadenza
     controllata SOLO lato client al caricamento, senza chiamare il server
     preventivamente.
   - **Finestra temporanea nota, poi richiusa**: tra il push del Passo 2 e
     quello del Passo 3, il client (ancora sul vecchio `profiloId`) veniva
     silenziosamente ignorato dal server aggiornato — segnalato all'autore
     subito dopo il Passo 2, richiuso appena il Passo 3 è stato pushato.

3. **Riconoscimento del grado nel gameplay** (2 punti, commit `ec1fb5b`,
   `2e32b12`) — **solo visualizzazione, nessun nuovo effetto meccanico**:
   il bonus +1/competenza di Fase 4 resta l'unico effetto numerico del
   grado, per non far pesare il divario tra veterani e pubblico nuovo
   (decisione presa esplicitamente, non riaperta):
   - **Badge nel roster** (`ec1fb5b`): nuovo `POST /profilo/gradi` (una
     query in blocco per un elenco di profiloId, riusa `calcolaGrado` già
     esistente — nessuna duplicazione), cache client per profiloId
     (`GRADI_CACHE`) per non interrogare il server a ogni tick di polling
     (6s): solo su profiloId mai visti prima, o forzato subito dopo la
     chiusura di un nodo (unico momento in cui l'XP cambia).
   - **Prefisso di grado nel nome** (`2e32b12`): applicato SOLO nella
     proposta di cessione del comando — **premessa verificata prima di
     implementare**: né il Cronista né l'interprete di testo libero
     compongono oggi testo con il nome del giocatore (solo con `{ruolo}`),
     quindi quello era l'UNICO punto reale dove il gioco si rivolge a un
     giocatore per nome in un testo scritto durante la partita.
     `storicoScelte` (l'altro candidato considerato) non è mai mostrato in
     UI, solo nello stato interno della stanza: scartato. Nessun titolo per
     grado base "Bersagliere" o per ospiti (scelta fatta e segnalata
     all'autore: un titolo per chiunque abbia un profilo, anche a XP zero,
     segnalerebbe solo "ha un profilo", non un progresso reale).

Con questo, tutti e tre i punti lasciati aperti dopo il Passo 24 (UI di
login/registrazione, verifica di possesso del profiloId, uso più ampio dei
bonus nel gameplay) sono chiusi — vedi "Cosa manca" sotto.
Restano dalla Fase 1-3 del profilo persistente (invariati, non toccati in
questo ciclo): `autenticaGiocatore()`/`autenticaComandante()` e i token
in-game (Passo 19/20, concettualmente distinti dal `profiloToken` sopra),
schema D1 applicato sia in locale sia in produzione.
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
è ora un campo di sessione reale (`session.storicoFrammenti`, commit
`23c402e`): finestra scorrevole degli ultimi 12 id, azzerata al cambio nodo
(`/avvia-nodo`), con migrazione in `initState()`/`migrateState()`.
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
**SUPERATA il 13/07/2026**: fatto esattamente così (commit `23c402e`,
`session.storicoFrammenti` con migrazione) — vedi la voce nel changelog.

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
   di nessun ruolo). Punteggio 1-5, principale parte da 3, le altre da 2,
   + 3 punti extra liberi in creazione (tetto 5). Dado **1d6** sommato al
   punteggio, uguale per TUTTI su qualunque competenza — quindi principale
   3 + 1d6, non principali 2 + 1d6 (ribilanciamento `c0fabb2`: il vecchio
   1d4, ampiezza 4, non copriva la finestra fallimento ≤4 ↔ pieno ≥8, che
   richiede ampiezza 5). Verificato che la competenza alta batte sempre
   quella bassa anche nel peggior/miglior caso di fortuna incrociata.
   Soglie: 8+ pieno, 5-7 parziale, ≤4 fallimento. **Collegato ai nodi
   temporali**: tutti e 5 i nodi hanno almeno una risposta a tiro reale
   (`competenzaRichiesta`) — vedi Passi 8-18 nel changelog.

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
    `storicoFrammenti`: all'epoca del Passo 10 restava `[]`; **implementato
    poi come campo di sessione** (commit `23c402e`): `session.storicoFrammenti`,
    finestra degli ultimi 12 id, reset al cambio nodo, con migrazione.
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

20. **Riconoscimento — rientro in partita e presa di comando (fatto, commit
    `1d9b592`)**: tre flussi distinti, in `GameSession.js` con stato
    `session.riconoscimentoPendente` (migrato in `initState()`/`migrateState()`):
    - **rientro dell'ospite con conferma di un terzo**: chi ha perso la
      sessione apre una richiesta (`POST /richiedi-rientro`) che un ALTRO
      giocatore già al tavolo deve confermare; solo dopo la conferma il
      richiedente reclama il token nuovo (`POST /reclama-rientro`). I campi
      `biglietto`/`nuovoToken` sono segreti, esclusi da `/state`;
    - **rientro del giocatore registrato**: chi ha un profilo rientra da sé
      con il proprio `profiloToken` (`POST /rientro-registrato`), senza
      bisogno della conferma di un terzo;
    - **presa di comando con veto forte**: quando il comandante non risponde,
      un altro può chiederne il ruolo, ma il veto del comandante presente
      prevale (veto forte).

21. **Margine (definizione ufficiale, corretta il 14/07/2026)**:
    il Margine è un **contatore della squadra**, non un numero del singolo
    tiro. Parte da 0. Ogni azione risolta col dado lo fa salire: **+1 se
    l'esito è pieno, +2 se parziale, +3 se fallimento**. Alcuni effetti fissi
    dei nodi lo abbassano. Quando raggiunge la **soglia 5** scatta la
    complicazione (testo `margineComplicazioneTesto`) e il contatore si
    **dimezza, tornando a 2**. Il Cronista ne legge la **fascia** (basso /
    medio / alto / critico) per intonare la chiusura della narrazione.
    **Attenzione al verso: MARGINE ALTO = MALE.**

    **Nome interno e nome mostrato divergono di proposito**: nel codice resta
    `margine`; al comandante viene mostrato come **"Tensione"** (etichetta in
    `public/index.html`), perché "Margine: 4/5" farebbe pensare di stare
    andando bene mentre è vero il contrario. Nei testi del Cronista la parola
    "margine" resta nel suo senso italiano comune ("il margine si
    assottiglia"), dove il verso è già corretto: quei testi **NON si toccano**.

    Il **playtest zero** misura: quante volte il Margine trabocca in un nodo,
    e se la soglia 5 e i passi 1/2/3 sono tarati bene.

    **Nota storica**: la definizione precedente ("totale del tiro meno la
    soglia raggiunta") era un'ipotesi errata, mai esistita nel codice.
    Annullata.

22. **Colpo secco (deciso e implementato il 14/07/2026)**: se il dado
    mostra 1, l'esito è SEMPRE "fallimento", qualunque siano punteggio
    base, bonus di grado e totale — per ogni tiro, di ogni ruolo, su ogni
    competenza (`risolviAzione` in `src/lib/risoluzione.js`). Il totale
    resta calcolato e riportato come prima: serve al log del tiro e al
    delta di margine del fallimento (+3). **Motivo**: senza questa regola,
    base 4 + 1d6 non poteva mai fallire (0,0% misurato dalla Sim B del
    playtest zero) — il bonus di grado spegneva la tensione ai giocatori
    più avanzati. Regola annunciata anche nei manuali (regolamento cap. 4,
    guida rapida) e nei PDF rigenerati. Nei test, il tier "pieno" non è
    più forzabile col solo punteggio: i blocchi che lo richiedono bloccano
    anche il dado (`conDadoMassimo`, Math.random fissato per la singola
    chiamata).

23. **Azzeramento del Margine (deciso e implementato il 14/07/2026)**:
    quando il Margine raggiunge la soglia, dopo la complicazione torna a
    **0**, non più a `floor(soglia/2) = 2` (`GameSession.applicaRisposta`).
    Il testo `margineComplicazioneTesto` resta identico, e l'ordine delle
    operazioni pure (incremento → Cronista → controllo soglia →
    azzeramento): il Cronista continua a vedere il valore PIENO nel turno
    dello scoppio, quindi la fascia "critico" resta viva (~52% delle
    chiamate a regime, misura del 14/07). **Motivo**: col dimezzamento gli
    scoppi successivi arrivavano ogni ~1,9 tiri (misura Sim B) — guai a
    raffica — e il tono del Cronista restava schiacciato verso l'alto;
    con l'azzeramento la distanza sale a ~2,9 tiri e tutte le fasce
    tornano in gioco.

24. **Bersaglio contenuti: 6-8 risposte a tiro per nodo (deciso il
    14/07/2026)**: con colpo secco + azzeramento, 6-8 tiri per nodo
    producono ≈2 complicazioni a nodo (primo scoppio ~3° tiro, successivi
    ogni ~2,9 — misure Sim B). È il criterio del lavoro di conversione
    delle risposte fisse a tiro reale, prossimo cantiere (vedi "Cosa
    manca").

25. **puntiExtra: variante (b) DECISA, implementazione rinviata (deciso il
    14/07/2026)**: i 3 punti extra si distribuiranno al `/join`, con un
    massimo di +1 per ciascuna competenza NON principale (misura Sim B:
    porta le competenze deboli dal 33% al 17% di fallimento senza gonfiare
    la specialità). L'implementazione va in un cantiere dedicato — serve
    la UI di distribuzione. Non è più un'ipotesi aperta.

---

## Ipotesi in attesa di conferma (NON dare per deciso)

- **Margine**: **non più un'ipotesi** — la definizione ufficiale è quella
  già implementata nel codice (vedi Decisioni confermate #21: contatore di
  squadra che sale +1/+2/+3 sull'esito del tiro, soglia 5 → complicazione +
  dimezzamento, margine alto = male). Nessuna riconciliazione da fare: il
  codice era giusto. Resta solo la taratura al playtest zero (soglia 5 e passi
  1/2/3) — vedi "Cosa manca".
- **Codice del libro**: il README attuale dice accesso libero, nessun codice
  richiesto per giocare (diverso da Soglia). Non ancora discusso esplicitamente
  se resta così.
- **Chiamata vocale integrata**: presente in Soglia, non ancora deciso se
  includerla in Corsa Invisibile. (La **chat di squadra** invece è già
  implementata — commit `9119409`, tetto 200 messaggi / 500 caratteri,
  pannello nella UI; non è più un'ipotesi aperta.)

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
- [ ] Convertire altre risposte fisse a tiro reale — **bersaglio: 6-8
      risposte a tiro per nodo (Decisione #24, ≈2 complicazioni a nodo)**.
      `1848-milano` ne ha
      ora due (Cadenza su `milano-barricata`, Precisione su
      `milano-ferito`, quest'ultima aggiunta per dare finalmente
      all'Incursore un'occasione di tirare sulla propria specialità); gli
      altri 4 nodi (`1836-torino`, `1915-carso-piave`, `emergenza-civile`,
      `missione-moderna`) ne hanno ancora solo una ciascuno. Tutti e 5 i
      nodi hanno già pool e librerie pronti, quindi una nuova risposta a
      tiro in un nodo esistente può riusarli senza altro lavoro di
      contenuto — **attenzione**: se il nuovo tiro condivide il pool con un
      tiro già esistente nello stesso nodo, condiziona i frammenti sull'asse
      `richiestaId` (ora abilitato, vedi punto chiuso sotto) per evitare il
      mescolamento tra scene, invece dell'accorgimento provvisorio
      dell'Opzione 2 (frammenti dedicati affiancati ai baseline) usato in
      `1848-milano`
- [x] Abilitare l'asse `richiestaId` nel contesto del Cronista — **CHIUSO
      il 13/07/2026** (commit `a33880c`, `src/durable-objects/GameSession.js`
      + `test-scegli-cronista.mjs`):
      - il contesto passato a `componiNarrazione` include ora
        `richiestaId: richiestaAttiva.id` (lo stesso id già usato poco sotto
        per `storicoScelte`, nessun id nuovo da inventare);
      - **nessuna modifica al motore (`narratore-simulato.js`) né al
        loader**: il loader tratta già qualunque colonna sconosciuta di un
        `.md` come condizione confrontata col contesto, quindi l'asse
        funziona da solo appena un frammento lo usa (verificato con un test
        di loader su dati reali);
      - **modifica INERTE**: nessun frammento è oggi condizionato su
        `richiestaId`, nessun `.md` toccato;
      - **perché serviva**: in `1848-milano` i due tiri reali sono separati
        solo perché usano competenze diverse (Cadenza su `milano-barricata`
        vs Precisione su `milano-ferito`) e l'asse `competenzaId` li
        distingue per coincidenza. La separazione collassa appena due tiri
        dello stesso nodo useranno la stessa competenza: da lì in poi serve
        `richiestaId`;
      - **REGOLA DA NON VIOLARE**: le tabelle "Baseline per esito" nei `.md`
        devono restare INCONDIZIONATE su `richiestaId`. Se una baseline
        fosse condizionata, una richiesta senza frammenti dedicati farebbe
        lanciare l'errore "zero candidati" di `componiNarrazione`, che NON è
        coperto dal try/catch del registro e arriverebbe al tavolo.
        Verificato: nessun `.md` contiene oggi una colonna `richiestaId`;
      - test: **646 asserzioni su 23 file, 0 FAIL** (+5 nuove in
        `test-scegli-cronista`, di cui una cattura il contesto reale passato
        dal motore e conferma `richiestaId === "decalogo-ginnastica"`)
- [x] `public/index.html` non mandava `giocatoreId` a `/scegli` — corretto
      nel Passo 11, verificato dal vivo con `wrangler dev` + browser
- [x] Identità comandante (primo giocatore della stanza) + pannello nella
      schermata di gioco (margine, avvio/cambio nodo, note private) —
      fatto nel Passo 12
- [x] Definizione ufficiale di Margine — **corretta il 14/07/2026** (vedi
      Decisioni confermate #21: contatore di squadra +1/+2/+3, soglia 5,
      margine alto = male; nome mostrato "Tensione", nome interno `margine`).
      Nessuna riconciliazione da fare: il codice era giusto, era il log a
      sbagliare
- [x] Taratura al playtest zero — **fatta il 14/07/2026** con le simulazioni
      Sim A (partita reale in produzione) e Sim B (Monte Carlo offline):
      ne sono uscite le Decisioni #22 (colpo secco), #23 (azzeramento del
      Margine), #24 (bersaglio 6-8 risposte a tiro per nodo) e #25
      (puntiExtra variante b)
- [ ] puntiExtra, variante (b): UI di distribuzione al `/join` (3 punti,
      max +1 per competenza non principale) — decisione presa (#25),
      cantiere dedicato ancora da aprire
- [x] Un nodo scritto come esempio con ramificazione reale — fatto nel Passo 2
      (`decalogo-vaira-severo` in `1836-torino`)
- [ ] Collegare davvero l'AI alla generazione degli esiti (con il tetto per sessione)
- [ ] Decisione su codice del libro e chiamata vocale integrata (la **chat
      di squadra** è già fatta, commit `9119409`)
- [x] Interfaccia di gioco (`public/`) — **realizzata** (non più rimandata):
      `public/index.html` con tavolo a layout a tre zone, pannello comandante
      e pannello chat (commit `9119409`)
- [x] Riconoscimento — rientro dell'ospite con conferma di un altro giocatore,
      rientro del giocatore registrato, presa di comando con veto forte —
      fatto, commit `1d9b592` (vedi Decisioni confermate #20)
- [x] Chat di squadra — canale umano effimero, tetto 200 messaggi / 500
      caratteri (troncatura lato server), pannello nella UI — fatto, commit
      `9119409`
- [ ] Home del libro su bersaglierisgv.org (checklist già nel README del progetto)
- [ ] Costruire davvero `/admin/genera-codici` e collegare `lib/access-codes.js`
      a `index.js` — il README diceva "fatto" ma la rotta non esiste nel
      codice; corretto in `README.md` il 10/07/2026, segnato qui per non
      perderlo di vista
- [x] Profilo giocatore persistente, Fase 1 di 4 (schema + registra/accedi) —
      fatto nel Passo 21
- [x] Profilo giocatore persistente, Fase 2 di 4 (`profiloId` opzionale
      collegato a `/join`) — fatto nel Passo 22
- [x] Profilo giocatore persistente, Fase 3 di 4 (XP automatico al
      completamento di un nodo) — fatto nel Passo 23
- [x] Profilo giocatore persistente, Fase 4 di 4 (grado, bonus di
      competenza, applicazione al tiro) — fatto nel Passo 24, **tutte e 4 le
      fasi ora complete e pushate su main**
- [x] UI reale di login/registrazione in `public/`, collegata al flusso di
      `/join` — fatto in 4 passi (commit `04a8b76`, `aa55517`, `407d132`,
      `47d1e0b`): link "Arruolati" + placeholder, schermate vere di
      Accedi/Registrati in `arruolati.html`, collegamento al `/join`
      (poi migrato al sistema di token, vedi sotto), invito post-sessione
      per gli ospiti agganciato alla fine del nodo
- [x] Verifica che il `profiloId` dichiarato a `/join` corrisponda a un
      login realmente avvenuto — fatto in 3 passi con un sistema di token
      di sessione dedicato (commit `81eb548`, `32505c9`, `aad64ca`): tabella
      `sessioni_profilo`, token da 256 bit salvato come hash SHA-256,
      scadenza 30 giorni, `/join` verifica un `profiloToken` e ne ricava il
      profiloId — un profiloId dichiarato a parte non viene più accettato.
      Logout esplicito (`POST /profilo/logout`) invalida anche server-side
- [x] Uso reale di `bonusScelti`/dei bonus assegnati nel gameplay oltre al
      +1 al tiro già collegato — fatto come riconoscimento NARRATIVO/
      VISIVO del grado, non un nuovo effetto meccanico (decisione presa
      esplicitamente): badge grado nel roster della stanza (commit
      `ec1fb5b`, nuovo `POST /profilo/gradi`) e prefisso di grado nel nome
      nella proposta di cessione del comando (commit `2e32b12`, unico
      punto reale dove il gioco si rivolge a un giocatore per nome in un
      testo scritto durante la partita)
- [x] Messaggio d'errore più preciso per i 401/403 legittimi (punto
      discusso dopo il fix del commit `7d6996f`) — **CHIUSO il 13/07/2026**
      (commit `0a0bc88`, solo `public/index.html`, `GameSession.js` non
      toccato come richiesto). Riassunto delle scelte:
      - 401 e 403 distinti lato client — il server già li distingueva
        (`autenticaGiocatore` → 401 token non valido, `autenticaComandante`
        → 403 non comandante), verificato prima di intervenire: nessuna
        modifica server necessaria;
      - 401 = "La tua sessione non è più valida su questo dispositivo."
        Il testo NON promette un rientro, perché il flusso di rientro non
        esiste (vedi il nuovo punto "Flusso di rientro assente" in fondo a
        questa lista);
      - 403 differenziato per contesto di chiamata (`'comandante' |
        'nodo'`): dal pannello comandante "Il comando non è più tuo.";
        dalla selezione nodo, che tutti i giocatori vedono, "Questa azione
        spetta al comandante.";
      - seconda riga "Al comando: [nome]." dalla variabile
        `NOME_COMANDANTE_CORRENTE`, alimentata dal roster già in transito
        nel polling (6s): nessuna chiamata di rete in più, nessun campo
        nuovo nel payload;
      - **nota sul conteggio dei test, per evitare equivoci futuri**:
        l'"intera suite" citata nel changelog è di **23 file** `test-*.mjs`
        (conteggio di file, corretto); le 3 suite principali elencate in
        `CLAUDE.md` (risoluzione, narratore-simulato, game-session) sono un
        sottoinsieme e contano 154 asserzioni (22+20+112). Verifica del
        13/07/2026: **l'intera batteria (23 file, 641 asserzioni) è
        verde, 0 FAIL** — valida retroattivamente anche i commit
        `1caefcb` e `0a0bc88`, che prima del push erano stati verificati
        solo sulle 3 suite principali di `CLAUDE.md`.
- [x] Peso delle immagini (texture nodi + sfondo tavolo) — fatto: da ~19 MB
      totali per schermata a ~1,3 MB (PNG → JPEG, 1600px, qualità 85), vedi
      changelog "Ottimizzazione peso immagini"
- [ ] Rifinire dal vivo i due esperimenti visivi (texture nodi + sfondo
      tavolo/badge, entrambi marcati "primo passaggio" nel codice) —
      **PARZIALMENTE CHIUSO il 13/07/2026**:
      - **RISOLTO il titolo del pannello comandante** (commit `1caefcb`):
        ora in avorio `--text` #ece4d6 (riusato dalla palette, nessun
        colore nuovo) + filetto crimson #c94538 di 2px sotto il titolo.
        Contrasto 14.33:1 su fondo solido e minimo 5.22:1 nel caso
        peggiore (pixel più chiaro) su tutte e cinque le texture di nodo,
        misurato pixel-per-pixel con sharp — sopra WCAG AA (4.5:1) ovunque.
      - **Correzione di un dato annotato in precedenza** (changelog "Velo
        del pannello comandante alleggerito"): il contrasto di partenza
        del titolo crimson era **3.78:1 sul fondo solido** (col velo 0.58;
        3.61:1 sul `--bg-panel` puro), NON 1.66:1 — l'1.66 era misurato
        contro i punti chiari della texture, non contro il fondo.
      - Il titolo ha un velo locale `rgba(var(--bg-rgb), 0.25)` che serve
        SOLO a garantire WCAG AA sopra le texture: è la prima riga da
        rivedere se dal vivo il titolo risultasse spento.
      - **CHIUSA il 13/07/2026 la verifica dal vivo di `POSTI_TAVOLO`**:
        coordinate confermate così come stimate, nessun ritocco necessario
        (vedi la voce dedicata nel changelog). Resta il giudizio d'insieme
        della schermata con un nodo attivo (texture) a occhio dell'autore.
      - Nota ambiente (invariata): lo screenshot del pannello di preview
        va in timeout sulle schermate con sfondo tavolo, sia con immagini
        da 8-10 MB sia da ~250 KB — non dipende dal peso, è un limite del
        pannello di anteprima di queste sessioni.
- [x] **Flusso di rientro assente** (PRIORITÀ: da affrontare prima di un
      playtest con un tavolo vero): un giocatore che perde il token di
      sessione è fuori dalla partita — non esiste una rotta di
      ri-autenticazione, ricaricare la pagina riporta alla stessa identità
      invalida, e un secondo `/join` nella stessa stanza è bloccato dal
      client di proposito (creerebbe un secondo giocatore). Con un tavolo
      vero è quasi certo che qualcuno chiuda la scheda o perda il token.
      Emerso durante il lavoro sui messaggi 401/403 (vedi sopra).
      **CHIUSO il 13/07/2026 con il Riconoscimento** (commit `1d9b592`, in
      produzione): tre casi — rientro ospite con biglietto e conferma di un
      terzo, rientro registrato con prova crittografica, presa di comando —
      con veto forte del diretto interessato e mai auto-conferma; vedi la
      voce nel changelog. Il testo del 401 ora promette il rientro
      ("Ricarica la pagina per rientrare") perché il flusso esiste davvero.
- [x] **Il Cronista può ripetersi alla lettera** (PRIORITÀ: prima del
      playtest): il motore SA fare anti-ripetizione (`scegliFrammento`
      esclude gli id nello storico recente, e `componiNarrazione`
      restituisce `frammentiUsati`), ma nessuno lo alimenta —
      `GameSession.js` passa `storicoFrammenti: []` hardcoded e scarta il
      `frammentiUsati` di ritorno. Risultato: oggi lo stesso frammento può
      essere pescato più volte identico nella stessa sessione. Al tavolo si
      nota molto più del mescolamento tra scene risolto con l'asse
      `richiestaId`. Richiede uno stato di sessione
      (`session.storicoFrammenti`) con migrazione in
      `initState()`/`migrateState()`, come da regola del progetto.
      **CHIUSO il 13/07/2026** (commit `23c402e`, in produzione) esattamente
      con quello stato di sessione: finestra scorrevole unica a 12 id,
      rilascio progressivo nel motore al posto del ripiego tutto-o-niente,
      azzeramento al cambio nodo — vedi la voce nel changelog.
- [ ] **Frammenti di scena per `1848-milano`** (lavoro di CONTENUTO, non
      tecnico): ora che l'asse `richiestaId` esiste (vedi punto chiuso in
      "Cosa manca" sopra), si possono scrivere frammenti dedicati a
      `milano-barricata` e `milano-ferito`, rendendo il Cronista specifico
      invece che generico sulle due scene. Va scritto e approvato in chat
      come contenuto creativo, e sarà anche l'occasione per il test
      end-to-end dell'asse che oggi manca: `1836-torino` ha un solo tiro
      reale, quindi non permette di verificare "il frammento dedicato
      compare solo per la sua richiesta" attraverso il flusso completo di
      `/scegli` (oggi l'asse è testato end-to-end sul valore che arriva nel
      contesto, e a livello di loader sul filtraggio — vedi il punto chiuso).

---

## Changelog tecnico

**13/07/2026 — Decisione di design: `bonusContesto` non si usa nei contenuti + commenti allineati al ribilanciamento 1d6**
File modificati: `src/game-config.js`, `src/lib/risoluzione.js` (solo
commenti, nessun cambio di comportamento — commit `3e14e22`, locale al
momento di questa voce).
- **Origine**: verifica "alla virgola" del capitolo 4 del regolamento
  cartaceo contro il motore (testo in chat, fuori repo). Esito: nessuna
  discrepanza sul gioco di oggi — partenze 3/2, Ancoraggio di nessuno,
  soglie 8+/5-7/≤4, probabilità faccia per faccia ("il mestiere raddoppia
  le riuscite piene e dimezza i fallimenti") tutte esatte. Unica fragilità
  trovata: il capitolo promette "non esistono modificatori… le difficoltà
  stanno dentro la storia, non dentro i numeri", ma il motore supporta
  `bonusContesto` (+1 situazionale su una risposta) — mai usato da nessun
  nodo reale, però il commento nel config invitava a usarlo.
- **DECISIONE DI DESIGN (vincolante)**: NON usare `bonusContesto` nei
  contenuti dei nodi. Le difficoltà stanno nella storia, non nei numeri
  (regolamento, cap. 4, "Una regola che non c'è"), e il gioco deve restare
  identico dal vivo con carta e dado. Il meccanismo resta nel motore per
  compatibilità, ma i nodi non devono dichiararlo. Sostituisce
  l'orientamento del Passo 20 (che lo aveva introdotto per inseguimenti/
  terreno non rivelato): nessun contenuto esistente cambia, il campo non
  era mai stato usato. L'unico modificatore online resta il bonus di grado
  (+1 da profilo, coperto nel regolamento dall'inciso sull'esperienza).
- **Commenti 1d4 stantii corretti** in `risoluzione.js` (`tiraDado` diceva
  ancora "default 1d4" e parlava dell'override di dado per ruolo come cosa
  viva): ora dicono 1d6 per tutti, override supportato ma non usato da
  nessun ruolo. I valori erano già giusti (arrivano dal config): solo prosa.
- Batteria completa 756/756 su due run (25 file), comportamento invariato.
- Nota di processo: un task in background parallelo su questi stessi
  commenti è stato archiviato senza integrare nulla (superato da `3e14e22`).

---

**13/07/2026 — `POSTI_TAVOLO` verificate dal vivo: coordinate confermate così come stimate**
File modificati: nessuno.
- Chiuso l'ultimo pezzo degli esperimenti visivi mai visto dal vivo (vedi
  punto in "Cosa manca"): stanza usa e getta in produzione con 8 giocatori
  Posto1..Posto8 (il massimo; ordine di ingresso = ordine dei posti, ruoli
  a rotazione), nessun nodo avviato per una disposizione pulita.
- **Vincolo scoperto**: `tavolo-vista` vive dentro `schermo-gioco`, quindi
  il tavolo lo vede solo chi è seduto — e con la stanza piena l'autore è
  entrato tramite il Riconoscimento stesso (richiesta su Posto1 dalla
  schermata "Sei già seduto?", conferma automatizzata via HTTP con il token
  di Posto2): dogfooding involontario del flusso appena deployato, riuscito.
- **Esito a occhio dell'autore: le percentuali stimate restano quelle**
  (1 alto-sx 14/15, 2 alto-dx 86/15, 3-4 lato sx 4/38-68, 5-6 lato dx
  96/38-68, 7 basso-sx 14/89, 8 basso-dx 86/89) — nessun ritocco, il
  commento "da aggiustare guardando il risultato vero" in `POSTI_TAVOLO`
  può considerarsi soddisfatto senza modifiche.

---

**13/07/2026 — Anti-ripetizione del Cronista: finestra di sessione a 12 id e rilascio progressivo (commit `23c402e`, in produzione)**
File modificati: `src/lib/narratore-simulato.js`,
`src/durable-objects/GameSession.js`; nuovo `test-cronista-storico.mjs`.
- Chiude il punto "Il Cronista può ripetersi alla lettera" (priorità
  pre-playtest, vedi "Cosa manca").
- **Motore** (`scegliFrammento`): il vecchio ripiego tutto-o-niente (se
  escludendo i recenti non resta nessun candidato, ignora l'INTERO storico)
  sostituito da un **rilascio progressivo a suffisso**: si rilasciano gli id
  più vecchi uno alla volta finché almeno un candidato torna disponibile.
  Garanzia: con ≥2 candidati, il frammento usato per ultimo non può MAI
  essere riscelto al tiro immediatamente successivo. Storico vuoto =
  comportamento identico a prima. La forma a suffisso regge anche gli id
  ripetuti nello storico (es. `[Y,X,Y]`: il più recente resta escluso).
- **Stato di sessione**: `session.storicoFrammenti`, finestra scorrevole
  UNICA di sessione (ultimi 12 id = ~4 esiti), migrazione in
  `initState()`/`migrateState()` come da regola; il call-site raccoglie i
  `frammentiUsati` (prima scartati) e li accoda troncando a 12.
- **Azzeramento al cambio nodo** (`/avvia-nodo`): gli id dei frammenti sono
  univoci solo per slot/pool, quindi tra pool di nodi diversi potrebbero
  collidere; e narrativamente il nuovo nodo riparte pulito.
- Test: **+19 asserzioni** (`test-cronista-storico.mjs`: alternanza stretta
  su tiri consecutivi, finestra mai >12, azzeramento, retrocompatibilità
  con sessioni senza il campo); batteria 756/756 su due run. Verificato in
  produzione post-deploy: due tiri consecutivi su `1848-milano` producono
  aperture diverse e lo storico si popola di 3 id per tiro.

---

**13/07/2026 — Riconoscimento: rientro in partita e presa di comando (commit `1d9b592`, in produzione)**
File modificati: `src/durable-objects/GameSession.js`,
`public/index.html`; nuovo `test-riconoscimento.mjs`.
- Chiude "Flusso di rientro assente" (priorità pre-playtest, vedi "Cosa
  manca"). Riusa il pattern proponi/conferma della cessione del comando:
  stato pendente in sessione (`riconoscimentoPendente`, uno alla volta) +
  conferma di un terzo, con migrazione in `initState()`/`migrateState()`.
- **Tre casi**:
  - **CASO 1, ospite che rientra**: schermata "Sei già seduto a questo
    tavolo?" col roster; il richiedente (non autenticato: è proprio il
    token che ha perso) riceve un `biglietto` segreto UNA SOLA VOLTA e
    reclama l'esito in polling (`/reclama-rientro`); serve la conferma di
    un ALTRO giocatore autenticato; ad approvazione il token del record
    viene riemesso (il vecchio si invalida subito).
  - **CASO 2, registrato che rientra**: `/rientro-registrato` con
    profiloToken = prova crittografica, riaggancio immediato senza
    conferma di nessuno. Il client lo tenta PER PRIMO.
  - **CASO 3, presa di comando**: "il comandante non risponde" (voce
    defilata in schermata di gioco); richiesta autenticata del giocatore
    seduto, conferma di un terzo, trasferimento del flag comandante.
- **Regole di sicurezza decise**: MAI auto-conferma (il richiedente non
  può confermarsi, 403; con una sola persona in stanza non si rientra, per
  design: il link della stanza gira). **VETO FORTE del diretto
  interessato**: per il rientro solo chi detiene ANCORA un token valido
  per il record reclamato può rifiutare (chiunque altro: 403); per il
  comando solo il comandante attuale; il richiedente può annullare la
  propria richiesta. Lo stato "rifiutato" resta finché il richiedente non
  lo legge — mai silenzio verso chi ha chiesto.
- **Messaggi di sistema fuori dalla chat**: l'avviso ("Qualcuno dice di
  essere X. È lui?") è renderizzato da `riconoscimentoPendente` — spogliato
  dei segreti (`biglietto`, `nuovoToken`) in `sessionPubblica()` — NON è
  una voce dell'array `chat`. Bottoni mostrati solo a chi di dovere.
- **Rifinitura post-prova dal vivo**: la classe `.errore` senza `.mostra`
  rendeva invisibili alcuni esiti (il rifiuto al richiedente, gli errori
  dei bottoni Sì/No): chiusi TUTTI i percorsi muti — ogni esito ora
  produce un messaggio visibile.
- Il messaggio del 401 ora indica causa e via d'uscita ("forse hai ripreso
  la partita da un altro dispositivo. Ricarica la pagina per rientrare") e
  il client scarta l'identità morta tenendo il roomId: il reload passa dal
  Riconoscimento.
- Verifiche: batteria 737/737 su due run (+66 asserzioni di
  `test-riconoscimento.mjs`); simulazione HTTP dal vivo 20/20 (tre client:
  auto-conferma vietata, veto forte, esito leggibile dal richiedente,
  richiesta ri-apribile dopo il rifiuto, conflitto veto/conferma quasi
  simultanei serializzato dal Durable Object col perdente su 400/409);
  smoke test in produzione post-deploy 9/9; prova visiva umana superata.

---

**12/07/2026 — Velo del pannello comandante alleggerito (0.82 → 0.58): la texture ora si vede**
File modificati: `public/index.html` (un solo valore CSS + commento).
- Segnalato dall'autore: la texture del nodo attivo era ben visibile in
  `.situazione-box` ma quasi invisibile in `.pannello-comandante`.
  **Indagine confermata: non era un bug** — `getComputedStyle` dal vivo
  mostrava la texture correttamente applicata anche lì. Due cause
  strutturali, entrambe misurate: (1) il pannello è quasi quadrato
  (541×563) contro un'immagine 16:9, quindi `cover` la ingrandisce/ritaglia
  quasi il doppio rispetto alla striscia larga di `.situazione-box`
  (rapporto 4.3:1); (2) il 29,3% dell'area del pannello è comunque coperta
  dai controlli del form (select, textarea, input) con sfondo solido
  `--bg-panel`, opachi a prescindere dal velo.
- **Correzione scelta dall'autore tra 3 opzioni proposte**: solo la 1
  (velo più leggero, 0.58 invece di 0.82, SOLO su `.pannello-comandante`;
  `.situazione-box` resta a 0.82). La 2 (sfondi semi-trasparenti per i
  controlli del form dentro il pannello) esplicitamente accantonata dopo la
  verifica: la texture è già ben visibile con la sola correzione 1, e la 2
  avrebbe ridotto la leggibilità senza necessità.
- **Prima vera controprova visiva ottenuta** (chiudendo in parte il punto
  aperto in "Cosa manca"): lo screenshot del pannello di preview resta in
  timeout (problema dell'ambiente, non del peso immagini), ma il composito
  esatto texture+velo (stessa geometria, stesso `cover`, stesso rgba) è
  stato ricostruito con canvas nel browser reale e con sharp in locale e
  guardato a occhio — a 0.82 quasi tinta unita, a 0.58 pergamena
  chiaramente leggibile (pieghe, macchie, grana).
- **Leggibilità misurata sui pixel reali dietro ai testi** (velo 0.58,
  texture 1836-torino): valore del margine (`--text`) contrasto 8.07:1
  (sopra WCAG AA 4.5:1); note del comandante e select del nodo su sfondo
  solido opaco, invariati (13.7:1). **Punto debole noto, segnalato
  all'autore**: il titolo "Pannello del comandante" (`--crimson-bright`)
  scende a 1.66:1 sui punti chiari della pergamena (era già solo 3.61:1
  sul fondo solido: il crimson su marrone è debole di suo) — etichetta
  decorativa, non contenuto; da giudicare a occhio, eventualmente da
  scurire con un chip/ombra in un passaggio futuro se disturba.
- `POSTI_TAVOLO` (percentuali dei posti) resta l'unica parte degli
  esperimenti visivi mai vista dal vivo.

---

**12/07/2026 — Ottimizzazione peso immagini: tavolo-sfondo + 5 texture nodi, PNG → JPEG**
File modificati: `public/index.html`, `src/game-config.js` (solo un commento);
6 asset sostituiti in `public/img/` (stesso nome base, estensione cambiata
da `.png` a `.jpg`).
- Richiesto dall'autore subito dopo il commit dell'esperimento texture
  (`52825c6`, non ancora pushato in quel momento): le 5 texture nuove (9-10
  MB ciascuna) sommate a `tavolo-sfondo.png` (8,8 MB) portavano una singola
  schermata di gioco con nodo attivo a ~19 MB di immagini — troppo per un
  gioco pensato anche per pubblico mobile/sconosciuto.
- **Tentata prima la strada "stesso formato"** (PNG con palette
  quantizzata, via `sharp`, unico strumento di compressione immagini
  disponibile in questo ambiente — nessun `pngquant`/`oxipng`/`cwebp`
  installato): anche ridotta a 1200px di larghezza e 128 colori, restava
  sopra i 500 KB (199 KB solo a quella risoluzione ridotta) **con banding
  visibile** nelle ombre/gradazioni scure attorno al tavolo — confrontato
  visivamente prima di scegliere, non solo sui numeri.
- **Scelto JPEG** (autorizzato esplicitamente in anticipo dall'autore per
  texture di sfondo pieno, nessuna trasparenza reale da preservare
  nonostante `hasAlpha: true` nei PNG originali): qualità 85, `mozjpeg`,
  ridimensionate da 2816×1536 a 1600px di larghezza (proporzioni invariate
  — la `.tavolo-vista` in `public/index.html` usa `aspect-ratio`, non pixel
  letti, quindi non ha richiesto modifiche). Nessun banding visibile a
  questa combinazione risoluzione/qualità, verificato guardando il file
  prima di applicarlo a tutti e 6.
- **Risultato per file** (prima → dopo):

  | File | Prima | Dopo | Riduzione |
  |---|---|---|---|
  | `tavolo-sfondo` | 8,43 MB | 275 KB | 96,8% |
  | `texture-1836-torino` | 9,75 MB | 225 KB | 97,7% |
  | `texture-1848-milano` | 9,90 MB | 272 KB | 97,3% |
  | `texture-1915-carso-piave` | 9,65 MB | 208 KB | 97,9% |
  | `texture-emergenza-civile` | 8,54 MB | 167 KB | 98,1% |
  | `texture-missione-moderna` | 9,64 MB | 223 KB | 97,7% |

  Totale: 55,9 MB → 1,34 MB. Tutti i file ben sotto il target di 300-500 KB
  indicato dall'autore.
- **Conseguenza dell'estensione cambiata**: aggiornati i 3 riferimenti in
  `public/index.html` (2 per `tavolo-sfondo.jpg` in CSS, 1 per il template
  `texture-${nodoId}.jpg` in `applicaTexturaNodo()`) e un commento in
  `src/game-config.js` che citava ancora `tavolo-sfondo.png` — nessuna
  modifica alla LOGICA, solo ai nomi file. `/img/badge-${ruolo}.png` (badge
  dei ruoli, non toccati in questo passaggio) restano `.png` di proposito:
  hanno bordo circolare via CSS (`border-radius: 50%`) e sono già piccoli
  (250-380 KB), fuori scope per questa ottimizzazione.
- **Verifica dal vivo con `wrangler dev`**: rifatta con successo la
  connessione della variabile `--texture-nodo-attivo` e dei
  `background-image` calcolati su `.situazione-box`/`.pannello-comandante`
  con i nuovi nomi `.jpg` (via `getComputedStyle`, DOM reale in esecuzione).
  **Screenshot ancora non ottenuto in questa sessione**: il pannello di
  preview è andato in timeout anche con i file già ridotti a ~250 KB
  (provato su due tab diverse) — l'ipotesi "il timeout era dovuto al peso
  delle immagini" **non è stata confermata**: il problema persiste anche a
  file 30 volte più piccoli, quindi è più probabile un limite/instabilità
  del pannello di anteprima in questa sessione che una conseguenza diretta
  delle immagini. Verifica quindi rimasta sul DOM/CSS calcolato, non su una
  controprova visiva diretta — resta un punto aperto da riprovare in una
  sessione futura (vedi "Cosa manca").
- Rilanciata l'intera suite di test (23 file): nessuna regressione.
- **Non toccato**: `tavolo-sfondo.jpg`/le texture non sono state
  ulteriormente ritoccate oltre a resize+ricompressione (nessun crop,
  nessuna modifica di contenuto); `POSTI_TAVOLO` (le percentuali dei posti
  sul tavolo) restano quelle esistenti, non ancora rifinite dal vivo.

---

**12/07/2026 — Esperimenti visivi: sfondo/badge del tavolo (mai documentato prima) + texture dei nodi nei pannelli**
File modificati: `public/index.html`; nuovi asset
`public/img/texture-{1836-torino,1848-milano,1915-carso-piave,emergenza-civile,missione-moderna}.png`.
Questa voce documenta **due esperimenti visivi distinti**, marcati entrambi
"ESPERIMENTO VISIVO (primo passaggio, da valutare)" nel codice: il primo
(sfondo tavolo + badge dei ruoli) era già stato scritto e verificato in una
sessione precedente ma non era mai stato registrato qui — lacuna notata
durante un audit di giocabilità del 12/07/2026, colmata ora insieme al
secondo esperimento appena fatto, perché condividono lo stesso principio
(continuità visiva senza dover disegnare nuove illustrazioni) e lo stesso
pattern tecnico (velo semi-trasparente scuro sopra un'immagine, leggibilità
del testo prioritaria).
- **Sfondo tavolo + badge dei ruoli** (già in `public/index.html`, non
  toccato in questo passaggio, solo documentato ora): `tavolo-sfondo.png`
  come `background-image` di `#schermo-gioco` e `.tavolo-vista`
  (`aspect-ratio: 2816/1536` per allineare le percentuali di `POSTI_TAVOLO`
  ai pixel reali dell'immagine); un badge per ruolo
  (`/img/badge-${ruolo}.png`) renderizzato per ogni posto occupato in
  `renderTavolo()`. Il velo di leggibilità è `.contenuto-scuro`
  (`rgba(var(--bg-rgb), 0.75)`), un contenitore separato sopra l'immagine,
  non un effetto sullo stesso elemento. `POSTI_TAVOLO` marca esplicitamente
  le percentuali dei posti come una stima da aggiustare guardando il
  risultato vero in browser — non ancora rifinite.
- **Texture dei nodi nei pannelli** (nuovo in questo passaggio): obiettivo
  ridurre lo stacco visivo tra l'immagine curata del tavolo e i pannelli
  sottostanti (`.situazione-box`, `.pannello-comandante`), rimasti
  rettangoli scuri anonimi. 5 nuove texture, una per nodo, rinominate
  manualmente dall'autore in `public/img/` — **trovata e corretta prima di
  scrivere codice** una doppia estensione su tutti e 5 i file
  (`texture-1836-torino.png.png` ecc., probabilmente Esplora File che
  aggiungeva `.png` a un nome che lo includeva già): rinominati su
  indicazione esplicita dell'autore (Opzione 1 tra due proposte) per
  restare coerenti con `badge-*.png`/`tavolo-sfondo.png` già presenti.
  - Nodo attivo → texture: nessuna mappa da mantenere, stessa convenzione
    già in uso per i badge (`/img/texture-${nodoId}.png`, come
    `/img/badge-${ruolo}.png`).
  - **Dove esattamente applicare la texture** (unico punto tecnico non
    ovvio dal codice, verificato prima di scrivere): NON sul contenitore
    `#area-nodo`/`#pannello-comandante` (div vuoti che si limitano a
    ospitare l'HTML renderizzato), ma sulle classi con lo sfondo solido
    vero e proprio (`.situazione-box`, `.pannello-comandante`) — altrimenti
    la texture resterebbe nascosta dietro lo sfondo opaco esistente.
  - **Nuova variabile CSS `--texture-nodo-attivo`**, impostata da
    `applicaTexturaNodo(nodoId)` su `#schermo-gioco` (elemento stabile, mai
    ricreato) invece che sugli elementi che vengono rigenerati a ogni
    render (`.situazione-box` viene ricreato da ogni `renderRichiesta()`):
    ereditarietà CSS invece di dover riapplicare lo stile manualmente a
    ogni render. Chiamata sia in `aggiornaSchermataGioco()` sia nel ciclo
    di polling (ogni 6s), stessa cadenza con cui si aggiornano già
    risorse/roster/pannello del comandante.
  - **Velo di leggibilità**: variante dello stesso principio di
    `.contenuto-scuro` (`rgba(var(--bg-rgb), ...)`), ma applicata come
    `linear-gradient` a due fermate identiche nello stesso
    `background-image` invece che su un contenitore separato — scelta per
    non dover restrutturare il markup di `.situazione-box`/
    `.pannello-comandante` in un "primo passaggio". Opacità 0.82 (contro lo
    0.75 di `.contenuto-scuro`): questi pannelli stanno già sopra quel
    velo, serviva qualcosa in più per proteggere il testo su una texture
    potenzialmente più "rumorosa" di un colore piatto. Senza nodo attivo, il
    gradiente resta comunque presente ma con due fermate identiche (tinta
    piatta): visivamente equivalente al vecchio `background: var(--bg-panel)`
    solido, nessuna regressione per lo stato "nessun nodo avviato ancora".
  - **Scope deliberatamente ristretto**: solo `.situazione-box` e
    `.pannello-comandante`, non `.esito-box`/`.esito-finale-box` (mostrati
    dopo una scelta/alla fine del nodo) né i singoli bottoni delle
    risposte (`button.risposta`, riusato anche fuori dal contesto del nodo,
    es. nella proposta di cessione del comando — toccarlo avrebbe avuto
    effetti collaterali fuori scope).
  - Verificato dal vivo con `wrangler dev` su 3 nodi (`1836-torino`,
    `1915-carso-piave`, `missione-moderna`, incluso un cambio nodo dal
    pannello del comandante): `--texture-nodo-attivo` e i
    `background-image` calcolati risultano corretti in tutti e tre i casi
    (via `getComputedStyle`, non solo lettura del codice). **Non è stato
    possibile ottenere una conferma visiva via screenshot**: il pannello di
    preview è andato ripetutamente in timeout, verosimilmente per il peso
    delle immagini `cover` coinvolte (vedi punto sotto) — verifica quindi
    fatta sul DOM reale in esecuzione, non su un mock, ma senza controprova
    visiva diretta.
  - **Osservazione non richiesta, segnalata per completezza**: le 5 texture
    pesano 9-10 MB ciascuna (`tavolo-sfondo.png` da solo pesa già 8,8 MB) —
    con `.situazione-box`/`.pannello-comandante` visibili insieme al tavolo,
    una schermata di gioco con nodo attivo scarica ~19 MB di immagini.
    Nessuna ottimizzazione (compressione, ridimensionamento) fatta in
    questo passaggio: non richiesta, fuori scope per un "primo passaggio
    esperimento" — ma da tenere presente prima di andare in produzione,
    specialmente su connessioni mobili.
- Rilanciata l'intera suite di test (23 file): nessuna regressione (nessun
  file server-side toccato in questo passaggio).

---

**12/07/2026 — Fix: secondo /join nella stessa stanza non sovrascrive più l'identità in silenzio**
File modificati: `public/index.html`, nuovo `test-identita-client.mjs`.
- Bug segnalato dall'autore durante un test manuale: cliccando "Avvia" su un
  nodo compariva a volte "La tua sessione su questo dispositivo non è più
  valida" nonostante fosse l'unico giocatore/comandante. Indagine (senza
  modifiche) confermata in una sessione precedente: `localStorage` usa
  un'unica chiave globale (`"lci_stato"`, nessun namespacing per stanza) e
  ogni `/join` — nella stessa stanza o in una diversa — sovrascriveva
  interamente `giocatoreId`/`token`/`nome`/`comandante` senza controllare se
  un'identità funzionante era già presente. Riprodotto dal vivo con
  `wrangler dev`: un secondo `/join` nella STESSA stanza (es. tornando sulla
  schermata di ingresso e premendo di nuovo "Unisciti") crea un secondo
  giocatore (ospite, non comandante) e sostituisce silenziosamente
  l'identità del comandante in `localStorage` — il comandante reale resta
  valido sul server, ma il dispositivo perde l'accesso alle azioni riservate
  e riceve poi il messaggio fuorviante "sessione non più valida" (in realtà
  un 403 "non sei il comandante", non un problema di sessione).
- **Correzione lato client, come richiesto — nessuna modifica a
  `GameSession.js` o al server**: nuovo campo `STATO.identitaRoomId` (il
  roomId per cui l'identità salvata è valida, separato da `STATO.roomId` che
  indica la stanza verso cui si sta navigando). Prima di ogni `/join`:
  - se `STATO.identitaRoomId` coincide con la stanza di destinazione
    (stessa stanza, identità già presente) → **niente più sovrascrittura
    automatica**: banner di conferma sulla schermata di ingresso ("Risulti
    già presente in questa stanza come X (ruolo). Vuoi continuare come Y
    invece?") con due bottoni — "Continua come Y" esegue il `/join` scelto
    esplicitamente; "Annulla" non chiama `/join`, riporta il dispositivo
    alla partita già in corso con l'identità precedente intatta;
  - se l'identità salvata è per una stanza DIVERSA → **nessun cambiamento
    di comportamento**, si procede come prima (caso legittimo: si è
    lasciata una stanza, se ne raggiunge un'altra).
  Scelta di UX per il banner (chiesta esplicitamente all'autore prima di
  scrivere codice, con tre opzioni: `window.confirm()` nativo, banner inline
  in stile `.errore` già esistente, pannello in stile `renderPromptCessione`
  — **non decisa unilateralmente**): banner inline, riusa la classe
  `.errore` già in uso in tutta la pagina con l'aggiunta di due bottoni.
- **Bug collegato corretto, come richiesto**: `btn-crea-stanza` ora ripulisce
  esplicitamente `nome`/`giocatoreId`/`token`/`comandante`/`competenze`
  (nuova funzione `pulisciIdentita()`) quando l'identità salvata appartiene
  a una stanza precedente, invece di lasciarla "appesa" sotto il nuovo
  `roomId` come faceva prima (aggiornava solo `roomId`/`tokenCreazione`).
- **Bug gemello scoperto e corretto in più, non esplicitamente nominato
  nella richiesta ma stessa causa**: la stessa disattenzione esisteva anche
  in `avvia()` per chi apre un link `?stanza=<altraStanza>` mentre ha ancora
  un'identità di una stanza precedente in `localStorage` — la condizione
  `STATO.roomId && STATO.nome` mandava dritti a `schermo-gioco` per la
  stanza NUOVA usando l'identità VECCHIA (mai un vero `/join` per quella
  stanza). Corretto con la stessa `pulisciIdentita()`. Verificato dal vivo
  che questo, non `btn-crea-stanza` (mai raggiungibile una volta già in una
  stanza, non esiste un bottone "lascia stanza" nella UI attuale), è il
  percorso realisticamente raggiungibile per il pattern "seconda stanza
  sopra la prima" descritto nella segnalazione originale.
- Verificato dal vivo con `wrangler dev`, guidando davvero il browser, tutti
  e tre gli scenari dell'indagine precedente: secondo `/join` nella stessa
  stanza (banner mostrato, "Annulla" non chiama `/join` e torna al gioco con
  l'identità originale intatta, "Continua come..." esegue il `/join` scelto
  e sostituisce l'identità); due tab sullo stesso link (stesso meccanismo di
  `localStorage` condiviso di sopra, copertura equivalente); nuova stanza
  raggiunta con un'identità precedente ancora attiva (identità ripulita,
  schermata di ingresso mostrata invece del salto diretto al gioco).
  Rilanciata l'intera suite (23 file): nessuna regressione.
- Nuovo `test-identita-client.mjs`: prima volta che un test tocca la logica
  di `public/index.html` (finora testata solo manualmente/dal vivo, nessun
  file `test-*.mjs` esistente la toccava). `public/index.html` non è un
  modulo (HTML con `<script>` inline, nessun `export`): il test estrae il
  testo delle tre funzioni pure coinvolte (`identitaValida`,
  `pulisciIdentita`, `identitaEsistentePerStanzaCorrente` — nessuna tocca il
  DOM) direttamente dal file reale con una regex ed esegue quel testo in un
  contesto `vm` isolato di Node, invece di duplicarle a mano in un fixture
  separato — resta sincronizzato con l'implementazione vera senza bisogno di
  un bundler o di un browser headless.
- **Non toccato, come richiesto**: `GameSession.js`, nessuna rotta del
  server, il messaggio "sessione non più valida" per i casi di 401/403
  legittimi (token davvero corrotto, davvero non comandante) resta
  invariato — un messaggio più preciso per distinguere questi casi resta un
  passo successivo separato, non ancora affrontato.

---

**12/07/2026 — Secondo tiro reale nel nodo 1848-milano: Precisione (Incursore) su `milano-ferito`**
File modificati: `src/game-config.js`, `src/lib/narratore-1848-milano.md`,
`test-narratore-1848-milano.mjs`.
- Richiesta dall'autore dopo un audit di giocabilità: delle 5 competenze del
  gioco, Precisione (competenza principale dell'Incursore) non era mai
  richiesta da nessuna delle 5 risposte a tiro reale esistenti (una per
  nodo). Convertita a tiro reale la risposta "Lo disarmate e proseguite,
  lasciandolo dove sta" nella richiesta `milano-ferito` (nodo `1848-milano`,
  indice 1 nell'array `risposte`) — scelta tra le risposte fisse candidate
  perché narrativamente la più coerente con un gesto tecnico/di mira (le
  altre risposte fisse esaminate, negli altri 4 nodi, non si prestavano).
  Nuovo testo: "Lo disarmate con un gesto solo. Pulito. Poi proseguite,
  lasciandolo dove sta." `competenzaRichiesta: "precisione"`,
  `effettiPerEsito` su Cadenza (in continuità con l'effetto fisso precedente,
  `{ cadenza: 1 }`) + margine 1/2/3 come tutte le altre risposte a tiro
  reale — **questi numeri sono stati dedotti dal pattern esistente, non
  dettati dall'autore: da rivedere alla prima verifica dal vivo**, stesso
  trattamento riservato a tutti gli altri numeri di bilanciamento in questo
  file.
- **Problema scoperto prima di scrivere il pool**: `narratore-1848-milano.md`
  aveva UN solo tiro reale quando è stato scritto (`milano-barricata`), e le
  tabelle "Baseline per esito" (apertura/sviluppo/eco) sono di fatto
  scritte per QUELLA scena specifica, non per il nodo in astratto — es.
  `apertura-pieno-1` cita esplicitamente "la carica ha trovato il punto
  debole". Il contesto passato al Cronista da `GameSession.js` non porta
  `richiestaId` (solo `esito`, `competenzaId`, `ruoloId`, `margine`,
  `variabili`, `storicoFrammenti`): il motore non ha modo di sapere quale
  richiesta ha generato il tiro, quindi non può escludere i frammenti
  scritti per la barricata quando il tiro è sul disarmo.
- **Decisione esplicita dell'autore, tra tre opzioni proposte**: **Opzione
  2** — scrivere frammenti propri per il disarmo in tutti e tre gli slot
  (non solo `sviluppo`), condizionati su `esito` + `competenzaId:
  precisione`, aggiunti ACCANTO al baseline della barricata (mai in sua
  sostituzione). Scartate: Opzione 1 (frammenti solo in `sviluppo`, più
  rapida ma rischio di mescolamento anche lì) e Opzione 3 (aggiungere un
  asse `richiestaId` al contesto — risolverebbe il problema alla radice ma
  richiede toccare `GameSession.js`, il "motore neutro").
  **Conseguenza accettata consapevolmente**: il mescolamento resta
  possibile, solo ridotto di probabilità — i baseline della barricata
  restano candidati anche per il tiro sul disarmo (verificato e testato
  esplicitamente in `test-narratore-1848-milano.mjs`, non è un bug).
- `narratore-1848-milano.md`: aggiunte 3 nuove tabelle "Per competenza ed
  esito (disarmo — Precisione)", una per slot — 6 righe in `apertura`, 3 in
  `sviluppo` (la riga esistente `sviluppo-competenza-precisione`, senza
  colonna `esito`, resta valida e continua a comparire per qualunque
  esito), 6 in `eco`. Conteggio frammenti per slot: apertura 10→16,
  sviluppo 11→14, eco 8→14.
- `test-narratore-1848-milano.mjs`: conteggi aggiornati, nuove asserzioni
  per la combinazione `competenzaId: precisione` in tutti e tre gli slot
  (candidati attesi presenti), verifica esplicita che il mescolamento con
  il baseline della barricata sia presente e accettato (non una
  regressione), e verifica dal vivo su 100 tentativi per esito che il
  testo composto includa almeno una volta un frammento di disarmo.
- **Non toccato**: `src/lib/interprete-libero/1848-milano/milano-ferito.js`
  — verificato che la libreria del testo libero mappa solo
  `testoLibero → risposteIndice`, indipendente dal fatto che la risposta
  risultante sia a tiro o a effetto fisso (la differenza è gestita
  interamente da `GameSession.applicaRisposta()`, chiamata identica in
  entrambi i casi). `GameSession.js` non toccato per decisione esplicita
  (vedi sopra, Opzione 3 scartata per ora).
- Rilanciata l'intera suite (22 file): nessuna regressione.
- **Miglioria futura aperta (Opzione 3, non implementata)**: aggiungere un
  campo `richiestaId` al contesto passato da `GameSession.js` a
  `componiNarrazione()` (dato opaco, come già `competenzaId`/`ruoloId` —
  non violerebbe la regola del motore neutro), più una colonna `richiestaId`
  sulle righe dei pool `.md` che oggi sono implicitamente legate a una sola
  scena. Risolverebbe alla radice il problema del mescolamento tra scene
  diverse nello stesso nodo — utile da riconsiderare se in futuro si
  aggiungono altri tiri reali allo stesso nodo (oggi solo `1848-milano` ne
  ha due; gli altri 4 nodi restano a un tiro ciascuno, quindi il problema
  non si presenta ancora lì).
  → implementata il 13/07/2026, commit `a33880c` (vedi "Cosa manca").

---

**12/07/2026 — Riconoscimento del grado nel gameplay (2 punti, dopo il sistema di token) — COMPLETO, pushato su main**
Commit: `ec1fb5b` (badge nel roster), `2e32b12` (prefisso nel nome).
File modificati: `public/index.html`, `src/index.js`, `src/lib/profili-giocatore.js`,
`test-profili-giocatore.mjs`.
- Solo visualizzazione: **nessun nuovo effetto meccanico** legato al grado —
  il bonus +1/competenza di Fase 4 resta l'unico effetto numerico, decisione
  presa esplicitamente per non far pesare il divario tra veterani e
  pubblico nuovo (il gioco è pensato anche per promozione a sconosciuti).
- **Badge nel roster** (`ec1fb5b`): nuovo `otteniGradiProfili(db,
  profiloIds)` in `profili-giocatore.js` — una query in blocco (`WHERE id
  IN (...)`), riusa `calcolaGrado` già esistente (bonusScelti non serve,
  solo `gradoNome`). Nuovo `POST /profilo/gradi`, nessuna verifica di
  possesso: il grado non è più sensibile di nome/ruolo, già pubblici a
  tutta la stanza. Lato client, `GRADI_CACHE` (per profiloId) evita una
  richiesta a ogni tick di polling (6s): si recuperano solo i profiloId
  mai visti, tranne subito dopo la chiusura di un nodo (forzato, unico
  momento in cui l'XP cambia). Verificato dal vivo: un profilo a 1800 XP
  mostra "— Esploratore Capitano" nel roster, un ospite nessun grado,
  nessuna nuova richiesta di rete su un tick di polling atteso dal vivo.
- **Prefisso di grado nel nome** (`2e32b12`): **premessa verificata prima
  di implementare** (richiesta dall'autore esplicitamente prima di
  scegliere il punto d'innesto) — né il Cronista (`componiNarrazione`,
  unico placeholder valorizzato oggi è `{ruolo}`) né l'interprete di testo
  libero compongono mai testo con il nome del giocatore. L'UNICO punto
  reale è stato quindi la proposta di cessione del comando in
  `public/index.html` (`nomeProponente`). Nuova funzione client
  `nomeConGrado(giocatore)`: "Grado Nome" se il giocatore ha un profiloId
  E il grado è sopra il base; altrimenti solo "Nome" — nessun titolo per
  grado base "Bersagliere" o per ospiti, scelta fatta e segnalata
  all'autore (un titolo per chiunque abbia un profilo, anche a XP zero,
  segnalerebbe solo "ha un profilo", non un progresso reale).
  `storicoScelte` (altro candidato considerato, richiesto esplicitamente
  di verificare) **non è mai mostrato in UI**, solo nello stato interno
  della stanza: scartato, come da istruzione se risultava un dettaglio
  solo tecnico. Verificato dal vivo (due tab dello stesso browser
  condividono `localStorage`, stesso limite già noto: verificato invece
  chiamando `renderPromptCessione` direttamente in console con dati
  reali) tre casi: profilo graduato → "Capitano Rossi vuole cederti il
  comando"; ospite → invariato; profilo a grado base → invariato.
- Rilanciata l'intera suite di test dopo entrambi i punti: nessuna
  regressione.

**12/07/2026 — Token di sessione per il profilo persistente (3 passi) — COMPLETO, pushato su main**
Commit: `81eb548` (Passo 1: emissione e storage), `32505c9` (Passo 2:
verifica al `/join`), `aad64ca` (Passo 3: client + logout).
Nuovi file: `test-join-profilo-token.mjs`.
File modificati: `schema.sql`, `src/lib/profili-giocatore.js`,
`src/durable-objects/GameSession.js`, `src/index.js`, `public/arruolati.html`,
`public/index.html`, `test-profili-giocatore.mjs`, `test-game-session.mjs`,
`test-xp-completamento-nodo.mjs`, `test-bonus-grado-tiro.mjs`.
Chiude il rischio di impersonazione segnalato come nota aperta dopo il
Passo 3 dell'UI di accesso (sotto): fino ad allora un profiloId dichiarato
al `/join` non richiedeva alcuna prova di possesso.
- **Passo 1**: struttura dati proposta e scelta con una riga di
  motivazione (come richiesto), non decisa unilateralmente: tabella
  dedicata `sessioni_profilo` invece di colonne su `giocatori_persistenti`
  — una riga per SESSIONE, non per profilo, così più dispositivi possono
  restare collegati insieme e un nuovo login non invalida gli altri
  (coerente con "revoca solo tramite logout esplicito"). Token da 256 bit
  (`crypto.getRandomValues`, non `Math.random`), salvato in D1 SOLO come
  hash SHA-256 (non iterato: il token è già ad alta entropia, a differenza
  del PIN), scadenza 30 giorni. `/profilo/registra`/`/profilo/accedi`
  restituiscono ora anche `token`+`tokenScadenza`. Migrazione (nuova
  tabella, `CREATE TABLE IF NOT EXISTS` basta) applicata e verificata solo
  in locale.
- **Passo 2**: punto di formato chiarito con l'autore PRIMA di
  implementare (non deciso unilateralmente) — nome del campo `profiloToken`
  invece di `token`, per non confondersi con il token in-partita già
  esistente sullo stesso endpoint `/join`. Il profiloId si ricava SOLO
  verificando `profiloToken` contro `sessioni_profilo` (hash + scadenza) —
  un profiloId dichiarato a parte, senza token valido, viene SEMPRE
  ignorato da questo passo in poi (comportamento diverso dalla Fase 2,
  segnalato esplicitamente come cambiamento, non un dettaglio silenzioso).
  Fallback sempre silenzioso a ospite: token assente, scaduto, inesistente,
  o un fallimento D1 isolato non bloccano mai il join. Aggiornati i test
  esistenti che usavano il vecchio profiloId diretto
  (`test-xp-completamento-nodo.mjs`, `test-bonus-grado-tiro.mjs`,
  `test-game-session.mjs`) per impostarlo direttamente sullo storage dove
  serviva solo come precondizione di setup, non l'oggetto del test.
- **Passo 3**: `arruolati.html` salva nome+profiloToken+scadenza in
  `localStorage`, mai più il PIN né il profiloId puro. `index.html` passa
  `profiloToken` al `/join`; la scadenza è controllata SOLO lato client al
  caricamento (nessuna chiamata preventiva al server) — un token scaduto
  si ripulisce da solo, il giocatore torna al percorso ospite senza
  errori. Nuovo `POST /profilo/logout` (`invalidaSessioneProfilo`):
  cancella la riga in `sessioni_profilo`, idempotente. "Non sei tu?
  Continua come ospite" ora lo chiama (best-effort: lo scollegamento
  locale avviene comunque anche se la richiesta di rete fallisce).
- **Finestra temporanea segnalata e poi richiusa**: tra il push del Passo
  2 e quello del Passo 3, il client (ancora sul vecchio comportamento)
  passava un `profiloId` che il server ignorava silenziosamente — gli
  utenti già collegati sarebbero entrati come ospiti finché il Passo 3 non
  fosse stato pushato. Segnalato esplicitamente all'autore subito dopo il
  push del Passo 2.
- Verificato dal vivo con `wrangler dev` a ogni passo (registrazione/login
  con token reale, join con `profiloId` derivato correttamente dal token,
  `profiloId` dichiarato a mano ignorato, token falso → ospite, logout →
  riga cancellata da D1 verificata con query diretta, token scaduto
  ripulito automaticamente al caricamento). Rilanciata l'intera suite
  dopo ogni passo: nessuna regressione.

**12/07/2026 — UI di accesso reale (4 passi) — COMPLETA, pushata su main**
Commit: `04a8b76` (Passo 1: link "Arruolati" + placeholder), `aa55517`
(Passo 2: schermate vere di login/registrazione), `407d132` (Passo 3:
collegamento del profilo al `/join`), `47d1e0b` (Passo 4: invito
post-sessione per gli ospiti).
Nuovi file: `public/arruolati.html`.
File modificati: `public/index.html`.
- **Passo 1**: link discreto "Arruolati — hai già un profilo?" su
  schermo-codice e schermo-join (vive dentro le sezioni `.schermo`, non
  nell'header condiviso: sparisce da solo durante la partita, senza
  logica JS dedicata). **Premessa verificata prima di implementare**: il
  repo non ha (e non aveva) un campo per digitare manualmente un "codice
  stanza" — solo un link con roomId, il commento nel codice dice
  esplicitamente "nessun codice richiesto" — quindi "codice stanza" nella
  richiesta originale è stato interpretato come il meccanismo già
  esistente (link/roomId), non come una nuova UI da costruire; percorso
  ospite lasciato **invariato nella sostanza**, come richiesto.
- **Passo 2**: placeholder sostituito con login/registrazione veri (tab
  Accedi/Registrati), chiamano `/profilo/accedi`/`/profilo/registra` di
  Fase 1 senza toccarli. Validazione client minima (nome non vuoto, PIN a
  6 cifre), pulsante disabilitato al click fino alla risposta, errori
  mostrati con il testo già non tecnico del server.
- **Passo 3**: dopo login/registrazione, profiloId (poi migrato a
  profiloToken, vedi sopra) salvato in `localStorage` — **decisione presa
  con l'autore prima di implementare** tra query string e `localStorage`
  condiviso (stesso origin tra `arruolati.html` e `index.html`): scelto
  `localStorage`, nessuna esposizione in URL/cronologia, e il PIN non
  serviva comunque (in quel momento `/join` non verificava il possesso).
  Indicatore "Accesso come..." su schermo-join con opzione "Non sei tu?
  Continua come ospite".
- **Passo 4**: **premessa segnalata e verificata prima di implementare**
  — la richiesta assumeva un numero di XP/grado già visibile in game a
  quel punto; verificato che non esisteva (`applicaRisposta()` non
  restituisce mai dati XP al client, nessuna occorrenza in
  `public/index.html`). Scelta l'opzione di non toccare `GameSession.js`
  (confermata dall'autore): invito narrativo agganciato alla schermata di
  fine nodo esistente (`.esito-finale-box`), solo per ospiti, nome scelto
  in partita passato come suggerimento in query string al ritorno su
  `arruolati.html` (mai dati sensibili).
- Verificato dal vivo con `wrangler dev` a ogni passo. Rilanciata l'intera
  suite dopo ogni passo: nessuna regressione (i test non toccano
  `public/`, verificato comunque per sicurezza).

**12/07/2026 — Passo 24: profilo giocatore persistente, Fase 4 di 4 (grado, bonus, applicazione al tiro) — COMPLETA, pushato su main**
Nuovi file: `public/profilo.html`, `test-bonus-grado-tiro.mjs`.
File modificati: `src/lib/profili-giocatore.js`, `src/durable-objects/GameSession.js`,
`src/index.js`, `test-profili-giocatore.mjs`, `DECISIONI_LA_CORSA_INVISIBILE.md`.
Commit `09d6140`, pushato su `main` con conferma esplicita dell'autore
(deploy automatico Cloudflare avviato). Lavoro fatto in 4 passi separati,
ognuno mostrato in diff/comportamento dal vivo e confermato dall'autore
prima di passare al successivo (metodo concordato per questo repo).

- **Passo 1 (calcolo grado + lettura stato)**: prima di scrivere codice,
  chiesta e ottenuta la lista dei 10 nomi di grado (non presente né in
  `game-config.js` né nel log) — gerarchia reale dei Bersaglieri
  (Bersagliere → Bersagliere Scelto → Caporale → Caporal Maggiore →
  Sergente → Sergente Maggiore → Maresciallo → Sottotenente → Tenente →
  Capitano), scelta esplicitamente dall'autore invece di una inventata.
  `calcolaGrado(xpTotale, bonusScelti)` in `profili-giocatore.js`:
  interpretazione della soglia "N×200 XP cumulativi" proposta (salire dal
  grado N al grado N+1) **poi confermata dall'autore** in un passaggio
  successivo, non decisa unilateralmente. Bonus disponibili calcolati
  SEMPRE al volo (traguardi di grado raggiunti − lunghezza di
  `bonusScelti.assegnati`), mai un contatore ridondante. Nuova
  `otteniStatoProfilo(db, profiloId, pin)` + endpoint `POST /profilo/stato`:
  stessa autenticazione profiloId+PIN di `/profilo/accedi` (nessun token di
  sessione per i profili) — scelta **confermata** dall'autore, resta così.
  `normalizzaBonusScelti()`: gestisce sia il vecchio `bonus_scelti` bare
  array `'[]'` (Fase 1, mai popolato con contenuto reale) sia il nuovo
  `{"assegnati":[...]}`, senza bisogno di nessuna migrazione D1 per questo
  passo.
- **Passo 2 (`POST /profilo/assegna-bonus`)**: `assegnaBonusProfilo()`
  ricalcola SEMPRE da xp_totale/bonus_scelti appena letti da D1, prima di
  scrivere, se c'è davvero un bonus disponibile — non si fida mai di quanto
  dichiarato dal client. Competenza validata contro `GAME_CONFIG.competenze`
  (import in `profili-giocatore.js`, non uno dei 3 file "neutri" del motore
  — legittimo, stessa fonte unica di verità del resto del gioco). **Punto
  di design segnalato e accettato esplicitamente dall'autore**: nessuna
  protezione server-side contro una corsa concorrente vera (due richieste
  quasi simultanee che leggono entrambe "1 disponibile" e scrivono
  entrambe) — stesso livello di robustezza già presente in
  `assegnaXpCompletamentoNodo` (Fase 3); il rischio pratico (doppio
  click/tap) viene mitigato lato UI nel Passo 3, non lato server.
- **Passo 3 (`public/profilo.html`)**: prima di costruire la UI, verificato
  che la premessa "schermata profilo già esistente" (dal riepilogo di
  inizio sessione) **non corrispondeva allo stato reale del repo** — nessun
  riferimento a profilo/login/XP in `public/index.html`, né in git log,
  branch o stash. Segnalato esplicitamente invece di costruire silenziosamente
  sopra una premessa sbagliata; l'autore ha confermato di voler procedere
  con una schermata **di solo test** (`public/profilo.html`, pagina
  standalone, stesso stile visivo di `index.html` ma script/stato separati),
  che assume un profiloId+PIN già noti inseriti a mano — login/registrazione
  vera restano esplicitamente FUORI da questo passo, da pianificare a parte.
  Mostra grado (nome + barra XP verso il prossimo grado, o "grado massimo
  raggiunto" per il Capitano), bonus già assegnati, e — se disponibile — un
  selettore di competenza (da `GAME_CONFIG.competenze`) con un bottone
  "Conferma" dedicato. Mitigazione della corsa concorrente richiesta
  dall'autore: il bottone si disabilita SUBITO al click (prima della
  chiamata di rete), si riabilita solo nel `finally` dopo la risposta del
  server (successo o errore) — **verificato dal vivo con `wrangler dev`**:
  esaurito un profilo di tutti i bonus disponibili via API mentre la
  schermata restava aperta con lo stato precedente (stantio), poi cliccato
  "Conferma": il server ha rifiutato con l'errore già in italiano non
  tecnico (`"Nessun bonus disponibile da assegnare"`), il bottone si è
  riabilitato, nessuna doppia scrittura.
- **Passo 4 (applicazione del bonus al tiro in `GameSession.js`)**: nuova
  `otteniCompetenzeBonificate(db, profiloId)` in `profili-giocatore.js`
  (legge `bonus_scelti.assegnati`, nessuna verifica PIN — non è un'azione
  utente, è un dettaglio interno del calcolo del punteggio). Nuovo metodo
  `GameSession.calcolaBonusGrado(giocatore, competenzaId)`: corto circuito a
  0 se `profiloId` è `null` o `env.DB` manca (nessuna query inutile), +1 se
  la competenza è bonificata, try/catch che isola un vero fallimento D1
  (log + 0, il tiro procede comunque) — stesso principio già seguito in
  `assegnaXpNodoCompletato` (Fase 3). Innestato in `applicaRisposta()` con
  una sola riga (`punteggio += await this.calcolaBonusGrado(...)`), PRIMA
  del calcolo delle facce del dado di ruolo: **trasversale al ruolo**
  scelto in QUESTA stanza, mai collegato al ruolo che il giocatore aveva
  quando ha guadagnato il bonus (deciso esplicitamente dall'autore, non
  riaperto in fase di implementazione). **Verifica pre-push richiesta
  esplicitamente dall'autore** (non standard per gli altri passi):
  ri-mostrato il codice di `calcolaBonusGrado`, il punto esatto d'innesto
  in `applicaRisposta()` e `otteniCompetenzeBonificate` più volte prima del
  via libera al push — nessuna modifica emersa da questa verifica, solo
  conferma.
- `test-bonus-grado-tiro.mjs` (10 verifiche, tutte passate): stesso pattern
  di `test-scegli-risoluzione.mjs` (nodo di prova sintetico, ruolo Custode
  per isolare il bonus dall'override del dado di ruolo) e di
  `test-xp-completamento-nodo.mjs` (fake D1 con modalità "guasto"). Copre:
  competenza bonificata (+1 confermato), competenza non bonificata
  (invariato), giocatore senza `profiloId` (invariato, **e verificato che
  D1 non viene nemmeno interrogato** — corto circuito), fallimento D1
  simulato (isolato, tiro comunque completato), binding D1 assente (stesso
  trattamento).
- **Verificato dal vivo con `wrangler dev`, non solo nei test simulati**
  (per tutti e 4 i passi): Passo 1/2/3 con un profilo di prova reale
  (registrato, XP forzato via query diretta su D1 locale, poi ripulito) —
  caricamento stato, assegnazione bonus, errori 401/409 mostrati
  correttamente in UI. Passo 4: confrontati due tiri reali sulla stessa
  risposta a tiro di `1836-torino` (`decalogo-ginnastica`, ruolo Custode)
  tra un giocatore con `profiloId`+bonus su Cadenza e uno senza `profiloId`
  nella stessa stanza-tipo: `tiro.competenza = 2` contro `= 1` — differenza
  di esattamente 1, come atteso.
- Rilanciata l'intera suite (21 file) dopo ogni passo: nessuna regressione
  in nessun momento.
- **Con questo la Fase 4 di 4 è completa**: il profilo giocatore
  persistente ha ora schema, login/registrazione via API (Fase 1),
  collegamento opzionale a `/join` (Fase 2), XP automatico a fine nodo
  (Fase 3), e grado/bonus di competenza applicati al tiro (Fase 4).
  **Resta esplicitamente da fare** (non ancora pianificato in dettaglio,
  vedi "Cosa manca"): una UI reale di login/registrazione in `public/`
  collegata al flusso di `/join` (oggi solo `public/profilo.html` di test,
  pagina separata) e la verifica che il `profiloId` dichiarato corrisponda
  a un login realmente avvenuto (rimandata dalla Fase 2).

**12/07/2026 — Passo 23: profilo giocatore persistente, Fase 3 di 4 (XP al completamento di un nodo)**
Nuovi file: `migrations/0001_nodi_completati.sql`, `test-xp-completamento-nodo.mjs`.
File modificati: `schema.sql`, `src/lib/profili-giocatore.js`,
`src/durable-objects/GameSession.js`, `DECISIONI_LA_CORSA_INVISIBILE.md`.
- Decisioni già prese dall'autore, implementate così com'erano (non
  rimesse in discussione): XP assegnato SOLO al completamento strutturale
  di un nodo (mai a discrezione del comandante); tutti i giocatori con
  `profiloId` nella stanza ricevono XP, indipendentemente da ruolo o
  quante scelte hanno fatto; 100 XP per nodo, una sola volta per sempre
  per coppia profiloId+nodo (anche rigiocando lo stesso nodo in un'altra
  stanza in futuro).
- **Punto esatto del completamento nodo, cercato non inventato**:
  `applicaRisposta()` in `GameSession.js`, blocco `if (!prossimaRichiesta)`
  — già usato per `valutaEsitoNodo()` e per chiudere il `diario`. Stesso
  identico blocco per `/scegli` e `/risolvi-interpretazione` (condividono
  `applicaRisposta`): aggiungendo l'XP lì, entrambi i percorsi sono coperti
  senza duplicare nulla.
- **Verificato, non modificato**: `env.DB` è già accessibile da
  `GameSession.js` senza toccare `wrangler.toml` — i Durable Object dello
  stesso script Worker (`GameSession` è esportato da `src/index.js`)
  ricevono lo stesso oggetto `env` di tutto il resto del Worker, binding D1
  incluso. Prima volta che un Durable Object di questo progetto scrive su
  D1 (finora gestiva solo lo stato isolato della propria stanza).
- Due punti di design non ovvi, proposti e confermati con l'autore prima
  di implementare (**non decisi unilateralmente**):
  1. **Migrazione dello schema su una tabella già popolata in
     produzione**: `schema.sql` da solo non basta (`CREATE TABLE IF NOT
     EXISTS` non tocca una tabella che esiste già) — aggiunta la colonna
     al `CREATE TABLE` in `schema.sql` (per chi parte da un DB nuovo) E un
     nuovo file separato `migrations/0001_nodi_completati.sql` con il solo
     `ALTER TABLE ... ADD COLUMN`, da eseguire una tantum su locale e poi
     (a parte, con conferma esplicita) su remoto. **Prima migrazione
     incrementale del progetto**: introdotta la cartella `migrations/`,
     che finora non esisteva.
  2. **Fallimento D1 durante l'assegnazione XP**: try/catch INDIVIDUALE
     per ogni giocatore (non uno unico attorno a tutto il ciclo) — se D1
     fallisce per un giocatore, l'errore finisce in `console.error` (log
     di Cloudflare) ma gli altri giocatori della stanza vengono comunque
     processati, e il completamento del nodo (esito, chiusura diario,
     risposta HTTP) non dipende MAI dalla riuscita dell'assegnazione XP.
     Se il binding `env.DB` manca del tutto (es. nei test che non lo
     configurano), un solo log generico invece di uno per giocatore.
- `src/lib/profili-giocatore.js`: nuova `assegnaXpCompletamentoNodo(db,
  profiloId, nodoId)` — UNA query di lettura (`nodi_completati` per
  quell'id) per decidere se assegnare, UNA query di scrittura (`UPDATE`
  che aggiorna `nodi_completati` E `xp_totale` insieme) se non già
  presente. Nuova costante esportata `XP_PER_NODO = 100`. Ritorna esiti
  normali (`{ assegnato: true|false, motivo }`), mai un'eccezione per
  "profilo non trovato" o "già completato" — sono casi attesi, non errori.
- `src/durable-objects/GameSession.js`: nuovo metodo
  `assegnaXpNodoCompletato(session)`, chiamato una volta sola dentro il
  blocco di chiusura nodo. Filtra `session.giocatori` per `profiloId !=
  null`, poi un `try/catch` per giocatore attorno alla chiamata al modulo
  di dominio.
- `schema.sql`: colonna `nodi_completati TEXT NOT NULL DEFAULT '[]'` su
  `giocatori_persistenti`, stesso pattern JSON di `bonus_scelti`.
  **Migrazione non ancora applicata né a locale né a remoto in questa
  sessione** — da fare a parte, con conferma esplicita per il remoto come
  di consueto.
- `test-xp-completamento-nodo.mjs` (16 verifiche, tutte passate): nodo di
  prova sintetico a una sola richiesta/risposta (si chiude al primo
  `/scegli`), fake D1 dedicato con righe pre-seminabili e una modalità
  "guasto" che fa lanciare ogni query. Copre le 4 richieste esplicite
  (XP assegnato + nodo registrato, giocatore senza profiloId non tocca
  nulla, nodo già completato non assegna due volte, fallimento D1 non
  blocca il completamento) più un caso di binding D1 del tutto assente, e
  un caso con 3 giocatori nella stessa stanza (uno nuovo, uno già
  completato, uno anonimo) per verificare che vengano processati in modo
  indipendente.
- Rilanciata l'intera suite (20 file) prima e dopo la modifica: nessuna
  regressione. I due `console.error` attesi (fallimento D1 simulato,
  binding assente) compaiono SOLO nei test dedicati a quegli scenari, mai
  nei test pre-esistenti (nessuno di essi usa `profiloId`, quindi il nuovo
  codice non si attiva per loro).
- Non toccato, come richiesto: `/join` e il collegamento `profiloId`
  (Fase 2), `autenticaGiocatore()`/`autenticaComandante()`.
- **Resta da fare (fase successiva, non ancora discussa)**: applicare la
  migrazione a locale e remoto; UI in `public/` che mostri XP/nodi
  completati al giocatore; uso reale di `bonusScelti` nel gameplay.

**12/07/2026 — Passo 22: profilo giocatore persistente, Fase 2 di 4 (collegato opzionalmente a /join)**
File modificati: `src/durable-objects/GameSession.js`, `test-game-session.mjs`,
`DECISIONI_LA_CORSA_INVISIBILE.md`.
- Collega il profilo persistente (tabella `giocatori_persistenti`, endpoint
  `/profilo/registra`/`/profilo/accedi` dal Passo 21) al flusso di ingresso
  in una stanza: `POST /join` accetta ora un `profiloId` opzionale nel
  body e lo salva sul record del giocatore in `session.giocatori`. Login
  resta facoltativo — un giocatore entra come sempre se non lo passa.
- **Esplicitamente NON toccato, come richiesto**: `autenticaGiocatore()`,
  `autenticaComandante()`, la logica dei token in-game (Passo 19/20). Il
  profilo persistente si aggancia accanto, non sostituisce
  l'autenticazione di stanza. Nessuna verifica che `profiloId` corrisponda
  a un login realmente avvenuto — è rimandata a una fase successiva, se
  risulterà necessaria: qui è solo un dato che il client dichiara di avere
  dopo aver già completato login/registrazione altrove (schermata
  separata, decisione presa a monte di questa fase).
- **Punto di lettura, non di decisione**: la richiesta specificava che dopo
  la migrazione va bene sia `profiloId` assente sia `null` — non era
  un'ambiguità da chiarire con l'autore. Scelto comunque un backfill
  esplicito a `null` in `migrateState()` (mai fatto finora per un campo
  per-giocatore, solo per campi a livello di sessione: nuovo precedente,
  segnalato qui per trasparenza, non deciso silenziosamente).
- `initState()`: aggiornato il commento sulla forma di un giocatore
  (`{ id, nome, ruolo, competenze, comandante, token, profiloId }`).
- `migrateState()`: nuovo blocco che itera `session.giocatori` e imposta
  `profiloId = null` su ogni record che non ce l'ha ancora (stanze create
  prima di questa modifica) — stesso meccanismo di persistenza (`changed`
  + `storage.put`) già usato per i campi a livello di sessione, esteso per
  la prima volta dentro l'array.
- `sessionPubblica()` non modificata: filtra solo `token` da ogni
  giocatore, `profiloId` passa già attraverso senza bisogno di codice
  nuovo. Verificato esplicitamente nei test che `GET /state` non esponga
  MAI `pin_hash`/`pin_salt`/altri campi del profilo (xp, bonus) — non
  potrebbe comunque succedere, dato che `GameSession.js` non importa
  `profili-giocatore.js` in questa fase e non tocca mai quelle colonne,
  ma la richiesta chiedeva di verificarlo esplicitamente, non solo per
  costruzione.
- Test aggiunti in `test-game-session.mjs`: `/join` con `profiloId` lo
  mantiene sul record; `/join` senza `profiloId` funziona identico a prima
  (nessuna regressione) e il campo diventa `null`, non resta assente;
  `GET /state` espone `profiloId` quando presente e non espone mai
  `token`/`pin_hash`/`pin_salt`/`xpTotale`/`bonusScelti`; migrazione
  verificata scrivendo a mano nello storage un record senza `profiloId`
  (simula una stanza pre-esistente) e controllando che dopo una chiamata
  `GET /state` il campo diventi `null` E che la modifica sia persistita su
  storage, non solo restituita in memoria.
- Rilanciata l'intera suite (19 file): nessuna regressione.
- **Resta da fare (fasi successive, non ancora discusse)**: eventuale
  verifica di possesso del `profiloId` dichiarato a `/join`; UI in
  `public/` per far scegliere al giocatore se accedere con un profilo
  prima di entrare in stanza; uso reale di `xpTotale`/`bonusScelti` nel
  gameplay.

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
