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

// Fa /crea + /join con un tokenCreazione valido: il giocatore risultante è
// DAVVERO comandante (non solo per nome, come bastava prima di questo
// passo) -- scorciatoia per i test che devono compiere azioni riservate
// (/avvia-nodo, /risorse, /risolvi-interpretazione) e non stanno testando
// l'assegnazione del comandante in sé.
async function joinComandante(gs, nome = "Prova", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori[0].id, token: join.json.token };
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

// Cerca ricorsivamente una CHIAVE "token" in un oggetto/array -- usata per
// verificare che GET /state non esponga mai il segreto, nemmeno annidato
// in un punto imprevisto.
function contieneChiaveToken(valore) {
  if (Array.isArray(valore)) return valore.some(contieneChiaveToken);
  if (valore && typeof valore === "object") {
    return (
      Object.keys(valore).some((chiave) => chiave === "token") ||
      Object.values(valore).some(contieneChiaveToken)
    );
  }
  return false;
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
  verifica(
    "senza tokenCreazione (nessun /crea chiamato prima), il giocatore NON diventa comandante",
    json.giocatori[0].comandante === false
  );
  verifica("/join restituisce un token per il nuovo giocatore", typeof json.token === "string" && json.token.length > 0);
  verifica("il token non compare nell'elenco giocatori della risposta di /join", json.giocatori[0].token === undefined);

  const secondo = await chiamata(gs, "/join", "POST", { nome: "Seconda", ruolo: "custode" });
  verifica(
    "il secondo giocatore NON è comandante",
    secondo.json.giocatori[1].comandante === false
  );

  const ruoloIgnoto = await chiamata(gs, "/join", "POST", { nome: "Altro", ruolo: "non-esiste" });
  verifica("un ruolo sconosciuto risponde 400", ruoloIgnoto.status === 400);
}

console.log("\n--- /crea + /join: assegnazione del comandante tramite tokenCreazione ---");
{
  const { gs } = nuovaSessione();
  const tokenCreazione = "token-creazione-prova";
  const crea = await chiamata(gs, "/crea", "POST", { tokenCreazione });
  verifica("POST /crea risponde 200", crea.status === 200);
  verifica("la stanza resta vuota dopo /crea (nessun giocatore aggiunto)", crea.json.giocatori.length === 0);
  verifica("la risposta di /crea non include mai tokenCreazione", crea.json.tokenCreazione === undefined);

  const creatore = await chiamata(gs, "/join", "POST", { nome: "Creatore", ruolo: "esploratore", tokenCreazione });
  verifica(
    "chi presenta il tokenCreazione corretto diventa comandante",
    creatore.json.giocatori[0].comandante === true
  );

  // Un secondo giocatore, anche con lo STESSO token (già consumato dal
  // primo), non ruba il ruolo: session.tokenCreazione è stato azzerato al
  // primo uso valido, e comunque un comandante è già assegnato.
  const secondoConStessoToken = await chiamata(gs, "/join", "POST", {
    nome: "Doppia tab",
    ruolo: "custode",
    tokenCreazione,
  });
  verifica(
    "un secondo /join con lo STESSO tokenCreazione valido non ruba il ruolo (già assegnato)",
    secondoConStessoToken.json.giocatori[1].comandante === false
  );
}

console.log("\n--- /join: tokenCreazione assente o sbagliato non assegna comandante ---");
{
  const { gs: gsSenzaToken } = nuovaSessione();
  await chiamata(gsSenzaToken, "/crea", "POST", { tokenCreazione: "token-vero" });
  const senzaToken = await chiamata(gsSenzaToken, "/join", "POST", { nome: "Prova", ruolo: "esploratore" });
  verifica(
    "/join senza tokenCreazione non assegna comandante, anche se la stanza ne ha uno valido in attesa",
    senzaToken.json.giocatori[0].comandante === false
  );

  const { gs: gsTokenSbagliato } = nuovaSessione();
  await chiamata(gsTokenSbagliato, "/crea", "POST", { tokenCreazione: "token-vero" });
  const tokenSbagliato = await chiamata(gsTokenSbagliato, "/join", "POST", {
    nome: "Prova",
    ruolo: "esploratore",
    tokenCreazione: "token-inventato",
  });
  verifica(
    "/join con tokenCreazione sbagliato non assegna comandante",
    tokenSbagliato.json.giocatori[0].comandante === false
  );
}

console.log("\n--- GET /state non deve mai esporre tokenCreazione ---");
{
  const { gs } = nuovaSessione();
  await chiamata(gs, "/crea", "POST", { tokenCreazione: "token-segreto-creazione" });
  const { json } = await chiamata(gs, "/state");
  verifica("GET /state non contiene mai la chiave \"tokenCreazione\"", !("tokenCreazione" in json));
}

console.log("\n--- GET /state non deve mai esporre il token ---");
{
  const { gs } = nuovaSessione();
  await chiamata(gs, "/join", "POST", { nome: "Prova", ruolo: "esploratore" });
  const { json } = await chiamata(gs, "/state");
  verifica("GET /state non contiene mai la chiave \"token\", nemmeno annidata", !contieneChiaveToken(json));
}

console.log("\n--- /join: limite di 8 posti ---");
{
  const { gs } = nuovaSessione();
  const ruoliCiclo = ["esploratore", "fanfara", "custode", "incursore"];
  let tuttiOk = true;
  for (let i = 0; i < 8; i++) {
    const r = await chiamata(gs, "/join", "POST", { nome: `Giocatore${i + 1}`, ruolo: ruoliCiclo[i % 4] });
    if (r.status !== 200) tuttiOk = false;
  }
  verifica("i primi 8 giocatori si uniscono con successo", tuttiOk);

  const statoAOtto = await chiamata(gs, "/state");
  verifica("la stanza ha esattamente 8 giocatori", statoAOtto.json.giocatori.length === 8);

  const nono = await chiamata(gs, "/join", "POST", { nome: "Nono", ruolo: "esploratore" });
  verifica("il nono giocatore riceve 409 (stanza piena)", nono.status === 409);
  verifica(
    "il corpo della risposta segnala l'errore",
    nono.json && nono.json.errore === "Stanza piena"
  );

  const statoFinale = await chiamata(gs, "/state");
  verifica(
    "il nono giocatore NON viene aggiunto: la stanza resta a 8",
    statoFinale.json.giocatori.length === 8
  );
  verifica(
    "nessun giocatore di nome \"Nono\" è presente",
    !statoFinale.json.giocatori.some((g) => g.nome === "Nono")
  );
}

console.log("\n--- /risorse ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs, "Comandante");

  const ok = await chiamata(gs, "/risorse", "POST", { risorsa: "cadenza", delta: 3, giocatoreId, token });
  verifica("modifica una risorsa nota", ok.json.risorseDiSquadra.cadenza === 3);
  const male = await chiamata(gs, "/risorse", "POST", { risorsa: "non-esiste", delta: 1, giocatoreId, token });
  verifica("una risorsa sconosciuta risponde 400", male.status === 400);

  // Il margine non è dentro risorseDiSquadra ma è accettato come chiave
  // speciale, con lo stesso pattern delta (per il pannello del comandante).
  const su = await chiamata(gs, "/risorse", "POST", { risorsa: "margine", delta: 2, giocatoreId, token });
  verifica("il margine sale con un delta positivo", su.json.margine === 2);
  const giu = await chiamata(gs, "/risorse", "POST", { risorsa: "margine", delta: -3, giocatoreId, token });
  verifica("il margine scende con un delta negativo, senza limiti imposti qui", giu.json.margine === -1);
}

console.log("\n--- Autenticazione: /risorse e /avvia-nodo riservati al comandante ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const gregario = await chiamata(gs, "/join", "POST", { nome: "Gregario", ruolo: "custode" });
  const idGregario = gregario.json.giocatori[1].id;
  const tokenGregario = gregario.json.token;

  const senzaToken = await chiamata(gs, "/risorse", "POST", { risorsa: "cadenza", delta: 1, giocatoreId: idComandante });
  verifica("/risorse senza token risponde 400", senzaToken.status === 400);

  const tokenSbagliato = await chiamata(gs, "/risorse", "POST", {
    risorsa: "cadenza",
    delta: 1,
    giocatoreId: idComandante,
    token: "token-inventato",
  });
  verifica("/risorse con token sbagliato risponde 401", tokenSbagliato.status === 401);

  const nonComandante = await chiamata(gs, "/risorse", "POST", {
    risorsa: "cadenza",
    delta: 1,
    giocatoreId: idGregario,
    token: tokenGregario,
  });
  verifica("/risorse chiamato da un giocatore non comandante risponde 403", nonComandante.status === 403);

  const senzaTokenNodo = await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId: idComandante });
  verifica("/avvia-nodo senza token risponde 400", senzaTokenNodo.status === 400);

  const tokenSbagliatoNodo = await chiamata(gs, "/avvia-nodo", "POST", {
    nodoId: "1836-torino",
    giocatoreId: idComandante,
    token: "token-inventato",
  });
  verifica("/avvia-nodo con token sbagliato risponde 401", tokenSbagliatoNodo.status === 401);

  const nonComandanteNodo = await chiamata(gs, "/avvia-nodo", "POST", {
    nodoId: "1836-torino",
    giocatoreId: idGregario,
    token: tokenGregario,
  });
  verifica("/avvia-nodo chiamato da un giocatore non comandante risponde 403", nonComandanteNodo.status === 403);

  // Verifica positiva: con identita' e ruolo corretti, l'azione riservata funziona.
  const ok = await chiamata(gs, "/avvia-nodo", "POST", {
    nodoId: "1836-torino",
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("/avvia-nodo con comandante autenticato funziona", ok.status === 200);
}

console.log("\n--- avvia-nodo + richiesta-attiva ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);

  const avvio = await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
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

  const nodoSconosciuto = await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "non-esiste", giocatoreId, token });
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
  const token = join.json.token;
  const { status } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("scegliere senza aver avviato un nodo risponde 400", status === 400);
}

console.log("\n--- Autenticazione: /scegli richiede identita' verificata ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });

  const senzaToken = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId });
  verifica("/scegli senza token risponde 400", senzaToken.status === 400);

  const tokenSbagliato = await chiamata(gs, "/scegli", "POST", {
    risposteIndice: 0,
    giocatoreId,
    token: "token-inventato",
  });
  verifica("/scegli con token sbagliato risponde 401", tokenSbagliato.status === 401);
}

console.log("\n--- Ramificazione: percorso aggressivo verso decalogo-vaira-severo ---");
{
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  // Dal Passo 9 questa risposta ha un tiro (competenzaRichiesta: "cadenza");
  // punteggio forzato molto alto per rendere il tier deterministico ("pieno").
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });

  // Risposta 0 su "decalogo-ginnastica": scelta aggressiva, con tiro.
  // Tier "pieno": cadenza +3, margine +1 (niente spiritoDiCorpo);
  // prossima: "decalogo-vaira-severo" a prescindere dal tier (dipende dalla
  // scelta fatta, non da come va il tiro).
  const primaScelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
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
  const secondaScelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
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
  const { giocatoreId, token } = await joinComandante(gs);
  // Punteggio forzato molto basso: tier deterministico "fallimento" (margine +3).
  await impostaCompetenza(storage, giocatoreId, "cadenza", -10);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });

  // Portiamo il margine a 3 a mano (simula l'accumulo di più nodi giocati
  // prima di questo, senza dover ripetere tutto il percorso): con la soglia
  // a 5 e il tier fallimento che aggiunge +3 di margine, il totale (6)
  // supera la soglia e deve far scattare la complicazione.
  const sessionePresente = await storage.get("session");
  sessionePresente.margine = 3;
  await storage.put("session", sessionePresente);

  const scelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token }); // tier fallimento: +3 margine → 6
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
  const { giocatoreId, token } = await joinComandante(gs);
  const avvio = await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1848-milano", giocatoreId, token });
  verifica("avvia il nodo di Milano", avvio.json.richiestaAttiva.id === "milano-barricata");

  // "milano-barricata", risposta 2 ("parlare con chi presidia"): questa
  // risposta NON ha il campo "prossima" nel game-config.js -> deve
  // scattare il fallback in sequenza verso la richiesta successiva
  // dell'array, "milano-ferito".
  const scelta = await chiamata(gs, "/scegli", "POST", { risposteIndice: 2, giocatoreId, token });
  verifica(
    "senza \"prossima\", il fallback in sequenza porta alla richiesta successiva dell'array",
    scelta.json.prossimaRichiesta && scelta.json.prossimaRichiesta.id === "milano-ferito"
  );
}

console.log("\n--- /scegli con indice di risposta inesistente ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  const { status } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 99, giocatoreId, token });
  verifica("un indice di risposta che non esiste risponde 400", status === 400);
}

console.log("\n--- /proponi-cessione: proposta valida ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;

  const { status, json } = await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idVice,
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("risponde 200", status === 200);
  verifica(
    "cessioneComandantePendente registra il destinatario",
    json.cessioneComandantePendente && json.cessioneComandantePendente.versoGiocatoreId === idVice
  );
  verifica(
    "il ruolo non cambia finche' la proposta non e' accettata",
    json.giocatori[0].comandante === true && json.giocatori[1].comandante === false
  );
}

console.log("\n--- /proponi-cessione: rifiutata da chi non e' comandante ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;
  const tokenVice = vice.json.token;

  const { status } = await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idComandante,
    giocatoreId: idVice,
    token: tokenVice,
  });
  verifica("risponde 403 (chi propone non e' comandante)", status === 403);
}

console.log("\n--- /proponi-cessione: a se stessi rifiutata ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");

  const { status } = await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idComandante,
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("risponde 400 (non ha senso cedere il ruolo a se stessi)", status === 400);
}

console.log("\n--- /proponi-cessione: doppia proposta rifiutata (gia' pendente) ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;
  const terzo = await chiamata(gs, "/join", "POST", { nome: "Terzo", ruolo: "fanfara" });
  const idTerzo = terzo.json.giocatori[2].id;

  const prima = await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idVice,
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("la prima proposta riesce", prima.status === 200);

  const seconda = await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idTerzo,
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("una seconda proposta mentre una e' gia' pendente risponde 409", seconda.status === 409);

  const stato = await chiamata(gs, "/state");
  verifica(
    "la cessione pendente resta quella originale (non sovrascritta silenziosamente)",
    stato.json.cessioneComandantePendente.versoGiocatoreId === idVice
  );
}

console.log("\n--- /accetta-cessione: il destinatario corretto accetta, il ruolo passa ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;
  const tokenVice = vice.json.token;

  await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idVice,
    giocatoreId: idComandante,
    token: tokenComandante,
  });

  const { status, json } = await chiamata(gs, "/accetta-cessione", "POST", { giocatoreId: idVice, token: tokenVice });
  verifica("risponde 200", status === 200);
  verifica(
    "il nuovo comandante e' il destinatario",
    json.giocatori.find((g) => g.id === idVice).comandante === true
  );
  verifica(
    "il vecchio comandante torna un giocatore normale",
    json.giocatori.find((g) => g.id === idComandante).comandante === false
  );
  verifica("cessioneComandantePendente e' stata svuotata", json.cessioneComandantePendente === null);
}

console.log("\n--- /accetta-cessione: tentata da chi non e' il destinatario, rifiutata ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;
  const terzo = await chiamata(gs, "/join", "POST", { nome: "Terzo", ruolo: "fanfara" });
  const idTerzo = terzo.json.giocatori[2].id;
  const tokenTerzo = terzo.json.token;

  await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idVice,
    giocatoreId: idComandante,
    token: tokenComandante,
  });

  const { status } = await chiamata(gs, "/accetta-cessione", "POST", { giocatoreId: idTerzo, token: tokenTerzo });
  verifica("risponde 403 (non e' il destinatario della proposta)", status === 403);

  const stato = await chiamata(gs, "/state");
  verifica(
    "il ruolo non e' cambiato",
    stato.json.giocatori.find((g) => g.id === idComandante).comandante === true
  );
  verifica("la cessione resta ancora pendente", stato.json.cessioneComandantePendente !== null);
}

console.log("\n--- /rifiuta-cessione: rifiutata dal destinatario ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;
  const tokenVice = vice.json.token;

  await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idVice,
    giocatoreId: idComandante,
    token: tokenComandante,
  });

  const { status, json } = await chiamata(gs, "/rifiuta-cessione", "POST", { giocatoreId: idVice, token: tokenVice });
  verifica("risponde 200", status === 200);
  verifica("cessioneComandantePendente e' stata svuotata", json.cessioneComandantePendente === null);
  verifica(
    "il ruolo non e' cambiato",
    json.giocatori.find((g) => g.id === idComandante).comandante === true
  );
}

console.log("\n--- /rifiuta-cessione: annullata dal proponente ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;

  await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idVice,
    giocatoreId: idComandante,
    token: tokenComandante,
  });

  const { status, json } = await chiamata(gs, "/rifiuta-cessione", "POST", {
    giocatoreId: idComandante,
    token: tokenComandante,
  });
  verifica("risponde 200 (il proponente puo' annullare la propria proposta)", status === 200);
  verifica("cessioneComandantePendente e' stata svuotata", json.cessioneComandantePendente === null);
}

console.log("\n--- /rifiuta-cessione: tentata da un terzo giocatore, rifiutata ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;
  const terzo = await chiamata(gs, "/join", "POST", { nome: "Terzo", ruolo: "fanfara" });
  const idTerzo = terzo.json.giocatori[2].id;
  const tokenTerzo = terzo.json.token;

  await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idVice,
    giocatoreId: idComandante,
    token: tokenComandante,
  });

  const { status } = await chiamata(gs, "/rifiuta-cessione", "POST", { giocatoreId: idTerzo, token: tokenTerzo });
  verifica("risponde 403 (un terzo giocatore, ne' proponente ne' destinatario, non puo' rifiutare)", status === 403);

  const stato = await chiamata(gs, "/state");
  verifica("la cessione resta ancora pendente", stato.json.cessioneComandantePendente !== null);
}

console.log("\n--- GET /state mostra cessioneComandantePendente quando presente ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: idComandante, token: tokenComandante } = await joinComandante(gs, "Comandante");
  const vice = await chiamata(gs, "/join", "POST", { nome: "Vice", ruolo: "custode" });
  const idVice = vice.json.giocatori[1].id;

  const senzaCessione = await chiamata(gs, "/state");
  verifica(
    "cessioneComandantePendente e' null quando non c'e' nulla in corso",
    senzaCessione.json.cessioneComandantePendente === null
  );

  await chiamata(gs, "/proponi-cessione", "POST", {
    versoGiocatoreId: idVice,
    giocatoreId: idComandante,
    token: tokenComandante,
  });

  const conCessione = await chiamata(gs, "/state");
  verifica(
    "GET /state mostra cessioneComandantePendente quando c'e' una proposta in corso",
    conCessione.json.cessioneComandantePendente &&
      conCessione.json.cessioneComandantePendente.versoGiocatoreId === idVice
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
