// Test locale: node test-game-session.mjs
//
// NOTA: questo file è una RICOSTRUZIONE. L'originale scritto nel Passo 2 è
// andato perso (mai caricato su GitHub prima che la sessione che lo aveva
// scritto si chiudesse). Non è detto sia identico riga per riga a quello,
// ma verifica lo stesso comportamento descritto nel changelog: ramificazione,
// avanzamento dell'orologio, variazioni del margine (inclusa la soglia che
// scatta la complicazione), chiusura del nodo, e il fallback in sequenza per
// i nodi senza campo "prossima".
//
// Simula il Durable Object in locale con uno storage in memoria (nessun
// bisogno di wrangler/miniflare né di pubblicare su Cloudflare).

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

// Storage in memoria che imita l'API state.storage di un Durable Object.
// Clona i dati in entrata/uscita (via structuredClone) per comportarsi come
// una vera persistenza: mutare l'oggetto restituito da get() non deve
// toccare quanto salvato finché non si richiama put().
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

// Forza il punteggio di una competenza direttamente nello storage: serve a
// rendere deterministico l'esito di un tiro nei test (il dado non è
// forzabile dall'API pubblica, giustamente).
async function impostaCompetenza(storage, giocatoreId, competenzaId, valore) {
  const session = await storage.get("session");
  const giocatore = session.giocatori.find((g) => g.id === giocatoreId);
  giocatore.competenze[competenzaId] = valore;
  await storage.put("session", session);
}

// Scorciatoia per chiamare gs.fetch() come farebbe il Worker, con un path
// e un body opzionali, restituendo direttamente il JSON già parsato.
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

console.log("--- Stato iniziale ---");
{
  const { gs } = nuovaSessione();
  const { status, json } = await chiamata(gs, "/state");
  verifica("GET /state risponde 200", status === 200);
  verifica("orologio parte a 0", json.orologio === 0);
  verifica("margine parte a 0", json.margine === 0);
  verifica("nodoAttivo parte a null", json.nodoAttivo === null);
  verifica("nessun giocatore all'inizio", json.giocatori.length === 0);
  verifica("storicoNodo vuoto all'inizio", json.storicoNodo.length === 0);
  verifica("aiUsageStanza parte a 0", json.aiUsageStanza === 0);
}

console.log("\n--- /join ---");
{
  const { gs } = nuovaSessione();
  const { status, json } = await chiamata(gs, "/join", "POST", {
    nome: "Prova",
    ruolo: "esploratore",
  });
  verifica("POST /join risponde 200", status === 200);
  verifica("il giocatore viene aggiunto", json.giocatori.length === 1);
  verifica("il giocatore ha un id assegnato", typeof json.giocatori[0].id === "string" && json.giocatori[0].id.length > 0);
  verifica(
    "le competenze vengono assegnate in base al ruolo (Esploratore: Cadenza principale a 3)",
    json.giocatori[0].competenze.cadenza === 3 && json.giocatori[0].competenze.precisione === 1
  );
  verifica("il primo giocatore della stanza diventa comandante", json.giocatori[0].comandante === true);

  const secondo = await chiamata(gs, "/join", "POST", { nome: "Seconda", ruolo: "custode" });
  verifica(
    "il secondo giocatore NON è comandante",
    secondo.json.giocatori[1].comandante === false
  );

  const ruoloIgnoto = await chiamata(gs, "/join", "POST", { nome: "Altro", ruolo: "non-esiste" });
  verifica("un ruolo sconosciuto risponde 400", ruoloIgnoto.status === 400);
}

console.log("\n--- /risorse ---");
{
  const { gs } = nuovaSessione();
  const ok = await chiamata(gs, "/risorse", "POST", { risorsa: "cadenza", delta: 3 });
  verifica("modifica una risorsa nota", ok.json.risorseDiSquadra.cadenza === 3);
  const male = await chiamata(gs, "/risorse", "POST", { risorsa: "non-esiste", delta: 1 });
  verifica("una risorsa sconosciuta risponde 400", male.status === 400);

  // Il margine non è dentro risorseDiSquadra ma è accettato come chiave
  // speciale, con lo stesso pattern delta (per il pannello del comandante).
  const su = await chiamata(gs, "/risorse", "POST", { risorsa: "margine", delta: 2 });
  verifica("il margine sale con un delta positivo", su.json.margine === 2);
  const giu = await chiamata(gs, "/risorse", "POST", { risorsa: "margine", delta: -3 });
  verifica("il margine scende con un delta negativo, senza limiti imposti qui", giu.json.margine === -1);
}

console.log("\n--- avvia-nodo + richiesta-attiva ---");
{
  const { gs } = nuovaSessione();
  const avvio = await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino" });
  verifica("avvia il nodo richiesto", avvio.json.session.nodoAttivo === "1836-torino");
  verifica(
    "la prima richiesta attiva è quella giusta",
    avvio.json.richiestaAttiva.id === "decalogo-ginnastica"
  );
  verifica("registra l'inizio nel diario del nodo", avvio.json.session.storicoNodo.length === 1);
  verifica(
    "il diario ha iniziato_il ma non concluso_il",
    avvio.json.session.storicoNodo[0].iniziato_il !== null &&
      avvio.json.session.storicoNodo[0].concluso_il === null
  );

  const nodoSconosciuto = await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "non-esiste" });
  verifica("un nodo sconosciuto risponde 400", nodoSconosciuto.status === 400);

  const attiva = await chiamata(gs, "/richiesta-attiva");
  verifica(
    "GET /richiesta-attiva restituisce la stessa richiesta",
    attiva.json.richiestaAttiva.id === "decalogo-ginnastica"
  );
}

console.log("\n--- /scegli senza nodo avviato ---");
{
  const { gs } = nuovaSessione();
  const join = await chiamata(gs, "/join", "POST", { nome: "Prova", ruolo: "esploratore" });
  const giocatoreId = join.json.giocatori[0].id;
  const { status } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId });
  verifica("scegliere senza aver avviato un nodo risponde 400", status === 400);
}

console.log("\n--- Ramificazione: percorso aggressivo verso decalogo-vaira-severo ---");
{
  const { gs, storage } = nuovaSessione();
  const join = await chiamata(gs, "/join", "POST", { nome: "Prova", ruolo: "esploratore" });
  const giocatoreId = join.json.giocatori[0].id;
  // Dal Passo 9 questa risposta ha un tiro (competenzaRichiesta: "cadenza");
  // punteggio forzato molto alto per rendere il tier deterministico ("pieno").
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino" });

  // Risposta 0 su "decalogo-ginnastica": scelta aggressiva, con tiro.
  // Tier "pieno": cadenza +3, margine +1 (niente spiritoDiCorpo);
  // prossima: "decalogo-vaira-severo" a prescindere dal tier (dipende dalla
  // scelta fatta, non da come va il tiro).
  const primaScelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId });
  verifica("il tiro sul punteggio forzato è \"pieno\"", primaScelta.json.tiro && primaScelta.json.tiro.esito === "pieno");
  verifica("applica l'effetto su cadenza (tier pieno)", primaScelta.json.session.risorseDiSquadra.cadenza === 3);
  verifica("il tier pieno non tocca spiritoDiCorpo", primaScelta.json.session.risorseDiSquadra.spiritoDiCorpo === 0);
  verifica("applica l'effetto sul margine (tier pieno)", primaScelta.json.session.margine === 1);
  verifica("l'orologio avanza di 1", primaScelta.json.session.orologio === 1);
  verifica("margine 1 non raggiunge la soglia (5): nessuna complicazione", primaScelta.json.complicazione === null);
  verifica(
    "la ramificazione porta al ramo severo (dipende dalla scelta, non dal tiro)",
    primaScelta.json.prossimaRichiesta && primaScelta.json.prossimaRichiesta.id === "decalogo-vaira-severo"
  );
  verifica("il nodo non è ancora concluso (c'è una prossima richiesta)", primaScelta.json.esitoNodo === null);
  verifica("la scelta viene registrata nello storico", primaScelta.json.session.storicoScelte.length === 1);
  verifica(
    "lo storico registra la richiesta giusta",
    primaScelta.json.session.storicoScelte[0].richiestaId === "decalogo-ginnastica"
  );
  verifica(
    "lo storico registra chi ha scelto",
    primaScelta.json.session.storicoScelte[0].giocatoreId === giocatoreId
  );
  verifica(
    "lo storico registra anche il tiro",
    primaScelta.json.session.storicoScelte[0].tiro &&
      primaScelta.json.session.storicoScelte[0].tiro.esito === "pieno"
  );

  const attivaDopo = await chiamata(gs, "/richiesta-attiva");
  verifica(
    "la richiesta attiva è ora quella del ramo severo",
    attivaDopo.json.richiestaAttiva.id === "decalogo-vaira-severo"
  );

  // Risposta 0 su "decalogo-vaira-severo": ammette la paura (effetto fisso,
  // nessun tiro). effetti attesi: passoAvanti +1, margine -1; prossima: null (fine ramo)
  const secondaScelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId });
  verifica("nessun tiro su questa risposta (effetto fisso)", secondaScelta.json.tiro === null);
  verifica("applica l'effetto su passoAvanti", secondaScelta.json.session.risorseDiSquadra.passoAvanti === 1);
  verifica("il margine scende con l'effetto negativo (1 - 1 = 0)", secondaScelta.json.session.margine === 0);
  verifica("l'orologio avanza ancora (ora a 2)", secondaScelta.json.session.orologio === 2);
  verifica(
    "\"prossima\": null chiude il ramo anche se il nodo ha altre richieste altrove",
    secondaScelta.json.prossimaRichiesta === null
  );
  verifica("il nodo si conclude e restituisce un esito", secondaScelta.json.esitoNodo !== null);
  verifica(
    "nessuna condizione delle varianti è soddisfatta (spiritoDiCorpo 0, passoAvanti 1): vince il default",
    secondaScelta.json.esitoNodo === "L'addestramento è finito. Non tutti sono pronti allo stesso modo, ma si corre insieme."
  );
  verifica(
    "il diario del nodo viene chiuso con concluso_il ed esitoFinale coerenti",
    secondaScelta.json.session.storicoNodo[0].concluso_il !== null &&
      secondaScelta.json.session.storicoNodo[0].esitoFinale === secondaScelta.json.esitoNodo
  );
}

console.log("\n--- Soglia del margine: la complicazione scatta e il margine si dimezza ---");
{
  const { gs, storage } = nuovaSessione();
  const join = await chiamata(gs, "/join", "POST", { nome: "Prova", ruolo: "esploratore" });
  const giocatoreId = join.json.giocatori[0].id;
  // Punteggio forzato molto basso: tier deterministico "fallimento" (margine +3).
  await impostaCompetenza(storage, giocatoreId, "cadenza", -10);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino" });

  // Portiamo il margine a 3 a mano (simula l'accumulo di più nodi giocati
  // prima di questo, senza dover ripetere tutto il percorso): con la soglia
  // a 5 e il tier fallimento che aggiunge +3 di margine, il totale (6)
  // supera la soglia e deve far scattare la complicazione.
  const sessionePresente = await storage.get("session");
  sessionePresente.margine = 3;
  await storage.put("session", sessionePresente);

  const scelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId }); // tier fallimento: +3 margine → 6
  verifica("il tiro sul punteggio forzato è \"fallimento\"", scelta.json.tiro && scelta.json.tiro.esito === "fallimento");
  verifica("il margine supera la soglia (3 + 3 = 6 ≥ 5)", scelta.json.complicazione !== null);
  verifica(
    "il testo della complicazione è quello configurato in game-config.js",
    scelta.json.complicazione === "Il margine è esaurito: qualcosa si è rotto nel piano, e la squadra deve reagire."
  );
  verifica(
    "il margine si dimezza sulla soglia configurata (floor(5/2) = 2), non sul valore raggiunto",
    scelta.json.session.margine === 2
  );
}

console.log("\n--- Fallback in sequenza per nodi senza campo \"prossima\" (compatibilità) ---");
{
  const { gs } = nuovaSessione();
  const join = await chiamata(gs, "/join", "POST", { nome: "Prova", ruolo: "esploratore" });
  const giocatoreId = join.json.giocatori[0].id;
  const avvio = await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1848-milano" });
  verifica("avvia il nodo di Milano", avvio.json.richiestaAttiva.id === "milano-barricata");

  // "milano-barricata", risposta 2 ("parlare con chi presidia"): questa
  // risposta NON ha il campo "prossima" nel game-config.js -> deve
  // scattare il fallback in sequenza verso la richiesta successiva
  // dell'array, "milano-ferito".
  const scelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 2, giocatoreId });
  verifica(
    "senza \"prossima\", il fallback in sequenza porta alla richiesta successiva dell'array",
    scelta.json.prossimaRichiesta && scelta.json.prossimaRichiesta.id === "milano-ferito"
  );
}

console.log("\n--- /scegli con indice di risposta inesistente ---");
{
  const { gs } = nuovaSessione();
  const join = await chiamata(gs, "/join", "POST", { nome: "Prova", ruolo: "esploratore" });
  const giocatoreId = join.json.giocatori[0].id;
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino" });
  const { status } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 99, giocatoreId });
  verifica("un indice di risposta che non esiste risponde 400", status === 400);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
