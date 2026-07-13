// Test locale: node test-cronista-storico.mjs
//
// Anti-ripetizione del Cronista, i tre pezzi introdotti insieme:
//   1. MOTORE (scegliFrammento): rilascio progressivo dei frammenti recenti
//      -- con >=2 candidati, quello usato per ultimo non torna al tiro dopo.
//   2. STATO (GameSession): session.storicoFrammenti come finestra scorrevole
//      degli ultimi 12 id, alimentata a ogni tiro con pool disponibile.
//   3. AZZERAMENTO al cambio nodo (/avvia-nodo) + retrocompatibilita' con
//      sessioni salvate prima dell'introduzione del campo.
//
// Il pool vero (.md) non si carica sotto Node puro (import di un .md), quindi
// qui registriamo un pool FINTO deterministico con registraPool: due candidati
// per slot, con id prefissati dallo slot, cosi' l'alternanza e' osservabile.

import { GameSession } from "./src/durable-objects/GameSession.js";
import { GAME_CONFIG } from "./src/game-config.js";
import { scegliFrammento, componiNarrazione } from "./src/lib/narratore-simulato.js";
import { registraPool } from "./src/lib/narratore-registro-pool.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

// ---------- 1. MOTORE: scegliFrammento, rilascio progressivo ----------
console.log("--- scegliFrammento: rilascio progressivo ---");

const due = [
  { id: "X", testo: "X" },
  { id: "Y", testo: "Y" },
];

// Con 2 candidati e l'ultimo usato nello storico, esce SEMPRE l'altro
// (deterministico: l'unico non escluso). 50 giri per escludere il caso.
{
  let sempreY = true;
  for (let i = 0; i < 50; i++) if (scegliFrammento(due, ["X"]).id !== "Y") sempreY = false;
  verifica("2 candidati, ultimo usato X -> esce sempre Y", sempreY);
  let sempreX = true;
  for (let i = 0; i < 50; i++) if (scegliFrammento(due, ["Y"]).id !== "X") sempreX = false;
  verifica("2 candidati, ultimo usato Y -> esce sempre X", sempreX);
}

// storico [X, Y]: il piu' recente e' Y (in coda). Rilasciando il piu' VECCHIO
// (X) resta X disponibile e Y ancora escluso -> esce X.
{
  let sempreX = true;
  for (let i = 0; i < 50; i++) if (scegliFrammento(due, ["X", "Y"]).id !== "X") sempreX = false;
  verifica("storico [X,Y] (Y piu' recente): rilascia il vecchio X, esce X (Y escluso)", sempreX);
}

// Id ripetuto: storico [Y, X, Y]. Il piu' recente resta Y anche se Y compare
// pure come piu' vecchio: il rilascio a suffisso libera prima la coda vecchia
// (Y, poi X) ma tiene escluso il suffisso col Y recente finche' basta -> esce X.
{
  let sempreX = true;
  for (let i = 0; i < 50; i++) if (scegliFrammento(due, ["Y", "X", "Y"]).id !== "X") sempreX = false;
  verifica("storico [Y,X,Y] con id ripetuto: il piu' recente Y resta escluso, esce X", sempreX);
}

// Storico vuoto: nessuna esclusione, comportamento identico a prima (possono
// uscire entrambi). 200 giri: se il rilascio spegnesse un candidato per errore
// se ne vedrebbe uno solo.
{
  const visti = new Set();
  for (let i = 0; i < 200; i++) visti.add(scegliFrammento(due, []).id);
  verifica("storico vuoto: nessuna esclusione, escono entrambi (comportamento invariato)", visti.size === 2);
}

// Alternanza su tiri consecutivi simulando la finestra del chiamante (accoda
// l'usato, tronca a 12): la sequenza deve alternare a ogni passo.
{
  let storico = [];
  const seq = [];
  for (let i = 0; i < 8; i++) {
    const scelto = scegliFrammento(due, storico).id;
    seq.push(scelto);
    storico = [...storico, scelto].slice(-12);
  }
  let alterna = true;
  for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) alterna = false;
  verifica("8 tiri consecutivi con feedback dello storico: alternanza stretta, mai due uguali di fila", alterna);
}

// Un solo candidato: anche se e' nello storico, va scelto comunque (il
// rilascio arriva fino al suffisso vuoto). Nessun blocco, nessun errore.
{
  verifica(
    "1 solo candidato, anche se nello storico: scelto comunque (nessun blocco)",
    scegliFrammento([{ id: "solo", testo: "S" }], ["solo", "solo"]).id === "solo"
  );
}

// A livello di componiNarrazione: due composizioni di fila con un pool a 2
// candidati per slot devono cambiare frammento in ogni slot.
{
  const poolDue = {
    ottieniFrammenti(slot) {
      return [{ id: `${slot}-A`, testo: `[${slot}-A]` }, { id: `${slot}-B`, testo: `[${slot}-B]` }];
    },
  };
  const ctx = (storico) => ({
    esito: "pieno", competenzaId: null, ruoloId: null,
    margine: { valore: 0, soglia: 5, delta: 0 }, variabili: {}, storicoFrammenti: storico,
  });
  const primo = componiNarrazione(poolDue, ctx([]));
  const secondo = componiNarrazione(poolDue, ctx(primo.frammentiUsati));
  let tuttiDiversi = true;
  for (let s = 0; s < 3; s++) if (primo.frammentiUsati[s] === secondo.frammentiUsati[s]) tuttiDiversi = false;
  verifica(
    "componiNarrazione: passando i frammentiUsati come storico, la composizione dopo cambia frammento in ogni slot",
    tuttiDiversi
  );
}

// ---------- setup GameSession per i test di stato ----------
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
async function chiamata(gs, path, method = "GET", body = null) {
  const init = { method };
  if (body !== null) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const risposta = await gs.fetch(new Request(`https://fake.test/room/xyz${path}`, init));
  let json = null;
  try { json = await risposta.json(); } catch { json = null; }
  return { status: risposta.status, json };
}
async function joinComandante(gs, nome = "Prova", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori[0].id, token: join.json.token };
}
async function impostaCompetenza(storage, giocatoreId, competenzaId, valore) {
  const session = await storage.get("session");
  session.giocatori.find((g) => g.id === giocatoreId).competenze[competenzaId] = valore;
  await storage.put("session", session);
}

// Nodo di prova con una risposta a tiro ripetibile (prossima: null, cosi'
// possiamo riaprire la stessa richiesta e tirare piu' volte).
const NODO_CRONISTA = {
  id: "test-nodo-cronista",
  titolo: "Nodo di prova Cronista (solo test)",
  richieste: [
    {
      id: "test-richiesta-cronista",
      situazione: "n/d",
      prompt: "n/d",
      risposte: [
        {
          testo: "Risposta con tiro su Cadenza",
          competenzaRichiesta: "cadenza",
          effettiPerEsito: { pieno: {}, parziale: {}, fallimento: {} },
          esito: { pieno: "n/d", parziale: "n/d", fallimento: "n/d" },
          prossima: null,
        },
      ],
    },
  ],
  esitoFinale: { varianti: [], default: "n/d" },
};
GAME_CONFIG.nodiTemporali.push(NODO_CRONISTA);

// Pool finto deterministico: 2 candidati per slot, id prefissati dallo slot.
const poolFinto = {
  ottieniFrammenti(slot) {
    return [{ id: `${slot}-A`, testo: `[${slot}-A]` }, { id: `${slot}-B`, testo: `[${slot}-B]` }];
  },
};
registraPool("test-nodo-cronista", async () => poolFinto);

// Esegue un tiro (forza sempre "pieno" col punteggio alto) e restituisce la
// sessione aggiornata, riaprendo la richiesta per poterne fare un altro.
async function tira(gs, storage, giocatoreId, token) {
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  const session = await storage.get("session");
  session.richiestaAttivaId = "test-richiesta-cronista";
  session.richiestaIndice = 0;
  await storage.put("session", session);
  return session;
}

console.log("\n--- GameSession: storicoFrammenti alimentato e finestra a 12 ---");
{
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  const statoIniziale = await chiamata(gs, "/state");
  verifica("storicoFrammenti parte come array vuoto", Array.isArray(statoIniziale.json.storicoFrammenti) && statoIniziale.json.storicoFrammenti.length === 0);

  await impostaCompetenza(storage, giocatoreId, "cadenza", 20); // forza pieno
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-cronista", giocatoreId, token });

  const dopoUno = await tira(gs, storage, giocatoreId, token);
  verifica("un tiro con pool disponibile accoda 3 id (uno per slot)", dopoUno.storicoFrammenti.length === 3);
  const coda = dopoUno.storicoFrammenti;
  verifica(
    "i 3 id dell'ultimo tiro sono uno per slot (apertura, sviluppo, eco)",
    coda.some((x) => x.startsWith("apertura-")) && coda.some((x) => x.startsWith("sviluppo-")) && coda.some((x) => x.startsWith("eco-"))
  );

  // Continua a tirare e verifica che non superi mai 12 e si stabilizzi a 12.
  let superato12 = false;
  const aperture = [coda.find((x) => x.startsWith("apertura-"))];
  for (let i = 0; i < 6; i++) {
    const s = await tira(gs, storage, giocatoreId, token);
    if (s.storicoFrammenti.length > 12) superato12 = true;
    aperture.push(s.storicoFrammenti.slice(-3).find((x) => x.startsWith("apertura-")));
  }
  const finale = await storage.get("session");
  verifica("dopo molti tiri la finestra non supera mai 12 id", !superato12);
  verifica("dopo >=4 tiri la finestra e' troncata esattamente a 12", finale.storicoFrammenti.length === 12);
  verifica("gli id troncati sono gli ULTIMI (la coda contiene l'ultimo tiro)", finale.storicoFrammenti.slice(-3).some((x) => x.startsWith("eco-")));

  // Alternanza attraverso il DO: l'apertura scelta cambia a ogni tiro consecutivo.
  let alternaDO = true;
  for (let i = 1; i < aperture.length; i++) if (aperture[i] === aperture[i - 1]) alternaDO = false;
  verifica("attraverso GameSession, l'apertura alterna a ogni tiro consecutivo (mai due uguali di fila)", alternaDO);
}

console.log("\n--- GameSession: azzeramento al cambio nodo ---");
{
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-cronista", giocatoreId, token });
  await tira(gs, storage, giocatoreId, token);
  const prima = await storage.get("session");
  verifica("storicoFrammenti non vuoto dopo un tiro", prima.storicoFrammenti.length > 0);

  // Riavvia un nodo (anche lo stesso id va bene: e' un cambio nodo).
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-cronista", giocatoreId, token });
  const dopo = await storage.get("session");
  verifica("/avvia-nodo azzera storicoFrammenti (nuovo nodo riparte pulito)", Array.isArray(dopo.storicoFrammenti) && dopo.storicoFrammenti.length === 0);
}

console.log("\n--- GameSession: retrocompatibilita' con sessione senza il campo ---");
{
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-cronista", giocatoreId, token });

  // Simula una sessione salvata PRIMA dell'introduzione del campo: lo rimuovo.
  const vecchia = await storage.get("session");
  delete vecchia.storicoFrammenti;
  await storage.put("session", vecchia);

  const stato = await chiamata(gs, "/state");
  verifica("GET /state su sessione senza il campo lo ripristina a [] (migrateState)", Array.isArray(stato.json.storicoFrammenti) && stato.json.storicoFrammenti.length === 0);

  // E un tiro subito dopo non crasha (il call-site legge session.storicoFrammenti).
  const rimossoDiNuovo = await storage.get("session");
  delete rimossoDiNuovo.storicoFrammenti;
  await storage.put("session", rimossoDiNuovo);
  const { status } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  const dopoTiro = await storage.get("session");
  verifica("un tiro su sessione priva del campo non crasha (200) e popola lo storico", status === 200 && dopoTiro.storicoFrammenti.length === 3);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
