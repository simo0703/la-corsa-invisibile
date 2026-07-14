// Test locale: node test-scegli-cronista.mjs
//
// Verifica isolata del collegamento del Cronista al flusso di /scegli
// (narratore-registro-pool.js + narratore-simulato.js dentro GameSession.js).
//
// Due scenari, entrambi importanti:
// 1. SENZA un pool caricabile (il caso normale sotto Node puro, dove il
//    .md di narratore-corsa-invisibile.js non è risolvibile): /scegli deve
//    ricadere sul testo statico per tier, esattamente come prima di questo
//    passaggio. Nessun errore.
// 2. CON un pool iniettato via registraPool() (costruito in modo portabile:
//    testo del .md letto da fs, come fa test-narratore-corsa-invisibile.mjs,
//    NON tramite l'import Wrangler-only): /scegli deve usare il testo
//    composto dal Cronista al posto di quello statico, senza toccare gli
//    effetti meccanici né la ramificazione.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { GameSession } from "./src/durable-objects/GameSession.js";
import { trovaPoolPerNodo, registraPool } from "./src/lib/narratore-registro-pool.js";
import { creaPool } from "./src/lib/narratore-corsa-invisibile-loader.js";

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
// della singola chiamata, poi ripristina il caso. Dentro la finestra anche
// la selezione pesata del Cronista diventa deterministica: innocuo, sceglie
// comunque un candidato valido.
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

async function sessionePronta(ruolo = "esploratore") {
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs, "Prova", ruolo);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  return { gs, storage, giocatoreId, token };
}

const TESTO_PIENO_STATICO =
  "Il ritmo è perfetto, il corpo risponde a ogni comando: arrivate per primi senza sprecare un solo passo.";
const TESTO_FALLIMENTO_STATICO =
  "La fretta vi tradisce: un piede sbaglia l'appoggio, il corpo si spezza per un istante prima di ritrovare l'equilibrio. Arrivate comunque per primi, ma il prezzo pagato si vede.";

console.log("--- registro: nodo senza pool registrato ---");
{
  const pool = await trovaPoolPerNodo("nodo-che-non-esiste");
  verifica("trovaPoolPerNodo restituisce null per un nodo sconosciuto al registro", pool === null);
}

console.log("\n--- registro: il caricatore reale di 1836-torino fallisce sotto Node puro (atteso) ---");
{
  // Prima di registrare qualunque override: il caricatore di default per
  // "1836-torino" importa narratore-corsa-invisibile.js, che importa un
  // .md — non risolvibile da Node senza Wrangler. trovaPoolPerNodo deve
  // restituire null, non lanciare un'eccezione.
  const pool = await trovaPoolPerNodo("1836-torino");
  verifica(
    "sotto Node puro, senza override, il pool di 1836-torino non è caricabile (null, non un errore)",
    pool === null
  );
}

console.log("\n--- GameSession: senza pool disponibile, /scegli usa il testo statico (fallback) ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20); // punteggio alto
  const { json } = await conDadoMassimo(() =>
    chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token })
  ); // dado bloccato: "pieno" deterministico anche col colpo secco
  verifica("il tiro è \"pieno\"", json.tiro.esito === "pieno");
  verifica("senza pool, l'esito resta il testo statico per tier", json.esito === TESTO_PIENO_STATICO);
}

// Da qui in poi: iniettiamo il pool reale (contenuto vero di
// narratore-corsa-invisibile.md), costruito in modo portabile — stesso
// meccanismo di test-narratore-corsa-invisibile.mjs — al posto del
// caricatore di default (che sotto Node non si risolve).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testoMarkdown = readFileSync(path.join(__dirname, "src", "lib", "narratore-corsa-invisibile.md"), "utf8");
const poolReale = creaPool(testoMarkdown);
registraPool("1836-torino", () => Promise.resolve({ ottieniFrammenti: poolReale.ottieniFrammenti }));

console.log("\n--- GameSession: con il pool reale iniettato, /scegli usa il testo del Cronista ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20); // punteggio alto
  const { json } = await conDadoMassimo(() =>
    chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token })
  ); // dado bloccato: "pieno" deterministico anche col colpo secco
  verifica("il tiro è ancora \"pieno\" (il pool non cambia il tiro)", json.tiro.esito === "pieno");
  verifica("l'esito NON è più il testo statico: è stato sostituito", json.esito !== TESTO_PIENO_STATICO);
  verifica("l'esito composto è una stringa non vuota", typeof json.esito === "string" && json.esito.length > 0);
  verifica("nessun placeholder rimasto irrisolto (es. {ruolo})", !json.esito.includes("{"));
  verifica(
    "storicoScelte registra lo stesso testo composto restituito al client",
    json.session.storicoScelte[0].esito === json.esito
  );
  verifica(
    "gli effetti meccanici restano quelli del tier pieno, invariati dal Cronista",
    json.session.risorseDiSquadra.cadenza === 3 && json.session.margine === 1
  );
  verifica(
    "la ramificazione resta quella prevista, invariata dal Cronista (ora corri-prima)",
    json.prossimaRichiesta && json.prossimaRichiesta.id === "corri-prima"
  );
}

console.log("\n--- GameSession: tier e ruolo diversi producono comunque un testo coerente ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta("fanfara");
  await impostaCompetenza(storage, giocatoreId, "cadenza", -10); // forza "fallimento"
  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro è \"fallimento\"", json.tiro.esito === "fallimento");
  verifica("l'esito NON è il testo statico del tier fallimento", json.esito !== TESTO_FALLIMENTO_STATICO);
  verifica("l'esito composto è una stringa non vuota", typeof json.esito === "string" && json.esito.length > 0);
  verifica("nessun placeholder rimasto irrisolto", !json.esito.includes("{"));
}

console.log("\n--- risposte SENZA tiro: il Cronista non le tocca mai, anche col pool registrato ---");
{
  const { gs, giocatoreId, token } = await sessionePronta();
  // "con metodo" (indice 1): nessuna competenzaRichiesta, nessun tiro.
  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 1, giocatoreId, token });
  verifica("nessun tiro su questa risposta", json.tiro === null);
  verifica(
    "l'esito resta il testo fisso scritto in game-config.js, non toccato dal Cronista",
    json.esito === "Meno brillanti, ma nessuno resta indietro."
  );
}

console.log("\n--- GameSession: il contesto passato al Cronista include richiestaId ---");
{
  // Pool-spia: non compone davvero, cattura il contesto che GameSession
  // costruisce e restituisce un frammento minimo valido per slot (il motore
  // esige almeno un candidato per slot, altrimenti lancia). Serve solo per
  // ispezionare cosa finisce nel contesto. `contesto` è lo stesso oggetto
  // per tutti e tre gli slot (vedi componiNarrazione), quindi l'ultima
  // cattura basta.
  let contestoCatturato = null;
  const poolSpia = {
    ottieniFrammenti(slot, contesto) {
      contestoCatturato = contesto;
      return [{ id: `spia-${slot}`, testo: "x" }];
    },
  };
  registraPool("1836-torino", () => Promise.resolve({ ottieniFrammenti: poolSpia.ottieniFrammenti }));

  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20); // forza un tiro
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });

  verifica(
    "il contesto del Cronista contiene richiestaId",
    contestoCatturato !== null && "richiestaId" in contestoCatturato
  );
  verifica(
    "richiestaId vale l'id della richiesta attiva che ha generato il tiro (decalogo-ginnastica)",
    contestoCatturato && contestoCatturato.richiestaId === "decalogo-ginnastica"
  );

  // Ripristina il pool reale per non lasciare lo spia registrato.
  registraPool("1836-torino", () => Promise.resolve({ ottieniFrammenti: poolReale.ottieniFrammenti }));
}

console.log("\n--- scoppio del Margine: il Cronista vede il valore PIENO, poi si azzera (Decisione #23) ---");
{
  // Ordine delle operazioni in applicaRisposta: incremento del margine ->
  // chiamata al Cronista -> controllo soglia -> azzeramento. Il contesto
  // passato al Cronista nel turno dello scoppio deve quindi contenere ancora
  // il valore pieno (qui 4 + 3 = 7, fascia "critico"), mentre la sessione
  // restituita al client ha gia' il margine azzerato.
  let contestoCatturato = null;
  const poolSpia = {
    ottieniFrammenti(slot, contesto) {
      contestoCatturato = contesto;
      return [{ id: `spia-scoppio-${slot}`, testo: "x" }];
    },
  };
  registraPool("1836-torino", () => Promise.resolve({ ottieniFrammenti: poolSpia.ottieniFrammenti }));

  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", -10); // forza "fallimento" (margine +3)
  // Porta il margine a 4 a mano: col +3 del fallimento arriva a 7 >= soglia 5.
  const sessionePresente = await storage.get("session");
  sessionePresente.margine = 4;
  await storage.put("session", sessionePresente);

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro è \"fallimento\" (punteggio forzato)", json.tiro && json.tiro.esito === "fallimento");
  verifica(
    "il contesto del Cronista contiene il valore PIENO del margine (7), prima dell'azzeramento",
    contestoCatturato && contestoCatturato.margine && contestoCatturato.margine.valore === 7
  );
  verifica("la complicazione scatta (7 >= soglia 5)", json.complicazione !== null);
  verifica("dopo lo scoppio il margine è azzerato (0, non piu' dimezzato a 2)", json.session.margine === 0);

  // Ripristina il pool reale per non lasciare lo spia registrato.
  registraPool("1836-torino", () => Promise.resolve({ ottieniFrammenti: poolReale.ottieniFrammenti }));
}

console.log("\n--- loader: la colonna richiestaId funziona da condizione, senza modifiche al loader ---");
{
  // Markdown minimale con DUE frammenti nello stesso slot: uno baseline
  // (condizionato solo su esito, come le tabelle "Baseline per esito" vere)
  // e uno dedicato a una singola richiesta (colonna richiestaId). Dimostra
  // che l'asse è già operativo per il solo fatto che il loader tratta ogni
  // colonna sconosciuta come condizione — nessun frammento .md reale lo usa.
  const md = [
    "## Slot: apertura",
    "",
    "| id | esito | testo |",
    "|---|---|---|",
    "| base | pieno | Testo baseline, nessun vincolo di richiesta. |",
    "",
    "| id | richiestaId | testo |",
    "|---|---|---|",
    "| dedicato | decalogo-ginnastica | Testo dedicato a questa richiesta. |",
  ].join("\n");
  const pool = creaPool(md);

  const conMatch = pool
    .ottieniFrammenti("apertura", { esito: "pieno", richiestaId: "decalogo-ginnastica" })
    .map((f) => f.id);
  const altraRichiesta = pool
    .ottieniFrammenti("apertura", { esito: "pieno", richiestaId: "milano-barricata" })
    .map((f) => f.id);

  verifica(
    "il frammento condizionato su richiestaId è candidato per la richiesta giusta",
    conMatch.includes("dedicato")
  );
  verifica(
    "lo stesso frammento NON è candidato per un'altra richiesta",
    !altraRichiesta.includes("dedicato")
  );
  verifica(
    "il frammento baseline (senza colonna richiestaId) resta candidato per entrambe le richieste",
    conMatch.includes("base") && altraRichiesta.includes("base")
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
