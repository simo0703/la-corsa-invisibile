// Test locale: node test-scegli-giocatore.mjs
//
// Verifica isolata di un singolo pezzo di GameSession.js: POST /scegli ora
// richiede un giocatoreId valido (che deve corrispondere a un giocatore già
// unito alla stanza con /join) e lo registra in ogni voce di storicoScelte.
// Non tocca risoluzione.js né alcun campo per dichiarare un tiro — quello è
// il passo successivo, volutamente separato.
//
// Stessa impostazione di test-game-session.mjs: simula il Durable Object in
// locale con uno storage in memoria, nessun bisogno di wrangler/miniflare.

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

function nuovaSessione() {
  const storage = creaStorageFinto();
  const gs = new GameSession({ storage }, {});
  return { gs, storage };
}

async function chiamata(gs, path, method = "GET", body = null) {
  const init = { method };
  if (body !== null) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const risposta = await gs.fetch(new Request(`https://fake.test/room/xyz${path}`, init));
  const testo = await risposta.text();
  let json = null;
  try {
    json = JSON.parse(testo);
  } catch {
    json = null;
  }
  return { status: risposta.status, json, testo };
}

// Fa /crea + /join con un tokenCreazione valido, cosi' il giocatore
// risultante e' davvero comandante (serve per compiere /avvia-nodo, azione
// riservata -- vedi autenticaComandante() in GameSession.js).
async function joinComandante(gs, nome = "Prova", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori[0].id, token: join.json.token };
}

// Scorciatoia comune a più test: crea una sessione, unisce un giocatore e
// avvia il nodo "1836-torino" (la prima richiesta ha sempre 3 risposte).
async function sessionePronta() {
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  return { gs, storage, giocatoreId, token };
}

console.log("--- giocatoreId mancante ---");
{
  const { gs } = await sessionePronta();
  const { status, testo } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0 });
  verifica("senza giocatoreId nel body, risponde 400", status === 400);
  verifica("il messaggio spiega che manca il giocatoreId (o il token)", testo.includes("giocatoreId") && testo.includes("mancante"));
}

console.log("\n--- giocatoreId presente ma sconosciuto alla stanza ---");
{
  const { gs } = await sessionePronta();
  const { status, testo } = await chiamata(gs, "/scegli", "POST", {
    risposteIndice: 0,
    giocatoreId: "id-inventato-non-unito",
    token: "token-qualsiasi", // presente ma non associato a nessun giocatore: fa scattare "sconosciuto", non "mancante"
  });
  verifica("con un giocatoreId che non corrisponde a nessun giocatore unito, risponde 400", status === 400);
  verifica("il messaggio spiega che il giocatoreId è sconosciuto", testo.includes("sconosciuto"));
}

console.log("\n--- giocatoreId di un'ALTRA stanza non è valido qui ---");
{
  const { gs: stanzaA } = await sessionePronta();
  const { giocatoreId: giocatoreDellaStanzaB, token: tokenDellaStanzaB } = await sessionePronta(); // sessione B, mai unita ad A
  const { status } = await chiamata(stanzaA, "/scegli", "POST", {
    risposteIndice: 0,
    giocatoreId: giocatoreDellaStanzaB,
    token: tokenDellaStanzaB,
  });
  verifica("un giocatoreId valido altrove ma non in QUESTA stanza risponde comunque 400", status === 400);
}

console.log("\n--- giocatoreId valido: la scelta va a buon fine ---");
{
  const { gs, giocatoreId, token } = await sessionePronta();
  const { status, json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("con un giocatoreId valido, la scelta risponde 200", status === 200);
  verifica(
    "storicoScelte registra il giocatoreId di chi ha scelto",
    json.session.storicoScelte[0].giocatoreId === giocatoreId
  );
  verifica(
    "storicoScelte continua a registrare anche gli altri campi di sempre",
    json.session.storicoScelte[0].richiestaId === "decalogo-ginnastica" &&
      typeof json.session.storicoScelte[0].esito === "string" &&
      typeof json.session.storicoScelte[0].timestamp === "string"
  );
}

console.log("\n--- due giocatori diversi nella stessa stanza: lo storico distingue chi ha scelto quando ---");
{
  const { gs, storage } = nuovaSessione();
  // A si unisce col tokenCreazione: è lei la comandante, serve per /avvia-nodo.
  const { giocatoreId: giocatoreA, token: tokenA } = await joinComandante(gs, "Prima", "esploratore");
  const joinB = await chiamata(gs, "/join", "POST", { nome: "Seconda", ruolo: "custode" });
  const giocatoreB = joinB.json.giocatori.find((g) => g.nome === "Seconda").id;
  const tokenB = joinB.json.token;
  verifica("i due giocatori uniti hanno id diversi", giocatoreA !== giocatoreB);

  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId: giocatoreA, token: tokenA });
  // decalogo-ginnastica, risposta 1 ("con metodo") -> prossima: decalogo-vaira
  const sceltaA = await chiamata(gs, "/scegli", "POST", { risposteIndice: 1, giocatoreId: giocatoreA, token: tokenA });
  verifica("la prima scelta è di A", sceltaA.json.session.storicoScelte[0].giocatoreId === giocatoreA);

  // decalogo-vaira, risposta 0 ("dichiara la paura") -> prossima: null, fine ramo
  const sceltaB = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId: giocatoreB, token: tokenB });
  verifica("la seconda scelta è di B", sceltaB.json.session.storicoScelte[1].giocatoreId === giocatoreB);
  verifica(
    "lo storico ha due voci, una per giocatore, nell'ordine in cui hanno scelto",
    sceltaB.json.session.storicoScelte.length === 2 &&
      sceltaB.json.session.storicoScelte[0].giocatoreId === giocatoreA &&
      sceltaB.json.session.storicoScelte[1].giocatoreId === giocatoreB
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
