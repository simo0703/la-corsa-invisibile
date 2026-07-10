# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cos'è (WHY)

GdR multiplayer legato al romanzo *Il ragazzo che correva nel tempo* / *I passi
tornano* di Simone Badii. **Progetto indipendente**: repo proprio, Worker
Cloudflare proprio, database D1 proprio. Non condivide nulla con Session Zero
(La Soglia, The Ledger Game) — scelta deliberata per poter modificare l'uno
senza rischiare di rompere l'altro.

Comparirà sotto l'ombrello roomzero.online come `corsa.roomzero.online`, ma è
tecnicamente un prodotto a sé.

## Comandi (HOW)

- `npm install` — dipendenze (solo `wrangler` come devDependency)
- `npm run dev` — sviluppo locale (`wrangler dev`: Worker + Durable Object +
  file statici di `public/`)
- `npm run deploy` — deploy manuale (`wrangler deploy`); di norma non serve,
  vedi "Deploy automatico" sotto
- `npm run db:init` — applica `schema.sql` al D1 locale
- `npm run db:init:remote` — applica `schema.sql` al D1 di produzione

Non esiste un test runner/framework: i test sono script Node autonomi con
asserzioni scritte a mano (funzione `verifica()` che stampa OK/FAIL). Non c'è
nessun comando di lint o build configurato — non inventarne uno.

- `node test-risoluzione.mjs` — sistema di competenze e formula di risoluzione
- `node test-narratore-simulato.mjs` — motore del Cronista (narrazione a frammenti)
- `node test-game-session.mjs` — Durable Object `GameSession`, simulato in
  memoria (nessun bisogno di `wrangler`/miniflare)
- Lancia il test rilevante dopo OGNI modifica ai file che tocca, prima di
  proporre il commit.

**Deploy automatico**: da luglio 2026 questo repo è collegato al Worker su
Cloudflare (Settings → Build → Git repository). **Ogni commit push su `main`
avvia da solo un deploy in produzione.** Non fare push su `main` di codice non
testato o di un lavoro a metà — se serve, usa un branch e chiedi conferma
esplicita prima di mergiare o pushare su `main`.

## Architettura (WHAT)

```
wrangler.toml               Worker + Durable Object + D1 + [assets]
schema.sql                  tabelle: access_codes, subscribers
src/
  index.js                  routing del Worker — NEUTRO, nessuna terminologia di gioco
  game-config.js             terminologia, ruoli, nodi temporali, competenze (contenuto narrativo)
  durable-objects/
    GameSession.js            stato live di una stanza (risorse di squadra, margine, orologio)
  lib/
    access-codes.js           validazione/consumo codici su D1 (vedi nota sotto: non ancora collegato)
    risoluzione.js             formula competenza + dado (vedi nota sotto: non ancora collegato ai nodi)
    narratore-simulato.js      motore neutro di narrazione a frammenti ("Il Cronista")
public/                      interfaccia di gioco (index.html, servito come file statico)
DECISIONI_LA_CORSA_INVISIBILE.md   log delle decisioni tra una sessione e l'altra
```

**Routing del Worker (`index.js`)**: `GET /api/config` restituisce
`GAME_CONFIG` al client; `POST /api/crea-stanza` genera un `roomId`
(`crypto.randomUUID()`) e crea/recupera il Durable Object corrispondente
(`env.GAME_SESSION.idFromName(roomId)`); ogni richiesta su
`/api/stanza/{roomId}/...` viene proxata così com'è allo stub del Durable
Object di quella stanza (URL interno riscritto su `https://internal{sub}`).
Un Durable Object per stanza = isolamento totale tra sessioni diverse.

**Stato di `GameSession`**: un unico oggetto salvato sotto la chiave
`"session"` in `state.storage`, creato pigramente da `initState()` e sempre
passato da `migrateState()` prima dell'uso. **Regola da rispettare sempre**:
ogni nuovo campo di stato va aggiunto SIA nel default object dentro
`initState()` SIA in `migrateState()` — altrimenti le sessioni create prima
della modifica falliscono in silenzio (i vecchi record restano senza quel
campo).

Endpoint di `GameSession.fetch()`: `GET /state`, `POST /join`,
`POST /risorse` (variazione diretta di una risorsa di squadra),
`POST /avvia-nodo` (avvia un Nodo Temporale dalla prima richiesta),
`GET /richiesta-attiva`, `POST /scegli` (il cuore del loop di gioco: applica
gli effetti della risposta scelta, avanza l'orologio, valuta la
complicazione da margine, determina la prossima richiesta e — se il ramo
finisce — l'esito del nodo).

**Modello di ramificazione dei nodi** (`game-config.js` → `nodiTemporali` →
`richieste` → `risposte`, letto da `GameSession.scegli`): il campo
`prossima` di una risposta ha **tre comportamenti distinti**, facili da
confondere:
- assente → fallback in sequenza (compatibilità con i nodi non ramificati);
- stringa → ramificazione esplicita verso quell'id di richiesta;
- `null` scritto esplicitamente → fine del ramo qui, anche se nell'array
  della richieste del nodo ce ne sono altre dopo.

**Esito finale di un nodo** (`nodo.esitoFinale`): valutato da
`valutaEsitoNodo()` quando le richieste si esauriscono — vince la prima
`variante` la cui `condizione` (soglie min/max sulle risorse di squadra) è
soddisfatta, altrimenti si usa `default`. Ogni nuovo nodo deve replicare
questo stesso modello per essere valutato correttamente, senza bisogno di
modifiche al motore.

**`lib/risoluzione.js`**: motore di creazione personaggio
(`creaCompetenzeIniziali`) e risoluzione azione (`risolviAzione`: punteggio
competenza + 1d4, confrontato con due soglie). **Scritto e testato ma non
ancora collegato al flusso dei nodi** — `GameSession.scegli` oggi applica
solo gli effetti fissi scritti in `game-config.js`, non chiama mai
`risolviAzione`.

**`lib/narratore-simulato.js`** ("Il Cronista"): motore di narrazione a
frammenti combinabili, interamente neutro (nessun termine specifico di
nessun gioco). Compone il testo di un esito in tre slot fissi — apertura →
sviluppo → eco — interrogando un "pool" esterno per candidati di ogni slot
(`pool.ottieniFrammenti(slot, contesto)`), scegliendo con selezione pesata
evitando ripetizioni recenti (`scegliFrammento`), risolvendo placeholder
`{chiave}` o frammenti programmatici (funzione invece di stringa). Il pool
vero per Corsa Invisibile **non esiste ancora**: i test usano solo pool
finti, e questo motore non è collegato a `GameSession.js`.

**`lib/access-codes.js`**: query D1 parametrizzate per validare/consumare
codici d'accesso (`access_codes` in `schema.sql`). **Esiste ma non risulta
importato da nessuna parte in `src/`** — `index.js` oggi non ha nessuna rotta
`/admin/...` né alcuna verifica di codice, nonostante il `README.md` elenchi
`/admin/genera-codici` come "già protetto" con `ADMIN_PASSWORD`. Verifica lo
stato reale nel codice prima di assumere che quella rotta esista.

**Regola architetturale non negoziabile**: `index.js`, `GameSession.js` e
`narratore-simulato.js` non devono MAI contenere una stringa specifica di
questo gioco (nomi di ruoli, competenze, nodi, tono narrativo). Tutto ciò che
è contenuto va letto da `game-config.js` (o, per il Cronista, dal pool di
frammenti che gli viene passato). Se stai per scrivere un termine come
"Cadenza" o "Vaira" fuori da `game-config.js`, fermati: è quasi certamente nel
posto sbagliato. Questa regola esiste perché il motore (in particolare il
Cronista) è pensato per essere riusato identico in futuri giochi.

Le risorse di gioco (Cadenza, Spirito di Corpo, Passo Avanti) sono **di
squadra**, non del singolo personaggio — diverso da come è impostato Session
Zero. Non dare per scontato che un pattern degli altri progetti si applichi
qui senza verificarlo.

## Account — non mescolare mai

- GitHub: `simo0703` per questo repo (e per Session Zero)
- Cloudflare: `smnbadii@gmail.com` per questo progetto e per i progetti
  Bersaglieri/roomzero — MAI l'account `Info.sbferrara@gmail.com` (quello è
  solo per sbferrara.org)
- Se non sei sicuro di quale account sia attivo in un comando (`wrangler`,
  `git remote`, `gh`), fermati e chiedi conferma prima di eseguire.

## Metodo di lavoro

- Un passo alla volta: proponi una modifica, mostra il diff, aspetta
  conferma prima di eseguire cose con effetti reali (push, deploy, comandi
  `wrangler` che toccano l'ambiente remoto).
- All'inizio di ogni sessione, leggi `DECISIONI_LA_CORSA_INVISIBILE.md` per
  sapere dove ci si era fermati (contiene anche le ipotesi ancora da
  confermare, come la definizione di Margine, e la lista di cosa manca).
- Aggiorna quel file ogni 3-4 passaggi di lavoro (non a ogni singola
  modifica): cosa è stato deciso, cosa resta un'ipotesi da confermare, cosa
  manca. Sezioni: Punto di ripresa, Decisioni confermate, Ipotesi in attesa
  di conferma, Cosa manca, Changelog tecnico.
- Segreti (`ADMIN_PASSWORD` e simili) solo con `wrangler secret put`, mai nel
  codice né in questo repo.
