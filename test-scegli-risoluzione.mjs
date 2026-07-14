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

console.log("\n--- punteggio molto alto + dado bloccato al massimo: il tiro è pieno ---");
{
  // Col colpo secco un punteggio alto da solo non basta più (il dado 1
  // resterebbe fallimento): blocchiamo anche il dado per il tier "pieno".
  const { gs, storage, giocatoreId, token } = await sessionePronta();
  await impostaCompetenza(storage, giocatoreId, "cadenza", 20);
  const { json } = await conDadoMassimo(() =>
    chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token })
  );
  verifica("il tiro registra esito pieno", json.tiro !== null && json.tiro.esito === "pieno");
  verifica("vengono applicati gli effettiPerEsito.pieno (cadenza +3)", json.session.risorseDiSquadra.cadenza === 3);
  verifica("il testo mostrato è quello del tier pieno", json.esito === "Esito pieno di prova");
}

console.log("\n--- coerenza interna su molti tentativi (punteggio 4: tutti e tre i tier possibili) ---");
{
  // Con punteggio 4 e 1d6: dado 1 -> fallimento (colpo secco, anche se il
  // totale 5 supererebbe la soglia); dado 2-3 -> totale 6-7, parziale;
  // dado 4-6 -> totale 8-10, pieno. Il fallimento deve comparire SOLO con
  // il dado a 1, e gli effetti/testo devono seguire il tier estratto.
  const esitiVisti = new Set();
  let coerenteSempre = true;
  for (let i = 0; i < 40; i++) {
    const { gs, storage, giocatoreId, token } = await sessionePronta();
    await impostaCompetenza(storage, giocatoreId, "cadenza", 4);
    const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
    if (!json.tiro) coerenteSempre = false;
    esitiVisti.add(json.tiro?.esito);

    // colpo secco: fallimento se e solo se il dado mostra 1
    if ((json.tiro.esito === "fallimento") !== (json.tiro.dado === 1)) coerenteSempre = false;

    const cadenzaAttesa = { pieno: 3, parziale: 1, fallimento: -1 }[json.tiro.esito];
    if (json.session.risorseDiSquadra.cadenza !== cadenzaAttesa) coerenteSempre = false;
    const esitoAtteso = {
      pieno: "Esito pieno di prova",
      parziale: "Esito parziale di prova",
      fallimento: "Esito fallimento di prova",
    }[json.tiro.esito];
    if (json.esito !== esitoAtteso) coerenteSempre = false;
  }
  verifica("con punteggio 4, il fallimento compare solo col dado a 1 (colpo secco) e ogni tier applica i suoi effetti", coerenteSempre);
  verifica("su 40 tentativi, si vedono i tier parziale e pieno", esitiVisti.has("parziale") && esitiVisti.has("pieno"));
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
  // Il punto di questo test è la robustezza: una competenza mancante nel
  // record del giocatore viene trattata come 0. Con il dado 1d6 (uguale per
  // tutti) 0 + 1d6 = 1-6, quindi l'esito è fallimento (1-4) o parziale (5-6),
  // MAI pieno: verifichiamo competenza === 0 (il vero punto) e che l'esito
  // non sia "pieno", senza pinnare un tier esatto che dipenderebbe dal dado.
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs, "Prova", "custode");
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-tiro", giocatoreId, token });
  const session = await storage.get("session");
  delete session.giocatori.find((g) => g.id === giocatoreId).competenze.cadenza;
  await storage.put("session", session);

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica(
    "punteggio mancante trattato come 0 (competenza === 0; con 0 + 1d6 l'esito non è mai pieno)",
    json.tiro !== null && json.tiro.esito !== "pieno" && json.tiro.competenza === 0
  );
}

console.log("\n--- Dado 1d6 per tutti: sia sulla principale sia su una competenza non propria sono vive tutte e tre le fasce ---");
{
  // Dopo il ribilanciamento il dado è 1d6 per QUALUNQUE ruolo e QUALUNQUE
  // competenza (nessun override di ruolo). Verifichiamo, coi punteggi REALI
  // assegnati a /join (principale 3, altre 2) e senza forzare nulla, che
  // entrambi i profili di tiro aprano tutte e tre le fasce:
  //   - principale  3 + 1d6 = 4-9  -> fallimento (d6=1), parziale, pieno (d6=5,6)
  //   - non-propria 2 + 1d6 = 3-8  -> fallimento (d6=1,2), parziale, pieno (d6=6)
  // La fascia più rara in entrambi i casi ha probabilità 1/6; su 120
  // tentativi la probabilità di non vederla mai è (5/6)^120 ≈ 2e-10:
  // stabile, non fragile. Il pieno (totale 8-9) è irraggiungibile col
  // vecchio 1d4: la sua sola comparsa dimostra che il dado è davvero 1d6.

  // Esegue `tentativi` tiri della risposta 0 di test-nodo-tiro (richiede
  // "cadenza") con un giocatore del ruolo dato, punteggi reali di /join,
  // e restituisce l'insieme dei tier osservati. Riusa una sola sessione,
  // riaprendo la richiesta dopo ogni scelta (la risposta ha prossima: null).
  async function tierOsservati(ruolo, tentativi) {
    const { gs, storage } = nuovaSessione();
    const { giocatoreId, token } = await joinComandante(gs, "Prova", ruolo);
    await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-tiro", giocatoreId, token });
    const tier = new Set();
    for (let i = 0; i < tentativi; i++) {
      const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
      tier.add(json.tiro?.esito);
      const session = await storage.get("session");
      session.richiestaAttivaId = "test-richiesta-tiro";
      session.richiestaIndice = 0;
      await storage.put("session", session);
    }
    return tier;
  }

  // Esploratore tira Cadenza = la SUA principale (punteggio reale 3): 3+1d6.
  const principale = await tierOsservati("esploratore", 120);
  verifica(
    "principale (Esploratore, Cadenza 3 reale + 1d6): compaiono tutte e tre le fasce (fallimento, parziale, pieno)",
    principale.has("fallimento") && principale.has("parziale") && principale.has("pieno")
  );

  // Custode tira Cadenza = competenza NON propria (punteggio reale 2, la
  // nuova secondaria): 2+1d6. Stesso dado d6, nessun override di ruolo.
  const nonPropria = await tierOsservati("custode", 120);
  verifica(
    "non-propria (Custode, Cadenza 2 reale + 1d6): compaiono tutte e tre le fasce (fallimento, parziale, pieno)",
    nonPropria.has("fallimento") && nonPropria.has("parziale") && nonPropria.has("pieno")
  );
}

console.log("\n--- bonusContesto: dichiarato su una risposta, aggiunge il valore alla competenza prima del tiro ---");
{
  const nodoBonus = {
    id: "test-nodo-bonus-contesto",
    titolo: "Nodo di prova bonus contesto (solo test)",
    richieste: [
      {
        id: "test-richiesta-bonus-contesto",
        situazione: "Situazione di prova: inseguimento.",
        prompt: "Prompt di prova.",
        risposte: [
          {
            testo: "Risposta con bonus di contesto su Cadenza",
            competenzaRichiesta: "cadenza",
            bonusContesto: { competenza: "cadenza", valore: 1 },
            esito: { pieno: "n/d", parziale: "n/d", fallimento: "n/d" },
            prossima: null,
          },
        ],
      },
    ],
    esitoFinale: { varianti: [], default: "n/d" },
  };
  GAME_CONFIG.nodiTemporali.push(nodoBonus);

  // Ruolo "custode": nessun dadoFacce di ruolo, cosi' isoliamo l'effetto
  // del bonus da quello dell'override del dado (testato a parte sopra).
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs, "Prova", "custode");
  await impostaCompetenza(storage, giocatoreId, "cadenza", 3);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-bonus-contesto", giocatoreId, token });

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica(
    "il tiro usa competenza 3 + bonusContesto 1 = 4, non la competenza grezza",
    json.tiro !== null && json.tiro.competenza === 4
  );
}

console.log("\n--- bonusContesto: ignorato se la sua competenza non coincide con competenzaRichiesta ---");
{
  const nodoBonusMismatch = {
    id: "test-nodo-bonus-mismatch",
    titolo: "Nodo di prova bonus contesto disallineato (solo test)",
    richieste: [
      {
        id: "test-richiesta-bonus-mismatch",
        situazione: "n/d",
        prompt: "n/d",
        risposte: [
          {
            testo: "Risposta con bonus dichiarato su un'altra competenza",
            competenzaRichiesta: "cadenza",
            bonusContesto: { competenza: "precisione", valore: 1 },
            esito: { pieno: "n/d", parziale: "n/d", fallimento: "n/d" },
            prossima: null,
          },
        ],
      },
    ],
    esitoFinale: { varianti: [], default: "n/d" },
  };
  GAME_CONFIG.nodiTemporali.push(nodoBonusMismatch);

  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs, "Prova", "custode");
  await impostaCompetenza(storage, giocatoreId, "cadenza", 3);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "test-nodo-bonus-mismatch", giocatoreId, token });

  const { json } = await chiamata(gs, "/scegli", "POST", { risposteIndice: 0, giocatoreId, token });
  verifica(
    "bonusContesto su un'altra competenza non altera il tiro (competenza resta 3)",
    json.tiro !== null && json.tiro.competenza === 3
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
