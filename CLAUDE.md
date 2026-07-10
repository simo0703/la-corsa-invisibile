# La Corsa Invisibile — contesto per Claude Code

## Cos'è (WHY)

GdR multiplayer legato al romanzo *Il ragazzo che correva nel tempo* / *I passi
tornano* di Simone Badii. **Progetto indipendente**: repo proprio, Worker
Cloudflare proprio, database D1 proprio. Non condivide nulla con Session Zero
(La Soglia, The Ledger Game) — scelta deliberata per poter modificare l'uno
senza rischiare di rompere l'altro.

Comparirà sotto l'ombrello roomzero.online come `corsa.roomzero.online`, ma è
tecnicamente un prodotto a sé.

## Struttura (WHAT)

```
wrangler.toml               Worker + Durable Object + D1
schema.sql                  tabelle: access_codes, subscribers
src/
  index.js                  routing del Worker — NEUTRO, nessuna terminologia di gioco
  game-config.js             terminologia, ruoli, nodi temporali, competenze (contenuto narrativo)
  durable-objects/
    GameSession.js            stato live di una stanza (risorse di squadra, margine, orologio)
  lib/
    access-codes.js           validazione/consumo codici su D1
    risoluzione.js             formula competenza + dado
    narratore-simulato.js      motore neutro di narrazione a frammenti ("Il Cronista")
public/                      interfaccia di gioco (servita come file statici)
DECISIONI_LA_CORSA_INVISIBILE.md   log delle decisioni tra una sessione e l'altra
```

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

## Comandi (HOW)

- `npm run dev` — sviluppo locale
- `node test-risoluzione.mjs` — test del sistema di competenze
- `node test-narratore-simulato.mjs` — test del motore Cronista
- `node test-game-session.mjs` — test del Durable Object (se presente)
- Lancia il test rilevante dopo OGNI modifica ai file che tocca, prima di
  proporre il commit.

**Deploy automatico**: da luglio 2026 questo repo è collegato al Worker su
Cloudflare (Settings → Build → Git repository). **Ogni commit push su `main`
avvia da solo un deploy in produzione.** Non fare push su `main` di codice non
testato o di un lavoro a metà — se serve, usa un branch e chiedi conferma
esplicita prima di mergiare o pushare su `main`.

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
  sapere dove ci si era fermati.
- Aggiorna quel file ogni 3-4 passaggi di lavoro (non a ogni singola
  modifica): cosa è stato deciso, cosa resta un'ipotesi da confermare, cosa
  manca. Sezioni: Punto di ripresa, Decisioni confermate, Ipotesi in attesa
  di conferma, Cosa manca, Changelog tecnico.
- Segreti (`ADMIN_PASSWORD` e simili) solo con `wrangler secret put`, mai nel
  codice né in questo repo.
