# La Corsa Invisibile — Log delle decisioni

Aggiornato al: 10 luglio 2026 (fine sessione, dopo il Passo 8 — lavoro sospeso qui su richiesta)

Questo file serve a non perdersi tra una sessione di lavoro e l'altra: raccoglie cosa
è stato deciso, cosa è ancora un'ipotesi da confermare, e cosa manca. Va aggiornato
ogni 3-4 passaggi di lavoro, non a ogni singola modifica.

**Punto di ripresa**: `risoluzione.js` è ora collegato al flusso di
`/scegli` (Passo 8). Una risposta può dichiarare `competenzaRichiesta:
"<id>"` invece di (o accanto a) un effetto fisso: quando presente, il
punteggio del giocatore che sceglie (`giocatoreId`, tracciato dal Passo 7)
decide un tiro pieno/parziale/fallimento, che seleziona quali
`effettiPerEsito` applicare e quale `esito` (ora un oggetto per tier)
mostrare. Le risposte senza `competenzaRichiesta` restano a effetto fisso
come sempre — **le due forme convivono nello stesso nodo, nessuna risposta
reale nei 5 nodi è stata convertita** (decisione deliberata: questo passo
riguardava il motore, non il contenuto). `/join` ora assegna competenze
reali al giocatore (`creaCompetenzeIniziali`, nessun punto extra) invece di
`competenze: {}` come prima.
**Il Cronista resta scollegato**: il pool per `1836-torino` (Passo 5-6) può
finalmente ricevere un `esito` pieno/parziale/fallimento vero da una
risposta con tiro, ma nessuna risposta reale nei nodi lo genera ancora —
serve scrivere risposte con tiro nei nodi esistenti (o nuovi) perché il
collegamento al Cronista abbia qualcosa da consumare.
**Bug noto, non ancora corretto**: `public/index.html` non manda ancora
`giocatoreId` a `/scegli` (né lo salva dopo `/join`) — ogni scelta fatta
dall'interfaccia reale prende 400 così com'è oggi. Va sistemato quando si
riprende il lavoro sull'interfaccia (vedi "Cosa manca").
Restano da confermare: la definizione del Margine, e poi codice del libro /
chat / chiamata vocale (vedi sotto) — invariato dal Passo 3.

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
- [ ] Scrivere almeno una risposta reale con tiro in un nodo esistente (es.
      `1836-torino`) — serve perché il collegamento del Cronista (punto
      sotto) abbia un `esito` vero da consumare, non solo quello dei test
- [ ] Collegare il Cronista a `GameSession.js` — sbloccato solo dopo il punto sopra
- [ ] Pool di frammenti narrativi veri per gli altri 4 nodi (Milano, Carso/Piave,
      Emergenza civile, missione moderna)
- [ ] **`public/index.html` non manda `giocatoreId` a `/scegli`** (né lo
      salva dopo `/join`) — dopo il Passo 7, ogni scelta fatta dall'interfaccia
      reale prende 400 così com'è oggi. Da correggere quando si riprende il
      lavoro sull'interfaccia: salvare l'id restituito da `/join` in `STATO`
      e includerlo nel body di `/scegli`
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
