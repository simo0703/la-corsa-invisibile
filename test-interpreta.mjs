// Test locale: node test-interpreta.mjs
//
// Verifica isolata del collegamento dell'interprete di testo libero al
// flusso di gioco: applicaRisposta() estratta e riusata, /interpreta nei
// suoi tre esiti (automatica/manuale/nessuna_corrispondenza),
// /risolvi-interpretazione (applica o annulla). Usa la libreria REALE di
// "decalogo-ginnastica" (nodo 1836-torino), iniettata in modo portabile
// (testo del .md letto da fs + creaPool via registraLibreria) — stesso
// meccanismo già usato per il Cronista in test-scegli-cronista.mjs,
// perché sotto Node puro l'import del .md non si risolve (solo Wrangler
// lo risolve, vedi interprete-registro-librerie.js).

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
  const gs = new GameSession({ storage }, {});
  return { gs, storage };
}

// Fa /crea + /join con un tokenCreazione valido: il giocatore risultante è
// DAVVERO comandante (il primo giocatore di una stanza NON lo è più
// automaticamente, vedi GameSession.js) -- scorciatoia per i test che
// devono compiere azioni riservate (/avvia-nodo, /risolvi-interpretazione)
// e non stanno testando l'assegnazione del comandante in sé. Stessa logica
// minima di joinComandante() in test-game-session.mjs, duplicata qui
// perché i due file di test non condividono utility.
async function joinComandante(gs, nome = "Prova", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori[0].id, token: join.json.token };
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

async function impostaCompetenza(storage, giocatoreId, competenzaId, valore) {
  const session = await storage.get("session");
  const giocatore = session.giocatori.find((g) => g.id === giocatoreId);
  giocatore.competenze[competenzaId] = valore;
  await storage.put("session", session);
}

// Iniezione portabile della libreria reale (letta da fs, non dall'import
// del .md che sotto Node non si risolve). Registrata una volta, vale per
// tutto il file: ogni test crea una sessione nuova, il registro è un
// singleton di modulo condiviso ma questo non causa interferenze perché
// registra sempre la STESSA libreria per la STESSA richiesta.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testoLibreriaGinnastica = readFileSync(
  path.join(__dirname, "src", "lib", "interprete-libero", "1836-torino", "decalogo-ginnastica.md"),
  "utf8"
);
const opzioniGinnastica = analizzaLibreria(testoLibreriaGinnastica);
registraLibreria("decalogo-ginnastica", () => Promise.resolve({ opzioni: opzioniGinnastica }));

async function sessionePronta() {
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  return { gs, storage, giocatoreId, token };
}

console.log("--- /interpreta: esito \"automatica\" ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20); // forza tier "pieno"
  const { status, json } = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "vado più veloce che posso",
    richiestaId: "decalogo-ginnastica",
    giocatoreId,
    token,
  });
  verifica("risponde 200", status === 200);
  verifica(
    "stessa forma di risposta di /scegli (session, esito, prossimaRichiesta, esitoNodo, complicazione, tiro)",
    "session" in json && "esito" in json && "prossimaRichiesta" in json &&
      "esitoNodo" in json && "complicazione" in json && "tiro" in json
  );
  verifica("la risposta trovata è quella giusta (fretta-rischio -> risposteIndice 0, ha un tiro)", json.tiro !== null);
  verifica("il tier del tiro è \"pieno\" (competenza forzata)", json.tiro.esito === "pieno");
  verifica("gli effetti applicati sono quelli della risposta 0, tier pieno (cadenza +3)", json.session.risorseDiSquadra.cadenza === 3);
  verifica(
    "la ramificazione è quella della risposta 0 (verso decalogo-vaira-severo)",
    json.prossimaRichiesta && json.prossimaRichiesta.id === "decalogo-vaira-severo"
  );
  verifica(
    "storicoScelte registra la scelta come se fosse stato un click",
    json.session.storicoScelte.length === 1 && json.session.storicoScelte[0].giocatoreId === giocatoreId
  );
}

console.log("\n--- /interpreta: esito \"manuale\" ---");
{
  const { gs, giocatoreId, token } = await sessionePronta();
  const { status, json } = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId,
    token,
  });
  verifica("risponde 200", status === 200);
  verifica("esito \"manuale\"", json.esito === "manuale");
  verifica(
    "session.interpretazionePendente è popolato",
    json.session.interpretazionePendente !== null
  );
  const pendente = json.session.interpretazionePendente;
  verifica("registra chi ha scritto e cosa", pendente.giocatoreId === giocatoreId && pendente.testoLibero === "corro");
  verifica("registra la richiesta corretta", pendente.richiestaId === "decalogo-ginnastica");
  verifica(
    "i candidati includono fretta-rischio e metodo-forze, con punteggio e testo della risposta",
    pendente.candidati.length === 2 &&
      pendente.candidati.every((c) => typeof c.punteggio === "number" && typeof c.testoRisposta === "string")
  );
  verifica("nessuna scelta applicata nel frattempo (storicoScelte vuoto)", json.session.storicoScelte.length === 0);
}

console.log("\n--- /interpreta: esito \"nessuna_corrispondenza\" ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  const primaDiChiamare = await storage.get("session");
  const { status, json } = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "oggi ho mangiato una mela",
    richiestaId: "decalogo-ginnastica",
    giocatoreId,
    token,
  });
  verifica("risponde 200", status === 200);
  verifica("esito \"nessuna_corrispondenza\", nessun campo session nella risposta", json.esito === "nessuna_corrispondenza" && !("session" in json));
  const dopoLaChiamata = await storage.get("session");
  verifica("lo stato della sessione non è cambiato affatto", JSON.stringify(primaDiChiamare) === JSON.stringify(dopoLaChiamata));
}

console.log("\n--- /interpreta: richiesta senza libreria registrata ---");
{
  const { gs, giocatoreId, token } = await sessionePronta();
  const { status, json } = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "qualunque cosa",
    richiestaId: "richiesta-senza-libreria",
    giocatoreId,
    token,
  });
  verifica("risponde 400 con messaggio chiaro", status === 400);
}

console.log("\n--- /risolvi-interpretazione: applica il candidato scelto dal comandante ---");
{
  const { gs, giocatoreId, token } = await sessionePronta();
  await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId,
    token,
  });
  // Il comandante sceglie "metodo-forze" (risposteIndice 1, effetto fisso, niente tiro).
  const { status, json } = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    risposteIndice: 1,
    giocatoreId,
    token,
  });
  verifica("risponde 200", status === 200);
  verifica("interpretazionePendente è stata svuotata", json.session.interpretazionePendente === null);
  verifica("l'effetto della risposta 1 è stato applicato (cadenza +1)", json.session.risorseDiSquadra.cadenza === 1);
  verifica("nessun tiro (risposta 1 non ha competenzaRichiesta)", json.tiro === null);
  verifica("la scelta è attribuita al giocatore che aveva scritto il testo libero", json.session.storicoScelte[0].giocatoreId === giocatoreId);
}

console.log("\n--- /risolvi-interpretazione: annulla, nessun effetto applicato ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId,
    token,
  });
  const { status, json } = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    annulla: true,
    giocatoreId,
    token,
  });
  verifica("risponde 200", status === 200);
  verifica("interpretazionePendente è stata svuotata", json.session.interpretazionePendente === null);
  verifica("nessun effetto applicato (risorse tutte a zero)", Object.values(json.session.risorseDiSquadra).every((v) => v === 0));
  verifica("nessuna scelta registrata nello storico", json.session.storicoScelte.length === 0);
  const richiestaDopo = await chiamata(gs, "/richiesta-attiva");
  verifica(
    "il giocatore resta davanti alla stessa richiesta, pronto a riprovare",
    richiestaDopo.json.richiestaAttiva.id === "decalogo-ginnastica"
  );
}

console.log("\n--- /risolvi-interpretazione: nessuna interpretazione pendente ---");
{
  const { gs, giocatoreId, token } = await sessionePronta();
  const { status } = await chiamata(gs, "/risolvi-interpretazione", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("risponde 400", status === 400);
}

console.log("\n--- /risolvi-interpretazione: la richiesta è cambiata nel frattempo (scarta senza applicare) ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId,
    token,
  });
  // Simula: qualcun altro ha fatto avanzare la richiesta nel frattempo
  // (es. un altro giocatore ha cliccato un bottone), da un altro dispositivo.
  const session = await storage.get("session");
  session.richiestaAttivaId = "decalogo-vaira";
  await storage.put("session", session);

  const { status, json } = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    risposteIndice: 0,
    giocatoreId,
    token,
  });
  verifica("risponde 409, non applica alla richiesta sbagliata", status === 409);
  const dopo = await storage.get("session");
  verifica("interpretazionePendente viene comunque svuotata (scartata)", dopo.interpretazionePendente === null);
  verifica("nessuna scelta è stata registrata", dopo.storicoScelte.length === 0);
}

console.log("\n--- Autenticazione: /interpreta e /risolvi-interpretazione ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const gregario = await chiamata(gs, "/join", "POST", { nome: "Gregario", ruolo: "custode" });
  const idGregario = gregario.json.giocatori[1].id;
  const tokenGregario = gregario.json.token;
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId: idComandante, token: tokenComandante });

  const senzaToken = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId: idComandante,
  });
  verifica("/interpreta senza token risponde 400", senzaToken.status === 400);

  const tokenSbagliato = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId: idComandante,
    token: "token-inventato",
  });
  verifica("/interpreta con token sbagliato risponde 401", tokenSbagliato.status === 401);

  // /interpreta NON è un'azione riservata: un giocatore non comandante, con
  // identità valida, deve poter usarla normalmente.
  const nonComandanteOk = await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "oggi ho mangiato una mela",
    richiestaId: "decalogo-ginnastica",
    giocatoreId: idGregario,
    token: tokenGregario,
  });
  verifica("/interpreta funziona per un giocatore non comandante (non è un'azione riservata)", nonComandanteOk.status === 200);

  // Serve un'interpretazione pendente prima di poter testare /risolvi-interpretazione.
  await chiamata(gs, "/interpreta", "POST", {
    testoLibero: "corro",
    richiestaId: "decalogo-ginnastica",
    giocatoreId: idComandante,
    token: tokenComandante,
  });

  const risolviSenzaToken = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    risposteIndice: 1,
    giocatoreId: idComandante,
  });
  verifica("/risolvi-interpretazione senza token risponde 400", risolviSenzaToken.status === 400);

  const risolviTokenSbagliato = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    risposteIndice: 1,
    giocatoreId: idComandante,
    token: "token-inventato",
  });
  verifica("/risolvi-interpretazione con token sbagliato risponde 401", risolviTokenSbagliato.status === 401);

  const risolviNonComandante = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    risposteIndice: 1,
    giocatoreId: idGregario,
    token: tokenGregario,
  });
  verifica("/risolvi-interpretazione chiamato da un non comandante risponde 403", risolviNonComandante.status === 403);

  const risolviOk = await chiamata(gs, "/risolvi-interpretazione", "POST", {
    risposteIndice: 1,
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("/risolvi-interpretazione con comandante autenticato funziona", risolviOk.status === 200);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
