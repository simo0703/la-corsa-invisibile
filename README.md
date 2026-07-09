# La Corsa Invisibile

GdR multiplayer legato al romanzo *Il ragazzo che correva nel tempo* / *I passi tornano*.

**Progetto indipendente**: repo proprio, deploy Cloudflare proprio, database D1 proprio.
Non condivide nulla con Session Zero (La Soglia, The Ledger Game) — questa era una
scelta deliberata per poterlo modificare senza toccare l'altra piattaforma.

Comparirà sotto l'ombrello **roomzero.online** come `corsa.roomzero.online`,
ma tecnicamente è un prodotto a sé.

## Setup iniziale (da fare una sola volta)

1. `npm install`
2. Crea il database D1:
   ```
   wrangler d1 create la-corsa-invisibile-db
   ```
   Copia l'ID restituito e incollalo in `wrangler.toml` al posto di
   `REPLACE_WITH_D1_DATABASE_ID`.
3. Inizializza lo schema:
   ```
   npm run db:init          # locale, per sviluppo
   npm run db:init:remote   # sul database reale
   ```
4. Sviluppo locale:
   ```
   npm run dev
   ```
5. Deploy:
   ```
   npm run deploy
   ```
6. Su dashboard Cloudflare → Workers → questo progetto → Custom Domains:
   aggiungi `corsa.roomzero.online` (richiede che il dominio roomzero.online
   sia già gestito da Cloudflare).

## Cose da NON dimenticare prima di andare pubblico

- [ ] Proteggere `/admin/genera-codici` con una password (pattern "Area riservata"
      nella skill `costruzione-siti-web`) — al momento è aperto, va bene solo in sviluppo.
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
