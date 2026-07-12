// Test locale: node test-join-profilo-token.mjs
//
// Passo 2 del sistema di token di sessione per il profilo persistente: al
// /join, il profiloId non è più dichiarato direttamente dal client (vecchio
// comportamento della Fase 2) -- si ricava SOLO verificando un profiloToken
// contro sessioni_profilo (vedi verificaProfiloDaToken in GameSession.js e
// verificaTokenSessione in src/lib/profili-giocatore.js). Un token
// assente/scaduto/inesistente non blocca mai il join: il giocatore entra
// semplicemente come ospite (profiloId null).
//
// Fake D1 dedicato a sessioni_profilo (righe pre-seminabili tramite
// seminaSessione(), che calcola l'hash con lo stesso algoritmo -- SHA-256 --
// usato dal codice di produzione, per poter seminare una riga che
// corrisponda davvero all'hash che verificaTokenSessione calcolerà da un
// token in chiaro). `guasto: true` fa lanciare ogni chiamata, per il
// requisito di isolamento di un fallimento D1.

import { GameSession } from "./src/durable-objects/GameSession.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

function creaStorageFinto() {
  const dati = new Map();
  return {
    async get(chiave) {
      return dati.has(chiave) ? structuredClone(dati.get(chiave)) : undefined;
    },
    async put(chiave, valore) {
      dati.set(chiave, structuredClone(valore));
    },
  };
}

// Stesso algoritmo di hashSha256 in src/lib/profili-giocatore.js (privato,
// non esportato): duplicato qui solo per seminare righe di test che
// corrispondano davvero all'hash che il codice di produzione calcolerà da
// un dato token in chiaro -- non importa nulla di privato, replica solo
// l'algoritmo (SHA-256 via Web Crypto, disponibile anche sotto Node puro).
async function sha256Hex(testo) {
  const bit = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(bit))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Fake D1 per sessioni_profilo: righe pre-seminabili via seminaSessione()
// (token in chiaro -> hash calcolato qui, coerente con la produzione),
// riconosce SOLO la query emessa da verificaTokenSessione. `guasto: true`
// fa lanciare ogni chiamata, per simulare D1 non raggiungibile.
function creaDbFinto({ guasto = false } = {}) {
  const sessioni = new Map(); // token_hash -> { profilo_id, scade_il }

  async function seminaSessione(tokenPlano, profiloId, scadeIl) {
    const hash = await sha256Hex(tokenPlano);
    sessioni.set(hash, { profilo_id: profiloId, scade_il: scadeIl });
  }

  function prepare(sql) {
    if (guasto) {
      throw new Error("D1 non raggiungibile (simulato dal test)");
    }
    const normalizzata = sql.replace(/\s+/g, " ").trim();
    return {
      bind(...args) {
        return {
          async first() {
            if (normalizzata.startsWith("SELECT profilo_id, scade_il FROM sessioni_profilo")) {
              const [tokenHash] = args;
              const riga = sessioni.get(tokenHash);
              return riga ? { ...riga } : null;
            }
            throw new Error(`Query .first() non gestita dal fake DB: ${normalizzata}`);
          },
        };
      },
    };
  }

  return { prepare, seminaSessione };
}

function nuovaSessione(env = {}) {
  const storage = creaStorageFinto();
  const gs = new GameSession({ storage }, env);
  return { gs, storage };
}

async function chiamata(gs, path, method = "GET", body = null) {
  const init = { method };
  if (body !== null) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const risposta = await gs.fetch(new Request(`https://fake.test/room/xyz${path}`, init));
  let json = null;
  try {
    json = await risposta.json();
  } catch {
    json = null;
  }
  return { status: risposta.status, json };
}

// 30 giorni da ora, stessa durata usata da creaSessioneProfilo in produzione.
function scadenzaValida() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}
function scadenzaPassata() {
  return new Date(Date.now() - 1000).toISOString();
}

console.log("--- profiloToken valido: profiloId corretto associato al giocatore ---");
{
  const db = creaDbFinto();
  await db.seminaSessione("token-valido-abc", 42, scadenzaValida());

  const { gs } = nuovaSessione({ DB: db });
  const { json } = await chiamata(gs, "/join", "POST", {
    nome: "GiocatoreConToken",
    ruolo: "esploratore",
    profiloToken: "token-valido-abc",
  });
  verifica("il profiloId derivato dal token è quello giusto", json.giocatori[0].profiloId === 42);
}

console.log("\n--- profiloToken scaduto: il giocatore entra come ospite, join non bloccato ---");
{
  const db = creaDbFinto();
  await db.seminaSessione("token-scaduto", 7, scadenzaPassata());

  const { gs } = nuovaSessione({ DB: db });
  const { status, json } = await chiamata(gs, "/join", "POST", {
    nome: "GiocatoreTokenScaduto",
    ruolo: "custode",
    profiloToken: "token-scaduto",
  });
  verifica("il join riesce comunque (200)", status === 200);
  verifica("profiloId è null (token scaduto, non un errore)", json.giocatori[0].profiloId === null);
}

console.log("\n--- profiloToken inesistente (nessuna riga corrispondente): ospite ---");
{
  const db = creaDbFinto(); // nessuna sessione seminata

  const { gs } = nuovaSessione({ DB: db });
  const { status, json } = await chiamata(gs, "/join", "POST", {
    nome: "GiocatoreTokenIgnoto",
    ruolo: "incursore",
    profiloToken: "token-mai-esistito",
  });
  verifica("il join riesce comunque (200)", status === 200);
  verifica("profiloId è null (nessuna sessione trovata per questo token)", json.giocatori[0].profiloId === null);
}

console.log("\n--- nessun profiloToken fornito: comportamento invariato (ospite, come sempre) ---");
{
  const db = creaDbFinto();

  const { gs } = nuovaSessione({ DB: db });
  const { status, json } = await chiamata(gs, "/join", "POST", { nome: "Ospite", ruolo: "fanfara" });
  verifica("il join riesce (200)", status === 200);
  verifica("profiloId è null", json.giocatori[0].profiloId === null);
}

console.log("\n--- un profiloId dichiarato direttamente (senza profiloToken) viene ignorato ---");
{
  const db = creaDbFinto();
  await db.seminaSessione("token-di-un-altro", 99, scadenzaValida());

  const { gs } = nuovaSessione({ DB: db });
  // Il client dichiara un profiloId a mano, senza alcun profiloToken: non
  // deve MAI essere accettato, indipendentemente da cosa esiste in D1.
  const { json } = await chiamata(gs, "/join", "POST", {
    nome: "TentativoFurbo",
    ruolo: "esploratore",
    profiloId: 99,
  });
  verifica("il profiloId dichiarato a mano viene ignorato: il giocatore resta ospite", json.giocatori[0].profiloId === null);
}

console.log("\n--- fallimento D1 durante la verifica del token: isolato, join non bloccato, ospite ---");
{
  const dbGuasto = creaDbFinto({ guasto: true });

  const { gs } = nuovaSessione({ DB: dbGuasto });
  const { status, json } = await chiamata(gs, "/join", "POST", {
    nome: "GiocatoreConDBGuasto",
    ruolo: "custode",
    profiloToken: "un-token-qualsiasi",
  });
  verifica("il join riesce comunque (200) nonostante D1 sia guasto", status === 200);
  verifica("profiloId è null (fallimento isolato, non un errore bloccante)", json.giocatori[0].profiloId === null);
}

console.log("\n--- binding D1 assente (env.DB non configurato): profiloToken fornito ma ignorato, nessun errore ---");
{
  const { gs } = nuovaSessione(); // env = {}, nessun DB
  const { status, json } = await chiamata(gs, "/join", "POST", {
    nome: "GiocatoreSenzaBindingDB",
    ruolo: "fanfara",
    profiloToken: "un-token-qualsiasi",
  });
  verifica("il join riesce comunque (200) senza binding D1", status === 200);
  verifica("profiloId è null", json.giocatori[0].profiloId === null);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
