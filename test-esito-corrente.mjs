// Test locale: node test-esito-corrente.mjs
//
// Passo 1/3 del WebSocket: la "vista corrente" dell'esito (session.esitoCorrente)
// vive nello STATO CONDIVISO, cosi' che anche chi NON ha agito possa leggerla da
// /state. Qui NON si tocca il front-end: si verifica solo il dato sul server.
// Cammina il nodo reale 1836-torino (decalogo-ginnastica -> corri-prima), incluso
// il momento-passaggio corri-prima con esito "" (deve risultare presente e vuoto,
// non assente per errore).

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
    async get(chiave) { return dati.has(chiave) ? structuredClone(dati.get(chiave)) : undefined; },
    async put(chiave, valore) { dati.set(chiave, structuredClone(valore)); },
  };
}
function nuovaSessione() {
  const storage = creaStorageFinto();
  return { gs: new GameSession({ storage }, {}), storage };
}
async function chiamata(gs, path, method = "GET", body = null) {
  const init = { method };
  if (body !== null) { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(body); }
  const r = await gs.fetch(new Request(`https://fake.test/room/xyz${path}`, init));
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
async function joinComandante(gs, nome = "Anna", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori[0].id, token: join.json.token };
}
async function impostaCompetenza(storage, giocatoreId, competenzaId, valore) {
  const s = await storage.get("session");
  s.giocatori.find((g) => g.id === giocatoreId).competenze[competenzaId] = valore;
  await storage.put("session", s);
}
// Cerca ricorsivamente una chiave "token" (o segreti del Riconoscimento) in un valore.
function contieneChiaveSensibile(valore) {
  if (Array.isArray(valore)) return valore.some(contieneChiaveSensibile);
  if (valore && typeof valore === "object") {
    return (
      Object.keys(valore).some((k) => k === "token" || k === "biglietto" || k === "nuovoToken") ||
      Object.values(valore).some(contieneChiaveSensibile)
    );
  }
  return false;
}
const stato = async (gs) => (await chiamata(gs, "/state")).json;

console.log("--- nodo appena avviato: nessun esito corrente ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  const s = await stato(gs);
  verifica("/state espone il campo esitoCorrente", "esitoCorrente" in s);
  verifica("appena avviato il nodo, esitoCorrente è null", s.esitoCorrente === null);
}

console.log("\n--- dopo una risoluzione a effetto fisso: /state espone la vista corrente giusta ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  // decalogo-ginnastica, risposta 2 (effetto fisso): "Aiutando chi fatica di più".
  const scelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 2, giocatoreId, token });

  // FASE 3 — la risposta HTTP di /scegli deve avere gli STESSI campi top-level di prima.
  const chiaviTop = Object.keys(scelta.json).sort().join(",");
  verifica(
    "la risposta di /scegli ha esattamente i campi di sempre (nessuno tolto/aggiunto al top level)",
    chiaviTop === ["competenzaId", "complicazione", "esito", "esitoNodo", "prossimaRichiesta", "session", "tiro"].join(",")
  );
  verifica("il testo dell'esito nella risposta HTTP è quello atteso",
    scelta.json.esito === "Il tempo è peggiore, ma la squadra arriva unita.");

  // La vista corrente è nello stato condiviso: un GET /state qualunque (come lo
  // farebbe un giocatore che NON ha agito) la vede.
  const s = await stato(gs);
  const ec = s.esitoCorrente;
  verifica("un giocatore che NON ha agito legge esitoCorrente da /state (non è null)", ec !== null && typeof ec === "object");
  verifica("esitoCorrente.richiestaId = il momento risolto (decalogo-ginnastica)", ec.richiestaId === "decalogo-ginnastica");
  verifica("esitoCorrente.esito = lo stesso testo mostrato all'attore", ec.esito === "Il tempo è peggiore, ma la squadra arriva unita.");
  verifica("esitoCorrente.tiro è null per una risposta a effetto fisso", ec.tiro === null);
  verifica("esitoCorrente.complicazione null e esitoNodo null (momento intermedio)", ec.complicazione === null && ec.esitoNodo === null);
  verifica("esitoCorrente.prossimaRichiestaId punta al momento successivo (corri-prima)", ec.prossimaRichiestaId === "corri-prima");
  verifica("esitoCorrente NON contiene token né segreti del Riconoscimento", !contieneChiaveSensibile(ec));
  verifica("esitoCorrente NON contiene giocatoreId (non è un dato privato di chi ha agito)", !("giocatoreId" in ec));
}

console.log("\n--- momento con tiro: la vista corrente porta i dati del tiro ---");
{
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20); // tiro sicuro (non decide l'esito qui)
  // decalogo-ginnastica, risposta 0: tiro su cadenza.
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  const ec = (await stato(gs)).esitoCorrente;
  verifica("esitoCorrente.tiro è presente per una risposta con tiro", ec.tiro !== null && typeof ec.tiro === "object");
  verifica("esitoCorrente.tiro ha esito/competenza/dado/totale", ["esito", "competenza", "dado", "totale"].every((k) => k in ec.tiro));
  verifica("esitoCorrente.competenzaId = cadenza", ec.competenzaId === "cadenza");
  verifica("esitoCorrente.esito è un testo non vuoto (uno dei tier)", typeof ec.esito === "string" && ec.esito.length > 0);
}

console.log("\n--- momento-passaggio (corri-prima): esito VUOTO ma presente, non assente ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 2, giocatoreId, token }); // -> corri-prima attivo
  const scelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token }); // risolve corri-prima
  verifica("la risposta HTTP di corri-prima ha esito vuoto (invariato rispetto a oggi)", scelta.json.esito === "");
  const ec = (await stato(gs)).esitoCorrente;
  verifica("dopo corri-prima esitoCorrente è PRESENTE (non null)", ec !== null && typeof ec === "object");
  verifica("esitoCorrente.richiestaId = corri-prima", ec.richiestaId === "corri-prima");
  verifica("esitoCorrente.esito è la stringa vuota (coerente col passaggio), non assente", ec.esito === "");
  verifica("esitoCorrente.prossimaRichiestaId = ordine-che-non-arriva", ec.prossimaRichiestaId === "ordine-che-non-arriva");
}

console.log("\n--- azzeramento al cambio nodo ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 2, giocatoreId, token });
  verifica("dopo una risoluzione esitoCorrente non è null", (await stato(gs)).esitoCorrente !== null);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  verifica("avviando (o cambiando) nodo, esitoCorrente torna null", (await stato(gs)).esitoCorrente === null);
}

console.log("\n--- retrocompatibilità: sessione salvata senza il campo ---");
{
  const { gs, storage } = nuovaSessione();
  await joinComandante(gs);
  const vecchia = await storage.get("session");
  delete vecchia.esitoCorrente;
  await storage.put("session", vecchia);
  const s = await stato(gs);
  verifica("/state su sessione priva del campo lo ripristina a null (migrateState)", s.esitoCorrente === null);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
