// Test locale: node test-bonus-grado-tiro.mjs
//
// Fase 4 (ultimo passo) del profilo giocatore persistente: il bonus di grado
// (+1 a una competenza scelta dal giocatore sulla schermata profilo, vedi
// src/lib/profili-giocatore.js -- otteniCompetenzeBonificate) si applica al
// punteggio usato per il tiro in GameSession.applicaRisposta(), PRIMA del
// dado. Stesso pattern di test-scegli-risoluzione.mjs (nodo di prova
// sintetico, aggiunto a runtime a GAME_CONFIG) e di
// test-xp-completamento-nodo.mjs (fake D1 dedicato con modalità "guasto"
// per simulare un fallimento D1 isolato).
//
// Ruolo "custode" per i giocatori di prova: nessun dadoFacce di ruolo (resta
// il default 1d4), così il bonus di grado si isola dall'override del dado
// già coperto da test-scegli-risoluzione.mjs -- qui interessa solo
// json.tiro.competenza (il punteggio PRIMA del dado), non l'esito finale.

import { GameSession } from "./src/durable-objects/GameSession.js";
import { GAME_CONFIG } from "./src/game-config.js";

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

// Fake D1 per giocatori_persistenti: righe pre-seminabili via seminaRiga()
// (bonus_scelti già nella forma { assegnati: [...] }), riconosce SOLO la
// query emessa da otteniCompetenzeBonificate (SELECT bonus_scelti ... WHERE
// id = ?). `guasto: true` fa lanciare ogni chiamata (D1 non raggiungibile).
// `chiamate` conta le prepare() riuscite, per verificare che un giocatore
// senza profiloId non tocchi mai D1 (corto circuito prima della query).
function creaDbFinto({ guasto = false } = {}) {
  const righe = new Map(); // id -> { bonus_scelti }
  let chiamate = 0;

  function seminaRiga(id, assegnati = []) {
    righe.set(id, { bonus_scelti: JSON.stringify({ assegnati }) });
  }

  function prepare(sql) {
    if (guasto) {
      throw new Error("D1 non raggiungibile (simulato dal test)");
    }
    chiamate += 1;
    const normalizzata = sql.replace(/\s+/g, " ").trim();
    return {
      bind(...args) {
        return {
          async first() {
            if (normalizzata.startsWith("SELECT bonus_scelti")) {
              const [id] = args;
              const riga = righe.get(id);
              return riga ? { ...riga } : null;
            }
            // Il nodo di prova si chiude sempre al primo /scegli, quindi
            // applicaRisposta() attiva anche assegnaXpNodoCompletato (Fase
            // 3, già coperto a parte in test-xp-completamento-nodo.mjs):
            // qui questo fake DB non traccia nodi_completati, "nessuna
            // riga trovata" fa tornare assegnaXpCompletamentoNodo su
            // profilo_non_trovato senza errori, così il rumore nei log
            // resta solo nei test che simulano un vero guasto D1.
            if (normalizzata.startsWith("SELECT nodi_completati")) return null;
            throw new Error(`Query .first() non gestita dal fake DB: ${normalizzata}`);
          },
        };
      },
    };
  }

  return {
    prepare,
    seminaRiga,
    get chiamate() {
      return chiamate;
    },
  };
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

async function impostaCompetenza(storage, giocatoreId, competenzaId, valore) {
  const session = await storage.get("session");
  const giocatore = session.giocatori.find((g) => g.id === giocatoreId);
  giocatore.competenze[competenzaId] = valore;
  await storage.put("session", session);
}

// Dal Passo 2 del sistema di token di sessione, /join non accetta più un
// profiloId dichiarato direttamente (si ricava solo verificando un
// profiloToken -- copertura dedicata in test-join-profilo-token.mjs).
// Questo file testa SOLO calcolaBonusGrado: il profiloId qui è solo una
// precondizione di setup, quindi lo impostiamo direttamente sullo storage
// dopo un /join normale, bypassando la verifica del token.
async function joinComandante(gs, storage, { profiloId = null } = {}) {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome: "Prova", ruolo: "custode", tokenCreazione });
  const giocatoreId = join.json.giocatori[0].id;
  if (profiloId !== null) {
    const session = await storage.get("session");
    session.giocatori.find((g) => g.id === giocatoreId).profiloId = profiloId;
    await storage.put("session", session);
  }
  return { giocatoreId, token: join.json.token };
}

// Nodo di prova: una sola risposta con tiro su "cadenza", senza
// effettiPerEsito/esito (non servono: qui interessa solo json.tiro.competenza,
// il punteggio usato per il tiro prima del dado).
let contatoreNodi = 0;
function nuovoNodoDiProva() {
  const id = `test-nodo-bonus-grado-${++contatoreNodi}`;
  GAME_CONFIG.nodiTemporali.push({
    id,
    titolo: "Nodo di prova bonus di grado (solo test)",
    richieste: [
      {
        id: `${id}-richiesta`,
        situazione: "n/d",
        prompt: "n/d",
        risposte: [{ testo: "Risposta con tiro su Cadenza", competenzaRichiesta: "cadenza", prossima: null }],
      },
    ],
    esitoFinale: { varianti: [], default: "n/d" },
  });
  return id;
}

console.log("--- competenza bonificata: applica +1 al punteggio usato per il tiro ---");
{
  const db = creaDbFinto();
  db.seminaRiga(1, [{ grado: 2, competenza: "cadenza" }]);
  const nodoId = nuovoNodoDiProva();

  const { gs, storage } = nuovaSessione({ DB: db });
  const { giocatoreId, token } = await joinComandante(gs, storage, { profiloId: 1 });
  await impostaCompetenza(storage, giocatoreId, "cadenza", 3);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro usa competenza 3 + bonus di grado 1 = 4", json.tiro !== null && json.tiro.competenza === 4);
}

console.log("\n--- competenza NON bonificata: nessuna alterazione del tiro ---");
{
  const db = creaDbFinto();
  db.seminaRiga(2, [{ grado: 2, competenza: "precisione" }]); // bonus su un'altra competenza
  const nodoId = nuovoNodoDiProva();

  const { gs, storage } = nuovaSessione({ DB: db });
  const { giocatoreId, token } = await joinComandante(gs, storage, { profiloId: 2 });
  await impostaCompetenza(storage, giocatoreId, "cadenza", 3);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica(
    "il tiro usa competenza 3, invariata (il bonus è su precisione, non su cadenza)",
    json.tiro !== null && json.tiro.competenza === 3
  );
}

console.log("\n--- giocatore senza profiloId: comportamento invariato, D1 non viene nemmeno interrogato ---");
{
  const db = creaDbFinto();
  const nodoId = nuovoNodoDiProva();

  const { gs, storage } = nuovaSessione({ DB: db });
  const { giocatoreId, token } = await joinComandante(gs, storage); // nessun profiloId
  await impostaCompetenza(storage, giocatoreId, "cadenza", 3);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro usa competenza 3, invariata (nessun profiloId)", json.tiro !== null && json.tiro.competenza === 3);
  verifica("D1 non è mai stato interrogato (corto circuito su profiloId assente)", db.chiamate === 0);
}

console.log("\n--- fallimento D1 durante la lettura del bonus: isolato, nessun bonus applicato, il tiro procede comunque ---");
{
  const dbGuasto = creaDbFinto({ guasto: true });
  const nodoId = nuovoNodoDiProva();

  const { gs, storage } = nuovaSessione({ DB: dbGuasto });
  const { giocatoreId, token } = await joinComandante(gs, storage, { profiloId: 3 });
  await impostaCompetenza(storage, giocatoreId, "cadenza", 3);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { status, json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("la richiesta risponde comunque 200 nonostante D1 sia guasto", status === 200);
  verifica("nessun bonus applicato: competenza resta 3, non 4", json.tiro !== null && json.tiro.competenza === 3);
}

console.log("\n--- binding D1 assente (env.DB non configurato): nessun bonus, nessun errore ---");
{
  const nodoId = nuovoNodoDiProva();

  const { gs, storage } = nuovaSessione(); // env = {}, nessun DB
  const { giocatoreId, token } = await joinComandante(gs, storage, { profiloId: 4 });
  await impostaCompetenza(storage, giocatoreId, "cadenza", 3);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId, giocatoreId, token });

  const { status, json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("la richiesta risponde comunque 200 senza binding D1", status === 200);
  verifica("nessun bonus applicato: competenza resta 3", json.tiro !== null && json.tiro.competenza === 3);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
