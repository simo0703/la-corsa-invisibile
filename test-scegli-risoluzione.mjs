// Test locale: node test-scegli-risoluzione.mjs
//
// Verifica isolata di un singolo pezzo: risoluzione.js collegato al flusso
// di /scegli. Una risposta con `competenzaRichiesta` fa un tiro (punteggio
// del giocatore + dado, vedi src/lib/risoluzione.js) invece di applicare un
// effetto fisso; l'esito del tiro (pieno/parziale/fallimento) seleziona
// quali `effettiPerEsito` applicare e quale `esito` testuale mostrare. Le
// risposte SENZA `competenzaRichiesta` restano a effetto fisso, esattamente
// come prima — le due forme convivono nello stesso nodo (decisione presa).
//
// Non tocca il Cronista: qui verifichiamo solo i numeri e gli effetti, non
// la narrazione a frammenti.
//
// Nessuna modifica a game-config.js: il nodo di prova usato qui viene
// aggiunto a runtime a GAME_CONFIG.nodiTemporali (stesso oggetto importato
// da GameSession.js, essendo lo stesso modulo Node), senza toccare il
// contenuto narrativo reale dei 5 nodi già scritti.

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

// Forza il punteggio di una competenza direttamente nello storage (bypassa
// creaCompetenzeIniziali, che tiene i valori tra 1 e 5): serve per rendere
// deterministico l'esito di un tiro nei test, senza dover forzare il dado
// nell'API pubblica di GameSession (che non lo espone, giustamente).
async function impostaCompetenza(storage, giocatoreId, competenzaId, valore) {
  const session = await storage.get("session");
  const giocatore = session.giocatori.find((g) => g.id === giocatoreId);
  giocatore.competenze[competenzaId] = valore;
  await storage.put("session", session);
}

// Nodo di prova: una risposta con tiro (indice 0) e una a effetto fisso
// (indice 1), per verificare che le due forme convivano nello stesso nodo.
const NODO_DI_PROVA = {
  id: "test-nodo-tiro",
  titolo: "Nodo di prova (solo test)",
  luogo: "n/d",
  tono: "n/d",
  richieste: [
    {
      id: "test-richiesta-tiro",
      situazione: "Situazione di prova.",
      prompt: "Prompt di prova.",
      risposte: [
        {
          testo: "Risposta con tiro su Cadenza",
          competenzaRichiesta: "cadenza",
          effettiPerEsito: {
            pieno: { cadenza: 3 },
            parziale: { cadenza: 1 },
            fallimento: { cadenza: -1, margine: 1 },
          },
          esito: {
            pieno: "Esito pieno di prova",
            parziale: "Esito parziale di prova",
            fallimento: "Esito fallimento di prova",
          },
          prossima: null,
        },
        {
          testo: "Risposta a effetto fisso, nessun tiro",
          effetti: { spiritoDiCorpo: 2 },
          esito: "Esito fisso di prova",
          prossima: null,
        },
      ],
    },
  ],
  esitoFinale: { varianti: [], default: "Esito finale di prova" },
};
GAME_CONFIG.nodiTemporali.push(NODO_DI_PROVA);

// Fa /crea + /join con un tokenCreazione valido, cosi' il giocatore
// risultante e' davvero comandante (serve per compiere /avvia-nodo, azione
// riservata -- vedi autenticaComandante() in GameSession.js).
async function joinComandante(gs, nome = "Prova", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori[0].id, token: join.json.token };
}

// Scorciatoia: sessione con un giocatore unito e il nodo di prova avviato.
async function sessionePronta() {
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-tiro", giocatoreId, token });
  return { gs, storage, giocatoreId, token };
}

console.log("--- risposta senza competenzaRichiesta: nessun tiro, effetto fisso come sempre ---");
{
  const { gs, giocatoreId, token } = await sessionePronta();
  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 1, giocatoreId, token });
  verifica("tiro è null quando la risposta non lo richiede", json.tiro === null);
  verifica("l'effetto fisso viene applicato", json.session.risorseDiSquadra.spiritoDiCorpo === 2);
  verifica("l'esito è il testo fisso, non un oggetto per tier", json.esito === "Esito fisso di prova");
  verifica("storicoScelte registra tiro: null per questa voce", json.session.storicoScelte[0].tiro === null);
}

console.log("\n--- punteggio molto basso: il tiro è sempre fallimento ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", -10); // totale sempre <5
  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro registra esito fallimento", json.tiro !== null && json.tiro.esito === "fallimento");
  verifica(
    "vengono applicati gli effettiPerEsito.fallimento (cadenza -1, margine +1)",
    json.session.risorseDiSquadra.cadenza === -1 && json.session.margine === 1
  );
  verifica("il testo mostrato è quello del tier fallimento", json.esito === "Esito fallimento di prova");
}

console.log("\n--- punteggio molto alto: il tiro è sempre pieno ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20); // totale sempre >=8
  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("il tiro registra esito pieno", json.tiro !== null && json.tiro.esito === "pieno");
  verifica("vengono applicati gli effettiPerEsito.pieno (cadenza +3)", json.session.risorseDiSquadra.cadenza === 3);
  verifica("il testo mostrato è quello del tier pieno", json.esito === "Esito pieno di prova");
}

console.log("\n--- coerenza interna su molti tentativi (punteggio a cavallo tra parziale e pieno) ---");
{
  // Con punteggio 4 e dado 1d4: totale in [5,8] -> sempre parziale o pieno,
  // mai fallimento. In 40 tentativi la probabilità di non vedere MAI un
  // parziale è (1/4)^40, trascurabile: se il codice è corretto, entrambi i
  // tier compaiono.
  const esitiVisti = new Set();
  let coerenteSempre = true;
  for (let i = 0; i < 40; i++) {
    const { gs, storage, giocatoreId, token } = await sessionePronta();
    await impostaCompetenza(storage, giocatoreId, "cadenza", 4);
    const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
    if (!json.tiro || (json.tiro.esito !== "parziale" && json.tiro.esito !== "pieno")) {
      coerenteSempre = false;
    }
    esitiVisti.add(json.tiro?.esito);

    const cadenzaAttesa = json.tiro.esito === "pieno" ? 3 : 1;
    if (json.session.risorseDiSquadra.cadenza !== cadenzaAttesa) coerenteSempre = false;
    const esitoAtteso = json.tiro.esito === "pieno" ? "Esito pieno di prova" : "Esito parziale di prova";
    if (json.esito !== esitoAtteso) coerenteSempre = false;
  }
  verifica("con punteggio 4, il tiro produce sempre parziale o pieno, mai fallimento", coerenteSempre);
  verifica("su 40 tentativi, si vedono entrambi i tier (parziale e pieno)", esitiVisti.has("parziale") && esitiVisti.has("pieno"));
}

console.log("\n--- robustezza: contenuto malformato non manda in crash il motore ---");
{
  // effettiPerEsito assente per il tier estratto: deve applicare "nessun
  // effetto" (fallback a {}), non lanciare un'eccezione.
  const nodoSenzaEffetti = {
    id: "test-nodo-tiro-senza-effetti",
    titolo: "Nodo di prova senza effettiPerEsito",
    richieste: [
      {
        id: "test-richiesta-senza-effetti",
        situazione: "n/d",
        prompt: "n/d",
        risposte: [{ testo: "Risposta con tiro ma senza effettiPerEsito", competenzaRichiesta: "cadenza", prossima: null }],
      },
    ],
    esitoFinale: { varianti: [], default: "n/d" },
  };
  GAME_CONFIG.nodiTemporali.push(nodoSenzaEffetti);

  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20); // forza "pieno"
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-tiro-senza-effetti", giocatoreId, token });
  const { status, json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica("nessun crash: la richiesta risponde comunque 200", status === 200);
  verifica("nessun effetto applicato quando effettiPerEsito manca (fallback a {})", json.session.risorseDiSquadra.cadenza === 0);
  verifica("esito testuale è null quando anche il campo esito manca per il tier", json.esito === null);
}

console.log("\n--- robustezza: competenza mancante nel record del giocatore (vecchie sessioni) trattata come 0 ---");
{
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  const session = await storage.get("session");
  delete session.giocatori.find((g) => g.id === giocatoreId).competenze.cadenza;
  await storage.put("session", session);

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica(
    "punteggio mancante trattato come 0 (totale = dado, sempre <5 -> fallimento)",
    json.tiro !== null && json.tiro.esito === "fallimento" && json.tiro.competenza === 0
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
