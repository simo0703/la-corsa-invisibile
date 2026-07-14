// Test locale: node test-rifiuto-comandante.mjs
//
// Difetto #6: il rifiuto del comandante non è più muto. Quando il comandante
// annulla una proposta di testo libero (POST /risolvi-interpretazione con
// { annulla: true }), il server popola session.rifiutoCorrente = { richiestaId,
// giocatoreNome, testoProposta, timestamp } nello STATO CONDIVISO (viaggia in
// sessionPubblica, nessun segreto). Qui si verifica: popolamento al rifiuto,
// presenza in /state, e l'azzeramento nei tre casi (scelta/risoluzione sullo
// stesso momento, nuova proposta sullo stesso momento, cambio nodo).
//
// Usa la libreria REALE di "decalogo-ginnastica" iniettata in modo portabile
// (testo del .md letto da fs), stesso meccanismo di test-interpreta.mjs: sotto
// Node puro l'import del .md non si risolve. "corro" è ambiguo → esito manuale.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { GameSession } from "./src/durable-objects/GameSession.js";
import { registraLibreria } from "./src/lib/interprete-registro-librerie.js";
import { analizzaLibreria } from "simulatore-interprete/src/libreria.js";

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

function nuovaSessione() {
  const storage = creaStorageFinto();
  return { gs: new GameSession({ storage }, {}), storage };
}

async function chiamata(gs, path_, method = "GET", body = null) {
  const init = { method };
  if (body !== null) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const risposta = await gs.fetch(new Request(`https://fake.test/room/xyz${path_}`, init));
  let json = null;
  try {
    json = await risposta.json();
  } catch {
    json = null;
  }
  return { status: risposta.status, json };
}

async function joinComandante(gs, nome = "Comandante", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori[0].id, token: join.json.token };
}

// Iniezione portabile della libreria reale (come test-interpreta.mjs).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testoLibreriaGinnastica = readFileSync(
  path.join(__dirname, "src", "lib", "interprete-libero", "1836-torino", "decalogo-ginnastica.md"),
  "utf8"
);
const opzioniGinnastica = analizzaLibreria(testoLibreriaGinnastica);
registraLibreria("decalogo-ginnastica", () => Promise.resolve({ opzioni: opzioniGinnastica }));

// Stanza pronta: comandante + un proponente (Bruno, non comandante), nodo
// 1836-torino avviato, con la proposta ambigua "corro" di Bruno in attesa.
async function scenarioConProposta() {
  const { gs, storage } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs);
  const joinBruno = await chiamata(gs, "/join", "POST", { nome: "Bruno", ruolo: "custode" });
  const idBruno = joinBruno.json.giocatori[1].id;
  const tokenBruno = joinBruno.json.token;
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId: idComandante, token: tokenComandante });
  const interp = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId: idBruno,
    token: tokenBruno,
  });
  if (interp.json.esito !== "manuale") throw new Error("setup fallito: 'corro' non è più ambiguo");
  return { gs, storage, idComandante, tokenComandante, idBruno, tokenBruno };
}

console.log("--- rifiuto: popola rifiutoCorrente ed esce da /state ---");
{
  const { gs, idComandante, tokenComandante } = await scenarioConProposta();
  const { status, json } = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    annulla: true,
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("il rifiuto risponde 200", status === 200);
  verifica("interpretazionePendente svuotata", json.session.interpretazionePendente === null);
  const r = json.session.rifiutoCorrente;
  verifica("rifiutoCorrente è popolato", !!r);
  verifica("richiestaId è quella del momento", r && r.richiestaId === "decalogo-ginnastica");
  verifica("giocatoreNome è il proponente (Bruno), non il comandante", r && r.giocatoreNome === "Bruno");
  verifica("testoProposta è la frase rifiutata", r && r.testoProposta === "corro");
  verifica("timestamp è una stringa ISO", r && typeof r.timestamp === "string" && !Number.isNaN(Date.parse(r.timestamp)));
  // Esce da /state (sessionPubblica), leggibile da chiunque al tavolo.
  const stato = await chiamata(gs, "/state");
  verifica("rifiutoCorrente viaggia in /state (sessionPubblica)", stato.json.rifiutoCorrente && stato.json.rifiutoCorrente.testoProposta === "corro");
  verifica("nessun segreto: rifiutoCorrente ha solo i 4 campi attesi",
    Object.keys(stato.json.rifiutoCorrente).sort().join(",") === "giocatoreNome,richiestaId,testoProposta,timestamp");
}

console.log("\n--- azzeramento (1): una SCELTA sullo stesso momento risolve ---");
{
  const { gs, idComandante, tokenComandante, idBruno, tokenBruno } = await scenarioConProposta();
  await chiamata(gs, "/risolvi-interpretazione", "POST", { annulla: true, giocatoreId: idComandante, token: tokenComandante });
  // Un giocatore sceglie un bottone: applicaRisposta risolve il momento.
  const scelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 1, giocatoreId: idBruno, token: tokenBruno });
  verifica("la scelta risponde 200", scelta.status === 200);
  verifica("rifiutoCorrente azzerato dopo una scelta (momento risolto)", scelta.json.session.rifiutoCorrente === null);
  verifica("al suo posto c'è esitoCorrente del momento risolto", scelta.json.session.esitoCorrente && scelta.json.session.esitoCorrente.richiestaId === "decalogo-ginnastica");
}

console.log("\n--- azzeramento (2): una NUOVA proposta sullo stesso momento ---");
{
  const { gs, idComandante, tokenComandante, idBruno, tokenBruno } = await scenarioConProposta();
  await chiamata(gs, "/risolvi-interpretazione", "POST", { annulla: true, giocatoreId: idComandante, token: tokenComandante });
  // Bruno riprova con un'altra frase ambigua: nuova pendente, il vecchio
  // avviso di rifiuto deve sparire.
  const riprova = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId: idBruno,
    token: tokenBruno,
  });
  verifica("la nuova proposta è di nuovo manuale", riprova.json.esito === "manuale");
  verifica("rifiutoCorrente azzerato dall'arrivo di una nuova proposta", riprova.json.session.rifiutoCorrente === null);
  verifica("ora c'è una nuova interpretazionePendente", riprova.json.session.interpretazionePendente !== null);
}

console.log("\n--- azzeramento (3): CAMBIO NODO ---");
{
  const { gs, storage, idComandante, tokenComandante } = await scenarioConProposta();
  await chiamata(gs, "/risolvi-interpretazione", "POST", { annulla: true, giocatoreId: idComandante, token: tokenComandante });
  const prima = await storage.get("session");
  verifica("rifiutoCorrente presente prima del cambio nodo", prima.rifiutoCorrente !== null);
  const avvio = await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1848-milano", giocatoreId: idComandante, token: tokenComandante });
  verifica("cambio nodo risponde 200", avvio.status === 200);
  verifica("rifiutoCorrente azzerato al cambio nodo", avvio.json.session.rifiutoCorrente === null);
}

console.log("\n--- il rifiuto NON scatta se il comandante applica un candidato (non è un rifiuto) ---");
{
  const { gs, idComandante, tokenComandante } = await scenarioConProposta();
  const applica = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    risposteIndice: 1,
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("applica il candidato: 200", applica.status === 200);
  verifica("nessun rifiutoCorrente quando il comandante ACCOGLIE un candidato", applica.json.session.rifiutoCorrente === null);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
