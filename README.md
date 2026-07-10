# La Corsa Invisibile

GdR multiplayer legato al romanzo *Il ragazzo che correva nel tempo* / *I passi tornano*.

**Progetto indipendente**: repo proprio, deploy Cloudflare proprio, database D1 proprio.
Non condivide nulla con Session Zero (La Soglia, The Ledger Game) — questa era una
scelta deliberata per poterlo modificare senza toccare l'altra piattaforma.

Comparirà sotto l'ombrello **roomzero.online** come `corsa.roomzero.online`,
ma tecnicamente è un prodotto a sé.

## Deploy

Da luglio 2026 il deploy è **automatico**: questo repository è collegato al Worker
su Cloudflare (Settings → Build → Git repository). Ogni commit sul branch `main`
avvia da solo un nuovo deploy — non serve più lanciare `wrangler deploy` a mano.

Per aggiornare il gioco: modifica i file, poi "Add file → Upload files" su
GitHub (o un push da riga di comando), e Cloudflare fa il resto.

## Setup iniziale (fatto una sola volta, storico)

1. `npm install`
2. Database D1 creato: `la-corsa-invisibile-db`, ID già impostato in `wrangler.toml`.
3. Schema inizializzato con `npm run db:init:remote`.
4. Sviluppo locale (facoltativo, per test prima di caricare): `npm run dev`.
5. Custom Domain da collegare quando pronto: `corsa.roomzero.online`
   (dashboard Cloudflare → questo Worker → Domains).

## Cose da NON dimenticare prima di andare pubblico

- [ ] Costruire `/admin/genera-codici` e proteggerlo con una password — il
      secret `ADMIN_PASSWORD` è impostato su Cloudflare, ma la rotta non
      esiste ancora in `src/index.js` e `lib/access-codes.js` non è
      collegato a nulla: da fare, non da dare per scontato.
- [ ] Costruire la "home del libro" su **bersaglierisgv.org** (non su questo progetto):
      pagina statica, stile del sito, spiegazione del gioco, lettura del codice da
      query string (`?codice=XXXX`), pulsante verso `corsa.roomzero.online` quando pronto.
- [ ] Se cambia l'indirizzo di questa piattaforma in futuro, va aggiornato un solo
      punto sulla pagina di bersaglierisgv.org (una costante/link, non sparso in più posti).
- [ ] Verificare che nessuna stringa in `src/index.js` o `durable-objects/` contenga
      terminologia specifica del gioco: deve venire sempre da `game-config.js`.

## Struttura

```
wrangler.toml              configurazione Worker + Durable Object + D1
schema.sql                 tabelle: access_codes, subscribers
src/
  index.js                 routing del Worker
  game-config.js           terminologia, ruoli, nodi temporali (contenuto narrativo)
  durable-objects/
    GameSession.js          stato live di una stanza (risorse di squadra)
  lib/
    access-codes.js         validazione/consumo codici su D1
```

## Nota architetturale

Le risorse di gioco (Cadenza, Spirito di Corpo, Passo Avanti) sono **di squadra**,
non del singolo personaggio. Questo è diverso da come probabilmente è impostato
Session Zero per gli altri due giochi — tienilo a mente se in futuro porti pattern
da un progetto all'altro: non sono automaticamente compatibili.
