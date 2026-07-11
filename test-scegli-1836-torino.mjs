// Test locale: node test-scegli-1836-torino.mjs
//
// Verifica end-to-end del Passo 9 sul nodo REALE "1836-torino"
// (game-config.js), non su un nodo di prova sintetico: la prima risposta di
// "decalogo-ginnastica" ("A tutta velocità, senza calcolare i rischi") è
// stata convertita da effetto fisso a competenzaRichiesta: "cadenza" +
// effettiPerEsito + esito per tier. Le altre due risposte della stessa
// richiesta restano a effetto fisso: qui verifichiamo che le due forme
// convivano davvero nello stesso nodo reale, non solo in astratto.
//
// Il collegamento generico tiro <-> GameSession è già testato a fondo in
// test-scegli-risoluzione.mjs (nodo di prova sintetico, tutti i casi di
// robustezza). Questo file si concentra sul contenuto vero: i numeri e i
// testi scritti in game-config.js per questa risposta specifica, e sul
// percorso di gioco reale (branching verso decalogo-vaira-severo incluso).

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

// Fa /crea + /join con un tokenCreazione valido, cosi' il giocatore
// risultante e' davvero comandante (serve per compiere /avvia-nodo, azione
// riservata -- vedi autenticaComandante() in GameSession.js).
async function joinComandante(gs, nome = "Prova", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori[0].id, token: join.json.token };
}

async function sessionePronta() {
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  return { gs, storage, giocatoreId, token };
}

console.log("--- tier pieno (punteggio forzato molto alto) ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20);
  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro è \"pieno\"", json.tiro && json.tiro.esito === "pieno");
  verifica(
    "effetti del tier pieno: cadenza +3, margine +1, spiritoDiCorpo invariato",
    json.session.risorseDiSquadra.cadenza === 3 &&
      json.session.margine === 1 &&
      json.session.risorseDiSquadra.spiritoDiCorpo === 0
  );
  verifica(
    "esito testuale del tier pieno",
    json.esito ===
      "Il ritmo è perfetto, il corpo risponde a ogni comando: arrivate per primi senza sprecare un solo passo."
  );
  verifica(
    "la ramificazione va comunque verso il ramo severo (dipende dalla scelta, non dal tiro)",
    json.prossimaRichiesta && json.prossimaRichiesta.id === "decalogo-vaira-severo"
  );
}

console.log("\n--- tier fallimento (punteggio forzato molto basso) ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", -10);
  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro è \"fallimento\"", json.tiro && json.tiro.esito === "fallimento");
  verifica(
    "effetti del tier fallimento: cadenza +1, spiritoDiCorpo -2, margine +3",
    json.session.risorseDiSquadra.cadenza === 1 &&
      json.session.risorseDiSquadra.spiritoDiCorpo === -2 &&
      json.session.margine === 3
  );
  verifica(
    "esito testuale del tier fallimento",
    json.esito ===
      "La fretta vi tradisce: un piede sbaglia l'appoggio, il corpo si spezza per un istante prima di ritrovare l'equilibrio. Arrivate comunque per primi, ma il prezzo pagato si vede."
  );
  verifica(
    "la ramificazione va comunque verso il ramo severo anche in caso di fallimento",
    json.prossimaRichiesta && json.prossimaRichiesta.id === "decalogo-vaira-severo"
  );
}

console.log("\n--- con la competenza reale assegnata dal ruolo (nessun punteggio forzato) ---");
{
  // Esploratore: Cadenza è la competenza principale, punteggio 3 (da
  // creaCompetenzeIniziali). Con 1d4: totale in [4,7] -> mai "pieno" (serve
  // 8+), sempre "parziale" (3 dadi su 4) o "fallimento" (1 dado su 4). Su 30
  // tentativi la probabilità di non vedere mai "parziale" è (1/4)^30,
  // trascurabile: se il codice è corretto lo vediamo comunque.
  const tierVisti = new Set();
  let coerenteSempre = true;
  for (let i = 0; i < 30; i++) {
    const { gs, giocatoreId, token } = await sessionePronta(); // competenza reale, non forzata
    const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
    if (!json.tiro || (json.tiro.esito !== "parziale" && json.tiro.esito !== "fallimento")) {
      coerenteSempre = false;
    }
    tierVisti.add(json.tiro?.esito);

    const cadenzaAttesa = json.tiro.esito === "parziale" ? 2 : 1;
    const spiritoAtteso = json.tiro.esito === "parziale" ? -1 : -2;
    const margineAtteso = json.tiro.esito === "parziale" ? 2 : 3;
    if (
      json.session.risorseDiSquadra.cadenza !== cadenzaAttesa ||
      json.session.risorseDiSquadra.spiritoDiCorpo !== spiritoAtteso ||
      json.session.margine !== margineAtteso
    ) {
      coerenteSempre = false;
    }
  }
  verifica(
    "con la Cadenza reale dell'Esploratore (3), il tiro è sempre parziale o fallimento, mai pieno",
    coerenteSempre
  );
  verifica("su 30 tentativi si vede almeno un tier \"parziale\"", tierVisti.has("parziale"));
}

console.log("\n--- coesistenza nello stesso nodo: le altre risposte restano a effetto fisso ---");
{
  const { gs: gsMetodo, giocatoreId: idMetodo, token: tokenMetodo } = await sessionePronta();
  const metodo = await chiamata(gsMetodo, "/scegli", "POST", { risposteIndice: 1, giocatoreId: idMetodo, token: tokenMetodo });
  verifica("\"con metodo\" (indice 1) non ha tiro", metodo.json.tiro === null);
  verifica("\"con metodo\" applica il suo effetto fisso invariato (cadenza +1)", metodo.json.session.risorseDiSquadra.cadenza === 1);
  verifica("\"con metodo\" mostra ancora il suo esito fisso invariato", metodo.json.esito === "Meno brillanti, ma nessuno resta indietro.");
  verifica(
    "\"con metodo\" porta al ramo normale, non a quello severo",
    metodo.json.prossimaRichiesta && metodo.json.prossimaRichiesta.id === "decalogo-vaira"
  );

  const { gs: gsAiuto, giocatoreId: idAiuto, token: tokenAiuto } = await sessionePronta();
  const aiuto = await chiamata(gsAiuto, "/scegli", "POST", { risposteIndice: 2, giocatoreId: idAiuto, token: tokenAiuto });
  verifica("\"aiutando chi fatica di più\" (indice 2) non ha tiro", aiuto.json.tiro === null);
  verifica(
    "\"aiutando chi fatica di più\" applica il suo effetto fisso invariato (spiritoDiCorpo +1)",
    aiuto.json.session.risorseDiSquadra.spiritoDiCorpo === 1
  );
}

console.log("\n--- percorso completo: dalla risposta con tiro alla chiusura del nodo ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", -10); // forza "fallimento"

  const primaScelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("prima scelta: tiro fallimento registrato", primaScelta.json.tiro.esito === "fallimento");
  verifica("il nodo non è ancora concluso", primaScelta.json.esitoNodo === null);

  const attiva = await chiamata(gs, "/richiesta-attiva");
  verifica("si è nel ramo severo dopo il tiro fallito", attiva.json.richiestaAttiva.id === "decalogo-vaira-severo");

  // "decalogo-vaira-severo", risposta 0: ammette la paura (effetto fisso).
  const secondaScelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("seconda scelta: nessun tiro (effetto fisso)", secondaScelta.json.tiro === null);
  verifica("il nodo si chiude con un esito finale", secondaScelta.json.esitoNodo !== null);
  verifica(
    "lo storico ha due voci, la prima con tiro e la seconda senza",
    secondaScelta.json.session.storicoScelte.length === 2 &&
      secondaScelta.json.session.storicoScelte[0].tiro !== null &&
      secondaScelta.json.session.storicoScelte[1].tiro === null
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
