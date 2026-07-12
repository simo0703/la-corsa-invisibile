// Test locale: node test-xp-completamento-nodo.mjs
//
// Fase 3 del profilo giocatore persistente: XP assegnato quando un nodo si
// completa strutturalmente (applicaRisposta(), vedi GameSession.js). Nodo
// di prova sintetico a UNA sola richiesta/risposta (si chiude al primo
// /scegli), stesso pattern già usato in test-scegli-risoluzione.mjs per non
// toccare il contenuto narrativo reale dei 5 nodi.
//
// Fake D1 dedicato (righe in memoria, riconosce solo le due query emesse da
// assegnaXpCompletamentoNodo): permette anche di simulare un fallimento D1
// per il requisito 4 (il completamento del nodo non deve mai dipendere
// dalla riuscita dell'assegnazione XP).

import { GameSession } from "./src/durable-objects/GameSession.js";
import { GAME_CONFIG } from "./src/game-config.js";
import { XP_PER_NODO } from "./src/lib/profili-giocatore.js";

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

// Fake D1 per giocatori_persistenti: righe pre-seminabili via seminaRiga(),
// riconosce SELECT nodi_completati / UPDATE nodi_completati+xp_totale per
// id. `guasto: true` fa lanciare ogni chiamata, per simulare D1 non
// raggiungibile (requisito 4).
function creaDbFinto({ guasto = false } = {}) {
  const righe = new Map(); // id -> { nodi_completati, xp_totale }

  function seminaRiga(id, { nodiCompletati = [], xpTotale = 0 } = {}) {
    righe.set(id, { nodi_completati: JSON.stringify(nodiCompletati), xp_totale: xpTotale });
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
            if (normalizzata.startsWith("SELECT nodi_completati")) {
              const [id] = args;
              const riga = righe.get(id);
              return riga ? { ...riga } : null;
            }
            throw new Error(`Query .first() non gestita dal fake DB: ${normalizzata}`);
          },
          async run() {
            if (normalizzata.startsWith("UPDATE giocatori_persistenti")) {
              const [nodiCompletatiJson, deltaXp, id] = args;
              const riga = righe.get(id);
              if (!riga) throw new Error("UPDATE su un id inesistente nel fake DB");
              riga.nodi_completati = nodiCompletatiJson;
              riga.xp_totale += deltaXp;
              return { success: true };
            }
            throw new Error(`Query .run() non gestita dal fake DB: ${normalizzata}`);
          },
        };
      },
    };
  }

  return { prepare, seminaRiga, righe };
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

// Dal Passo 2 del sistema di token di sessione, /join non accetta più un
// profiloId dichiarato direttamente (si ricava solo verificando un
// profiloToken -- copertura dedicata in test-join-profilo-token.mjs).
// Questo file testa SOLO assegnaXpCompletamentoNodo (Fase 3): il profiloId
// qui è solo una precondizione di setup, non l'oggetto del test, quindi lo
// impostiamo direttamente sullo storage dopo un /join normale -- stesso
// principio già usato da impostaCompetenza in altri file di test.
async function impostaProfiloId(storage, giocatoreId, profiloId) {
  const session = await storage.get("session");
  session.giocatori.find((g) => g.id === giocatoreId).profiloId = profiloId;
  await storage.put("session", session);
}

async function joinComandante(gs, storage, nome = "Prova", ruolo = "esploratore", profiloId = null) {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  const giocatoreId = join.json.giocatori[0].id;
  if (profiloId !== null) await impostaProfiloId(storage, giocatoreId, profiloId);
  return { giocatoreId, token: join.json.token };
}

async function join(gs, storage, nome, ruolo, profiloId = null) {
  const risposta = await chiamata(gs, "/join", "POST", { nome, ruolo });
  const giocatoreId = risposta.json.giocatori[risposta.json.giocatori.length - 1].id;
  if (profiloId !== null) await impostaProfiloId(storage, giocatoreId, profiloId);
  return { giocatoreId };
}

// Nodo di prova: una sola richiesta con una sola risposta a "prossima: null"
// -- si chiude al primo /scegli, per test brevi e diretti.
function nodoDiProva(id) {
  return {
    id,
    titolo: "Nodo di prova XP (solo test)",
    richieste: [
      {
        id: `${id}-richiesta`,
        situazione: "n/d",
        prompt: "n/d",
        risposte: [{ testo: "Unica risposta", effetti: {}, esito: "Fine del nodo.", prossima: null }],
      },
    ],
    esitoFinale: { varianti: [], default: "Esito finale di prova." },
  };
}
let contatoreNodi = 0;
function nuovoNodoId() {
  return `test-nodo-xp-${++contatoreNodi}`;
}

console.log("--- completamento nodo assegna XP e registra il nodo per un giocatore con profiloId ---");
{
  const db = creaDbFinto();
  db.seminaRiga(42, { nodiCompletati: [], xpTotale: 0 });

  const nodoId = nuovoNodoId();
  GAME_CONFIG.nodiTemporali.push(nodoDiProva(nodoId));

  const { gs, storage } = nuovaSessione({ DB: db });
  const { giocatoreId, token } = await joinComandante(gs, storage, "Prova", "esploratore", 42);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il nodo si chiude con questa unica risposta", json.esitoNodo !== null);

  const riga = db.righe.get(42);
  verifica("xp_totale sale di 100", riga.xp_totale === XP_PER_NODO);
  verifica("il nodo viene registrato in nodi_completati", JSON.parse(riga.nodi_completati).includes(nodoId));
}

console.log("\n--- giocatore senza profiloId non riceve nulla e non causa errori ---");
{
  const db = creaDbFinto();
  const nodoId = nuovoNodoId();
  GAME_CONFIG.nodiTemporali.push(nodoDiProva(nodoId));

  const { gs, storage } = nuovaSessione({ DB: db });
  const { giocatoreId, token } = await joinComandante(gs, storage, "Prova", "esploratore"); // nessun profiloId
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { status, json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("la richiesta risponde comunque 200", status === 200);
  verifica("il nodo si chiude normalmente", json.esitoNodo !== null);
  verifica("nessuna riga toccata nel fake DB (era vuoto e resta vuoto)", db.righe.size === 0);
}

console.log("\n--- un giocatore che ha già il nodo in nodi_completati non riceve XP una seconda volta ---");
{
  const db = creaDbFinto();
  const nodoId = nuovoNodoId();
  db.seminaRiga(7, { nodiCompletati: [nodoId], xpTotale: XP_PER_NODO }); // già completato in passato, magari in un'altra stanza
  GAME_CONFIG.nodiTemporali.push(nodoDiProva(nodoId));

  const { gs, storage } = nuovaSessione({ DB: db });
  const { giocatoreId, token } = await joinComandante(gs, storage, "Prova", "esploratore", 7);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });

  const riga = db.righe.get(7);
  verifica("xp_totale resta invariato (nessun doppio bonus)", riga.xp_totale === XP_PER_NODO);
  verifica("nodi_completati non ha duplicati", JSON.parse(riga.nodi_completati).filter((n) => n === nodoId).length === 1);
}

console.log("\n--- un fallimento D1 non blocca il completamento del nodo per la stanza ---");
{
  const dbGuasto = creaDbFinto({ guasto: true });
  const nodoId = nuovoNodoId();
  GAME_CONFIG.nodiTemporali.push(nodoDiProva(nodoId));

  const { gs, storage } = nuovaSessione({ DB: dbGuasto });
  const { giocatoreId, token } = await joinComandante(gs, storage, "Prova", "esploratore", 99);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { status, json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("la richiesta risponde comunque 200 nonostante D1 sia guasto", status === 200);
  verifica("il nodo risulta comunque concluso", json.esitoNodo !== null);
  verifica("la richiesta attiva è stata azzerata (nodo chiuso regolarmente)", json.prossimaRichiesta === null);
}

console.log("\n--- binding D1 assente (env.DB non configurato): non causa errori, il nodo si chiude comunque ---");
{
  const nodoId = nuovoNodoId();
  GAME_CONFIG.nodiTemporali.push(nodoDiProva(nodoId));

  const { gs, storage } = nuovaSessione(); // env = {}, nessun DB
  const { giocatoreId, token } = await joinComandante(gs, storage, "Prova", "esploratore", 123);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { status, json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("la richiesta risponde comunque 200 senza binding D1", status === 200);
  verifica("il nodo risulta comunque concluso", json.esitoNodo !== null);
}

console.log("\n--- più giocatori nella stessa stanza: ognuno viene processato indipendentemente ---");
{
  const db = creaDbFinto();
  db.seminaRiga(1, { nodiCompletati: [], xpTotale: 0 }); // deve ricevere XP
  const nodoId = nuovoNodoId();
  db.seminaRiga(2, { nodiCompletati: [nodoId], xpTotale: XP_PER_NODO }); // già fatto, non deve ricevere di nuovo
  GAME_CONFIG.nodiTemporali.push(nodoDiProva(nodoId));

  const { gs, storage } = nuovaSessione({ DB: db });
  const comandante = await joinComandante(gs, storage, "Prima", "esploratore", 1);
  await join(gs, storage, "Seconda", "custode", 2); // secondo giocatore, già completato
  await join(gs, storage, "Terza", "incursore"); // terzo giocatore, senza profiloId

  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId: comandante.giocatoreId, token: comandante.token });
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId: comandante.giocatoreId, token: comandante.token });

  verifica("il primo giocatore (nuovo) riceve XP", db.righe.get(1).xp_totale === XP_PER_NODO);
  verifica("il secondo giocatore (già completato) non riceve XP una seconda volta", db.righe.get(2).xp_totale === XP_PER_NODO);
  verifica("il terzo giocatore (senza profiloId) non ha nessuna riga toccata", db.righe.size === 2);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
