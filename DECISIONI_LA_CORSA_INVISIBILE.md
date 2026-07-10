# La Corsa Invisibile — Log delle decisioni

Aggiornato al: 10 luglio 2026 (fine sessione, dopo il Passo 4 — lavoro sospeso qui su richiesta)

Questo file serve a non perdersi tra una sessione di lavoro e l'altra: raccoglie cosa
è stato deciso, cosa è ancora un'ipotesi da confermare, e cosa manca. Va aggiornato
ogni 3-4 passaggi di lavoro, non a ogni singola modifica.

**Punto di ripresa**: motore del Cronista (`src/lib/narratore-simulato.js`) scritto,
testato (21 verifiche automatiche, tutte passate) e caricato su GitHub, insieme a un
`CLAUDE.md` di partenza in root per lavorare da qui in poi con Claude Code invece che
con upload manuali via browser. **Il pool di frammenti narrativi veri per Corsa
Invisibile non esiste ancora** — il Cronista oggi sa solo comporre testo da frammenti
finti usati per i test, non da narrativa reale. **Prossimo passo deciso**: scrivere il
pool vero (nome file da decidere, es. `narratore-corsa-invisibile.js`) e collegarlo a
`GameSession.js`. Consigliato farlo direttamente in Claude Code aperto sulla cartella
reale del progetto, non più in una chat separata.
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

- [ ] **Pool di frammenti narrativi veri** per il Cronista (contenuto, non
      motore) — prossimo passo deciso, consigliato farlo in Claude Code
- [x] Motore neutro del Cronista (`narratore-simulato.js`) — fatto nel Passo 4
- [x] Sistema di competenze personaggio — fatto nel Passo 3, numeri da confermare
- [ ] Collegare le competenze al flusso dei nodi (una richiesta che chiede un
      tiro invece di/oltre un effetto fisso)
- [ ] Collegare il Cronista a `GameSession.js` una volta pronto il pool vero
- [ ] Conferma o correzione della definizione di Margine
- [x] Un nodo scritto come esempio con ramificazione reale — fatto nel Passo 2
      (`decalogo-vaira-severo` in `1836-torino`)
- [ ] Collegare davvero l'AI alla generazione degli esiti (con il tetto per sessione)
- [ ] Decisione su codice del libro, chat, chiamata vocale
- [ ] Interfaccia di gioco (`public/`) — rimandata, si parte dal motore
- [ ] Home del libro su bersaglierisgv.org (checklist già nel README del progetto)

---

## Changelog tecnico

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
