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

// Colpo secco (Decisione #22): il dado 1 è sempre fallimento, quindi un
// punteggio alto da solo non rende più deterministico il tier "pieno".
// Blocca il dado sul valore massimo (Math.random fissato) per la durata
// della singola chiamata, poi ripristina il caso.
async function conDadoMassimo(fn) {
  const originale = Math.random;
  Math.random = () => 0.999; // tiraDado: 1 + floor(0.999 * 6) = 6
  try {
    return await fn();
  } finally {
    Math.random = originale;
  }
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

console.log("--- tier pieno (punteggio forzato molto alto + dado bloccato: colpo secco escluso) ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20);
  const { json } = await conDadoMassimo(() =>
    chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token })
  );
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
    "la ramificazione va comunque verso corri-prima (catena dei nuovi momenti), a prescindere dal tiro",
    json.prossimaRichiesta && json.prossimaRichiesta.id === "corri-prima"
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
    "la ramificazione va comunque verso corri-prima anche in caso di fallimento",
    json.prossimaRichiesta && json.prossimaRichiesta.id === "corri-prima"
  );
}

console.log("\n--- con la competenza reale assegnata dal ruolo (nessun punteggio forzato) ---");
{
  // Esploratore: Cadenza è la competenza principale, punteggio 3 (da
  // creaCompetenzeIniziali), e su questa competenza l'Esploratore tira 1d6
  // invece del default 1d4 (vedi `dadoFacce` sul ruolo in game-config.js).
  // Totale in [4,9]: dado 1 -> 4, fallimento; dado 2-4 -> 5-7, parziale;
  // dado 5-6 -> 8-9, pieno. A differenza del vecchio 1d4 (dove "pieno" era
  // matematicamente irraggiungibile con questo punteggio), ora tutti e tre
  // i tier sono possibili. Su 60 tentativi la probabilità di non vedere mai
  // "fallimento" (1 dado su 6) è (5/6)^60 ≈ 0.002%, trascurabile.
  const tierVisti = new Set();
  let coerenteSempre = true;
  for (let i = 0; i < 60; i++) {
    const { gs, giocatoreId, token } = await sessionePronta(); // competenza reale, non forzata
    const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
    if (!json.tiro) {
      coerenteSempre = false;
    }
    tierVisti.add(json.tiro?.esito);

    const cadenzaAttesa = { pieno: 3, parziale: 2, fallimento: 1 }[json.tiro.esito];
    const spiritoAtteso = { pieno: 0, parziale: -1, fallimento: -2 }[json.tiro.esito];
    const margineAtteso = { pieno: 1, parziale: 2, fallimento: 3 }[json.tiro.esito];
    if (
      json.session.risorseDiSquadra.cadenza !== cadenzaAttesa ||
      json.session.risorseDiSquadra.spiritoDiCorpo !== spiritoAtteso ||
      json.session.margine !== margineAtteso
    ) {
      coerenteSempre = false;
    }
  }
  verifica(
    "con la Cadenza reale dell'Esploratore (3) e il dado 1d6 di ruolo, gli effetti/margine restano coerenti col tier estratto in ogni tentativo",
    coerenteSempre
  );
  verifica("su 60 tentativi si vede almeno un tier \"parziale\"", tierVisti.has("parziale"));
  verifica(
    "su 60 tentativi si vede almeno un tier \"pieno\" (impossibile con il vecchio dado 1d4)",
    tierVisti.has("pieno")
  );
  verifica("su 60 tentativi si vede almeno un tier \"fallimento\"", tierVisti.has("fallimento"));
}

console.log("\n--- coesistenza nello stesso nodo: le altre risposte restano a effetto fisso ---");
{
  const { gs: gsMetodo, giocatoreId: idMetodo, token: tokenMetodo } = await sessionePronta();
  const metodo = await chiamata(gsMetodo, "/scegli", "POST", { risposteIndice: 1, giocatoreId: idMetodo, token: tokenMetodo });
  verifica("\"con metodo\" (indice 1) non ha tiro", metodo.json.tiro === null);
  verifica("\"con metodo\" applica il suo effetto fisso invariato (cadenza +1)", metodo.json.session.risorseDiSquadra.cadenza === 1);
  verifica("\"con metodo\" mostra ancora il suo esito fisso invariato", metodo.json.esito === "Meno brillanti, ma nessuno resta indietro.");
  verifica(
    "\"con metodo\" porta anch'essa a corri-prima (la biforcazione si è spostata al momento fiato-corto)",
    metodo.json.prossimaRichiesta && metodo.json.prossimaRichiesta.id === "corri-prima"
  );

  const { gs: gsAiuto, giocatoreId: idAiuto, token: tokenAiuto } = await sessionePronta();
  const aiuto = await chiamata(gsAiuto, "/scegli", "POST", { risposteIndice: 2, giocatoreId: idAiuto, token: tokenAiuto });
  verifica("\"aiutando chi fatica di più\" (indice 2) non ha tiro", aiuto.json.tiro === null);
  verifica(
    "\"aiutando chi fatica di più\" applica il suo effetto fisso invariato (spiritoDiCorpo +1)",
    aiuto.json.session.risorseDiSquadra.spiritoDiCorpo === 1
  );
}

console.log("\n--- percorso completo: dalla catena dei nuovi momenti alla chiusura del nodo ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", -10); // forza "fallimento" sui tiri di cadenza

  const p1 = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("momento 1: tiro fallimento registrato", p1.json.tiro.esito === "fallimento");
  verifica(
    "momento 1: il nodo non è concluso e si prosegue in catena (corri-prima)",
    p1.json.esitoNodo === null && p1.json.prossimaRichiesta && p1.json.prossimaRichiesta.id === "corri-prima"
  );

  // Traversa la catena condivisa fino a fiato-corto, scegliendo sempre l'indice 0.
  const catena = ["corri-prima", "ordine-che-non-arriva", "decisione-presa-prima", "quando-nessuno-guarda", "fiato-corto"];
  let lineare = true;
  for (const atteso of catena) {
    const attiva = await chiamata(gs, "/richiesta-attiva");
    if (attiva.json.richiestaAttiva.id !== atteso) lineare = false;
    if (atteso === "fiato-corto") break;
    await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  }
  verifica("la catena 1 → corri-prima → 3 → 4 → 5 → 6 è lineare e senza duplicati", lineare);

  // Al momento 6, la risposta 1 ("Continuate…") porta al Decalogo severo.
  const scelta6 = await chiamata(gs, "/scegli", "POST", { risposteIndice: 1, giocatoreId, token });
  verifica("momento 6, risposta 1 (continuate): nessun tiro (effetto fisso)", scelta6.json.tiro === null);
  verifica(
    "momento 6, risposta 1 porta al Decalogo severo",
    scelta6.json.prossimaRichiesta && scelta6.json.prossimaRichiesta.id === "decalogo-vaira-severo"
  );

  // Gioca il Decalogo severo fino alla chiusura del nodo.
  const attivaSevero = await chiamata(gs, "/richiesta-attiva");
  verifica("si è nel Decalogo severo", attivaSevero.json.richiestaAttiva.id === "decalogo-vaira-severo");
  const fine = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il nodo si chiude con un esito finale", fine.json.esitoNodo !== null);
  verifica(
    "il diario del nodo è chiuso con concluso_il ed esitoFinale coerenti",
    fine.json.session.storicoNodo[0].concluso_il !== null &&
      fine.json.session.storicoNodo[0].esitoFinale === fine.json.esitoNodo
  );
}

console.log("\n--- Prompt 12: struttura dei cinque momenti nuovi (lettura da game-config) ---");
{
  const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === "1836-torino");
  const risposteTiro = [];
  let bonusContesto = 0;
  for (const r of nodo.richieste) {
    for (const x of r.risposte) {
      if (x.competenzaRichiesta) risposteTiro.push(x.competenzaRichiesta);
      if (x.bonusContesto) bonusContesto += 1;
    }
  }
  verifica("il nodo ha 5 risposte a tiro (cadenza del momento 1 + una per competenza principale)", risposteTiro.length === 5);
  verifica(
    "le competenze a tiro coprono cadenza (x2), precisione, passoAvanti, spiritoDiCorpo",
    risposteTiro.filter((c) => c === "cadenza").length === 2 &&
      risposteTiro.includes("precisione") &&
      risposteTiro.includes("passoAvanti") &&
      risposteTiro.includes("spiritoDiCorpo")
  );
  verifica("nessuna risposta del nodo usa bonusContesto", bonusContesto === 0);

  const corri = nodo.richieste.find((r) => r.id === "corri-prima");
  verifica("«Corri prima» ha una sola risposta", corri.risposte.length === 1);
  verifica("«Corri prima» non ha tiro", !corri.risposte[0].competenzaRichiesta);
  verifica(
    "«Corri prima» non ha effetti (effetti vuoti)",
    corri.risposte[0].effetti && Object.keys(corri.risposte[0].effetti).length === 0
  );
  verifica("«Corri prima» ha l'etichetta approvata «Riprendete la corsa»", corri.risposte[0].testo === "Riprendete la corsa");

  const ids = nodo.richieste.map((r) => r.id);
  verifica("nessun momento è duplicato (id unici)", new Set(ids).size === ids.length);

  // Biforcazione al momento 6. `prossima` è un campo UNICO sulla risposta
  // (non per-tier): quindi la risposta 0 porta a decalogo-vaira per pieno,
  // parziale e fallimento allo stesso modo — provato per costruzione.
  const fiato = nodo.richieste.find((r) => r.id === "fiato-corto");
  verifica("fiato-corto risposta 0 è il tiro su spiritoDiCorpo", fiato.risposte[0].competenzaRichiesta === "spiritoDiCorpo");
  verifica(
    "fiato-corto risposta 0 porta a decalogo-vaira per TUTTI gli esiti del tiro (prossima unica, non per-tier)",
    fiato.risposte[0].prossima === "decalogo-vaira"
  );
  verifica(
    "fiato-corto risposta 1 (continuate, fisso) porta a decalogo-vaira-severo",
    fiato.risposte[1].prossima === "decalogo-vaira-severo"
  );
  verifica(
    "entrambi i Decaloghi restano richieste raggiungibili del nodo",
    ids.includes("decalogo-vaira") && ids.includes("decalogo-vaira-severo")
  );
}

console.log("\n--- Prompt 12: al momento 6 la risposta 0 (aiutare) porta al Decalogo normale, anche col tiro fallito ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  // Traversa fino a fiato-corto scegliendo indice 0: cinque scelte, una per
  // ciascun momento da decalogo-ginnastica a quando-nessuno-guarda.
  for (const _ of ["decalogo-ginnastica", "corri-prima", "ordine-che-non-arriva", "decisione-presa-prima", "quando-nessuno-guarda"]) {
    await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  }
  const attiva = await chiamata(gs, "/richiesta-attiva");
  verifica("si è arrivati a fiato-corto", attiva.json.richiestaAttiva.id === "fiato-corto");
  // Forza il tiro di spiritoDiCorpo a fallimento: il ramo non deve cambiare.
  await impostaCompetenza(storage, giocatoreId, "spiritoDiCorpo", -10);
  const scelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro di spiritoDiCorpo è fallimento", scelta.json.tiro && scelta.json.tiro.esito === "fallimento");
  verifica(
    "anche col tiro fallito, la risposta 0 porta al Decalogo normale (conta il gesto, non la riuscita)",
    scelta.json.prossimaRichiesta && scelta.json.prossimaRichiesta.id === "decalogo-vaira"
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
