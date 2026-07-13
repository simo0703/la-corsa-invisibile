// Test locale: node test-riconoscimento.mjs
//
// Riconoscimento: rimettere in gioco chi ha perso il token di sessione, o
// riprendere una partita col comandante sparito. Tre casi (vedi gli endpoint
// in src/durable-objects/GameSession.js):
//   - CASO 2 "rientro-registrato": prova crittografica (profiloToken), nessuna
//     conferma.
//   - CASO 1 "rientro": ospite che reclama un record esistente, con conferma
//     di un terzo e consegna del token nuovo tramite un "biglietto" segreto.
//   - CASO 3 "comando": prendere il comando, con conferma di un terzo.
// Regole: chi chiede non si conferma da solo; niente auto-approvazione a un
// solo giocatore; veto forte del diretto interessato (batte i "Si" non ancora
// arrivati, ma solo finche' la richiesta e' "in_attesa").
//
// Simula il Durable Object in memoria; un fake D1 (come test-join-profilo-token)
// serve solo al Caso 2, che passa da verificaProfiloDaToken.

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

// Stesso algoritmo di hashSha256 in profili-giocatore.js: replica solo per
// seminare righe di test che corrispondano all'hash calcolato in produzione.
async function sha256Hex(testo) {
  const bit = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(bit))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Fake D1 per sessioni_profilo, riconosce solo la query di verificaTokenSessione.
function creaDbFinto() {
  const sessioni = new Map();
  async function seminaSessione(tokenPlano, profiloId, scadeIl) {
    sessioni.set(await sha256Hex(tokenPlano), { profilo_id: profiloId, scade_il: scadeIl });
  }
  function prepare(sql) {
    const n = sql.replace(/\s+/g, " ").trim();
    return {
      bind(...args) {
        return {
          async first() {
            if (n.startsWith("SELECT profilo_id, scade_il FROM sessioni_profilo")) {
              const riga = sessioni.get(args[0]);
              return riga ? { ...riga } : null;
            }
            throw new Error(`Query non gestita dal fake DB: ${n}`);
          },
        };
      },
    };
  }
  return { prepare, seminaSessione };
}

function nuovaSessione(env = {}) {
  const storage = creaStorageFinto();
  const gs = new GameSession({ storage }, env);
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

// /crea + /join con tokenCreazione valido -> il primo giocatore e' DAVVERO
// comandante. I successivi join sono giocatori normali.
async function joinComandante(gs, nome = "Comandante", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const j = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: j.json.giocatori[0].id, token: j.json.token };
}
async function join(gs, nome, ruolo = "custode", extra = {}) {
  const j = await chiamata(gs, "/join", "POST", { nome, ruolo, ...extra });
  const g = j.json.giocatori[j.json.giocatori.length - 1];
  return { giocatoreId: g.id, token: j.json.token };
}

// Cerca ricorsivamente una chiave per nome (verifica che /state non esponga
// mai i segreti del riconoscimento).
function contieneChiave(valore, nome) {
  if (Array.isArray(valore)) return valore.some((v) => contieneChiave(v, nome));
  if (valore && typeof valore === "object") {
    return Object.keys(valore).some((k) => k === nome) || Object.values(valore).some((v) => contieneChiave(v, nome));
  }
  return false;
}
async function stato(gs) {
  return (await chiamata(gs, "/state")).json;
}
function scadenzaValida() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

console.log("--- CASO 2: registrato che rientra (crypto, nessuna conferma) ---");
{
  const db = creaDbFinto();
  await db.seminaSessione("tok-registrato", 42, scadenzaValida());
  const { gs } = nuovaSessione({ DB: db });

  const j = await chiamata(gs, "/join", "POST", { nome: "Registrata", ruolo: "esploratore", profiloToken: "tok-registrato" });
  const id = j.json.giocatori[0].id;
  const tokenVecchio = j.json.token;
  verifica("il giocatore registrato entra con profiloId 42", j.json.giocatori[0].profiloId === 42);

  const r = await chiamata(gs, "/rientro-registrato", "POST", { profiloToken: "tok-registrato" });
  verifica("rientro-registrato risponde 'riagganciato'", r.json.esito === "riagganciato");
  verifica("riaggancia lo STESSO record (nessun nuovo giocatore)", r.json.giocatoreId === id);
  verifica("la stanza ha ancora un solo giocatore (niente fantasma)", r.json.giocatori.length === 1);
  const tokenNuovo = r.json.token;
  verifica("il token e' nuovo (diverso dal vecchio)", typeof tokenNuovo === "string" && tokenNuovo !== tokenVecchio);

  // Il vecchio token e' invalidato: la vecchia scheda non agisce piu'.
  const conVecchio = await chiamata(gs, "/chat", "POST", { testo: "ciao", giocatoreId: id, token: tokenVecchio });
  verifica("il vecchio token e' invalidato (azione autenticata -> 401)", conVecchio.status === 401);
  const conNuovo = await chiamata(gs, "/chat", "POST", { testo: "ciao", giocatoreId: id, token: tokenNuovo });
  verifica("il token nuovo funziona (azione autenticata -> 200)", conNuovo.status === 200);
}

console.log("\n--- CASO 2: nessun record con quel profiloId -> nessun_match ---");
{
  const db = creaDbFinto();
  await db.seminaSessione("tok-orfano", 999, scadenzaValida());
  const { gs } = nuovaSessione({ DB: db });
  await joinComandante(gs); // esiste un giocatore, ma con profiloId null (ospite)
  const r = await chiamata(gs, "/rientro-registrato", "POST", { profiloToken: "tok-orfano" });
  verifica("profiloToken valido ma nessun record corrispondente -> nessun_match", r.json.esito === "nessun_match");
}

console.log("\n--- CASO 1: rientro con conferma di un terzo ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada"); // comandante
  const b = await join(gs, "Bea");

  // Ada ha "perso" il token: chiede il rientro sul proprio record (non autenticata).
  const req = await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: a.giocatoreId });
  verifica("richiedi-rientro restituisce un biglietto", typeof req.json.biglietto === "string" && req.json.biglietto.length > 0);
  const biglietto = req.json.biglietto;

  const s1 = await stato(gs);
  verifica("lo stato mostra un riconoscimento pendente di tipo 'rientro'", s1.riconoscimentoPendente?.tipo === "rientro");
  verifica("il pendente punta al record giusto", s1.riconoscimentoPendente?.versoGiocatoreId === a.giocatoreId);
  verifica("il pendente e' 'in_attesa'", s1.riconoscimentoPendente?.stato === "in_attesa");
  verifica("/state NON espone mai il biglietto", !contieneChiave(s1, "biglietto"));

  // Il richiedente non puo' confermarsi da solo (anche se avesse ancora il token).
  const autoConf = await chiamata(gs, "/conferma-riconoscimento", "POST", { giocatoreId: a.giocatoreId, token: a.token });
  verifica("il richiedente non puo' auto-confermarsi (403)", autoConf.status === 403);

  // Bea conferma.
  const conf = await chiamata(gs, "/conferma-riconoscimento", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  verifica("la conferma di un terzo risponde 200", conf.status === 200);
  verifica("dopo la conferma il pendente e' 'approvato'", conf.json.riconoscimentoPendente?.stato === "approvato");
  verifica("/state NON espone mai il nuovoToken", !contieneChiave(await stato(gs), "nuovoToken"));

  // Ada reclama il token nuovo col biglietto.
  const reclamo = await chiamata(gs, "/reclama-rientro", "POST", { versoGiocatoreId: a.giocatoreId, biglietto });
  verifica("il reclamo restituisce stato 'approvato'", reclamo.json.stato === "approvato");
  const tokenNuovo = reclamo.json.token;
  verifica("il reclamo consegna un token", typeof tokenNuovo === "string" && tokenNuovo.length > 0);
  verifica("Ada riprende il ruolo di comandante (record intatto)", reclamo.json.giocatori.find((g) => g.id === a.giocatoreId).comandante === true);

  // Vecchio token invalidato, nuovo valido.
  const conVecchio = await chiamata(gs, "/chat", "POST", { testo: "x", giocatoreId: a.giocatoreId, token: a.token });
  verifica("il vecchio token di Ada e' invalidato (401)", conVecchio.status === 401);
  const conNuovo = await chiamata(gs, "/chat", "POST", { testo: "x", giocatoreId: a.giocatoreId, token: tokenNuovo });
  verifica("il token nuovo di Ada funziona (200)", conNuovo.status === 200);

  // Il pendente e' azzerato dopo il reclamo; un secondo reclamo -> chiusa.
  verifica("dopo il reclamo il pendente e' azzerato", (await stato(gs)).riconoscimentoPendente === null);
  const reclamo2 = await chiamata(gs, "/reclama-rientro", "POST", { versoGiocatoreId: a.giocatoreId, biglietto });
  verifica("un secondo reclamo trova la richiesta chiusa", reclamo2.json.stato === "chiusa");
}

console.log("\n--- ECCEZIONE RIMOSSA: con un solo giocatore NON c'e' auto-approvazione ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Sola");
  const req = await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: a.giocatoreId });
  verifica("la richiesta viene creata (biglietto emesso)", typeof req.json.biglietto === "string");
  verifica("NON e' auto-approvata: resta 'in_attesa'", (await stato(gs)).riconoscimentoPendente?.stato === "in_attesa");
  const reclamo = await chiamata(gs, "/reclama-rientro", "POST", { versoGiocatoreId: a.giocatoreId, biglietto: req.json.biglietto });
  verifica("il reclamo resta 'in_attesa' (nessuno puo' confermare)", reclamo.json.stato === "in_attesa");
}

console.log("\n--- CASO 3: prendere il comando con conferma di un terzo ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada"); // comandante (sparito)
  const b = await join(gs, "Bea");
  const c = await join(gs, "Cid", "fanfara");

  const req = await chiamata(gs, "/richiedi-comando", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  verifica("richiedi-comando risponde 200", req.status === 200);
  verifica("il pendente e' di tipo 'comando' e punta a chi chiede", req.json.riconoscimentoPendente?.tipo === "comando" && req.json.riconoscimentoPendente?.versoGiocatoreId === b.giocatoreId);

  const autoConf = await chiamata(gs, "/conferma-riconoscimento", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  verifica("il richiedente non puo' auto-confermarsi (403)", autoConf.status === 403);

  const conf = await chiamata(gs, "/conferma-riconoscimento", "POST", { giocatoreId: c.giocatoreId, token: c.token });
  verifica("la conferma di un terzo risponde 200", conf.status === 200);
  verifica("Bea diventa comandante", conf.json.giocatori.find((g) => g.id === b.giocatoreId).comandante === true);
  verifica("Ada non e' piu' comandante", conf.json.giocatori.find((g) => g.id === a.giocatoreId).comandante === false);
  verifica("il pendente e' azzerato", conf.json.riconoscimentoPendente === null);
}

console.log("\n--- VETO FORTE, CASO 1: il diretto interessato (ancora autenticato) rifiuta ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada"); // Ada e' presente e ha ancora il token
  const b = await join(gs, "Bea");

  // Un impostore reclama il record di Ada mentre Ada e' attiva.
  const req = await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: a.giocatoreId });

  // Un terzo estraneo (Bea) NON puo' vetare: non e' il diretto interessato.
  const vetoTerzo = await chiamata(gs, "/rifiuta-riconoscimento", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  verifica("un terzo estraneo non puo' vetare un rientro (403)", vetoTerzo.status === 403);
  verifica("la richiesta resta pendente dopo il tentativo del terzo", (await stato(gs)).riconoscimentoPendente !== null);

  // Ada (diretto interessato, token valido) veta: la richiesta passa a
  // "rifiutato" (NON azzerata subito), così il richiedente lo scopre.
  const veto = await chiamata(gs, "/rifiuta-riconoscimento", "POST", { giocatoreId: a.giocatoreId, token: a.token });
  verifica("il veto del diretto interessato risponde 200", veto.status === 200);
  verifica("dopo il veto lo stato e' 'rifiutato' (non azzerato subito)", veto.json.riconoscimentoPendente?.stato === "rifiutato");
  const reclamo = await chiamata(gs, "/reclama-rientro", "POST", { versoGiocatoreId: a.giocatoreId, biglietto: req.json.biglietto });
  verifica("il richiedente scopre di essere stato RIFIUTATO (non un generico 'chiusa')", reclamo.json.stato === "rifiutato");
  verifica("dopo la lettura del rifiuto il pendente e' azzerato", (await stato(gs)).riconoscimentoPendente === null);

  // Il token di Ada NON e' stato toccato dal veto.
  const conToken = await chiamata(gs, "/chat", "POST", { testo: "x", giocatoreId: a.giocatoreId, token: a.token });
  verifica("il token di Ada resta valido dopo il veto (200)", conToken.status === 200);
}

console.log("\n--- VETO FORTE, CASO 3: il comandante attuale rifiuta la presa di comando ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada"); // comandante presente
  const b = await join(gs, "Bea");
  const c = await join(gs, "Cid", "fanfara");

  await chiamata(gs, "/richiedi-comando", "POST", { giocatoreId: b.giocatoreId, token: b.token });

  // Un terzo estraneo (Cid, non comandante, non richiedente) non puo' vetare.
  const vetoTerzo = await chiamata(gs, "/rifiuta-riconoscimento", "POST", { giocatoreId: c.giocatoreId, token: c.token });
  verifica("un terzo estraneo non puo' vetare la presa di comando (403)", vetoTerzo.status === 403);

  // Il comandante attuale (Ada) veta.
  const veto = await chiamata(gs, "/rifiuta-riconoscimento", "POST", { giocatoreId: a.giocatoreId, token: a.token });
  verifica("il veto del comandante attuale risponde 200", veto.status === 200);
  const s = await stato(gs);
  verifica("la richiesta e' chiusa", s.riconoscimentoPendente === null);
  verifica("Ada resta comandante", s.giocatori.find((g) => g.id === a.giocatoreId).comandante === true);
  verifica("Bea non e' diventata comandante", s.giocatori.find((g) => g.id === b.giocatoreId).comandante === false);
}

console.log("\n--- Il richiedente puo' annullare la propria richiesta ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada");
  const b = await join(gs, "Bea");

  // Comando: Bea chiede e poi annulla lei stessa.
  await chiamata(gs, "/richiedi-comando", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  const annullaCmd = await chiamata(gs, "/rifiuta-riconoscimento", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  verifica("il richiedente del comando puo' annullare (200)", annullaCmd.status === 200);
  verifica("il pendente comando e' azzerato", (await stato(gs)).riconoscimentoPendente === null);

  // Rientro: annullamento col biglietto.
  const req = await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: a.giocatoreId });
  const annullaRientro = await chiamata(gs, "/rifiuta-riconoscimento", "POST", { biglietto: req.json.biglietto });
  verifica("il richiedente del rientro puo' annullare col biglietto (200)", annullaRientro.status === 200);
  verifica("il pendente rientro e' azzerato", (await stato(gs)).riconoscimentoPendente === null);
}

console.log("\n--- Veto DOPO un 'Si' gia' dato: non ha effetto (guardia stato in_attesa) ---");
{
  // Caso 3: appena Cid conferma, il comando e' trasferito e il pendente
  // azzerato -> il veto tardivo di Ada non trova piu' nulla (400).
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada");
  const b = await join(gs, "Bea");
  const c = await join(gs, "Cid", "fanfara");
  await chiamata(gs, "/richiedi-comando", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  await chiamata(gs, "/conferma-riconoscimento", "POST", { giocatoreId: c.giocatoreId, token: c.token }); // "Si": trasferisce subito
  const vetoTardivo = await chiamata(gs, "/rifiuta-riconoscimento", "POST", { giocatoreId: a.giocatoreId, token: a.token });
  verifica("il veto dopo la conferma non trova piu' nulla (400)", vetoTardivo.status === 400);
  verifica("il comando e' passato comunque a Bea", (await stato(gs)).giocatori.find((g) => g.id === b.giocatoreId).comandante === true);
}
{
  // Caso 1: appena Bea conferma, il pendente passa a "approvato" (in attesa
  // che Ada reclami il token). Un veto tardivo di Ada e' respinto dalla
  // guardia di stato -> 409 "gia' risolta". In piu', la conferma ha gia'
  // riemesso il token di Ada, quindi il suo vecchio token e' comunque
  // invalidato: verifichiamo entrambi i fatti.
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada");
  const b = await join(gs, "Bea");
  await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: a.giocatoreId });
  await chiamata(gs, "/conferma-riconoscimento", "POST", { giocatoreId: b.giocatoreId, token: b.token }); // "Si": riemette il token
  const vetoTardivo = await chiamata(gs, "/rifiuta-riconoscimento", "POST", { giocatoreId: a.giocatoreId, token: a.token });
  verifica("il veto dopo la conferma e' respinto dalla guardia di stato (409, gia' risolta)", vetoTardivo.status === 409);
  const conVecchio = await chiamata(gs, "/chat", "POST", { testo: "x", giocatoreId: a.giocatoreId, token: a.token });
  verifica("e comunque il vecchio token del diretto interessato e' gia' invalidato (401)", conVecchio.status === 401);
}

console.log("\n--- Una sola richiesta alla volta: la seconda prende 409 ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada");
  const b = await join(gs, "Bea");
  await chiamata(gs, "/richiedi-comando", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  const seconda = await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: a.giocatoreId });
  verifica("una seconda richiesta mentre una e' pendente -> 409", seconda.status === 409);
}

console.log("\n--- Casi d'errore di base ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada");
  await join(gs, "Bea");

  const rientroIgnoto = await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: "id-inesistente" });
  verifica("richiedi-rientro su un id inesistente -> 400", rientroIgnoto.status === 400);

  const confSenzaPendente = await chiamata(gs, "/conferma-riconoscimento", "POST", { giocatoreId: a.giocatoreId, token: a.token });
  verifica("conferma senza nessuna richiesta pendente -> 400", confSenzaPendente.status === 400);

  const comandoDaComandante = await chiamata(gs, "/richiedi-comando", "POST", { giocatoreId: a.giocatoreId, token: a.token });
  verifica("il comandante non puo' chiedere di prendere il comando (400)", comandoDaComandante.status === 400);
}

console.log("\n--- Esito del rientro: 'rifiutato' distinto da 'chiusa', e la stanza non resta bloccata ---");
{
  const { gs } = nuovaSessione();
  const a = await joinComandante(gs, "Ada");
  const b = await join(gs, "Bea");

  // (1) Il richiedente che ANNULLA da solo (col biglietto) chiude in silenzio:
  // /reclama vede "chiusa", NON "rifiutato" (non e' stato rifiutato da altri).
  const req1 = await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: a.giocatoreId });
  await chiamata(gs, "/rifiuta-riconoscimento", "POST", { biglietto: req1.json.biglietto });
  const reclamo1 = await chiamata(gs, "/reclama-rientro", "POST", { versoGiocatoreId: a.giocatoreId, biglietto: req1.json.biglietto });
  verifica("annullamento del richiedente stesso -> /reclama vede 'chiusa'", reclamo1.json.stato === "chiusa");

  // (2) Veto del diretto interessato -> "rifiutato". Se il richiedente non lo
  // raccoglie, la stanza NON resta bloccata: una nuova richiesta la sovrascrive
  // (la guardia 409 scatta solo per una richiesta ancora 'in_attesa').
  const req2 = await chiamata(gs, "/richiedi-rientro", "POST", { versoGiocatoreId: a.giocatoreId });
  await chiamata(gs, "/rifiuta-riconoscimento", "POST", { giocatoreId: a.giocatoreId, token: a.token }); // veto
  verifica("dopo il veto lo stato resta 'rifiutato' in /state", (await stato(gs)).riconoscimentoPendente?.stato === "rifiutato");
  const req3 = await chiamata(gs, "/richiedi-comando", "POST", { giocatoreId: b.giocatoreId, token: b.token });
  verifica("una richiesta terminale ('rifiutato') non blocca: la nuova passa (200)", req3.status === 200);
  const dopo = await stato(gs);
  verifica("la nuova richiesta ha sovrascritto la vecchia (ora 'comando', in_attesa)", dopo.riconoscimentoPendente?.tipo === "comando" && dopo.riconoscimentoPendente?.stato === "in_attesa");
  const reclamo2 = await chiamata(gs, "/reclama-rientro", "POST", { versoGiocatoreId: a.giocatoreId, biglietto: req2.json.biglietto });
  verifica("il vecchio biglietto, ormai sovrascritto, vede 'chiusa'", reclamo2.json.stato === "chiusa");
}

console.log("\n--- migrateState: una stanza priva del campo riceve riconoscimentoPendente = null ---");
{
  const { gs, storage } = nuovaSessione();
  await joinComandante(gs, "Ada");
  const s = await storage.get("session");
  delete s.riconoscimentoPendente;
  await storage.put("session", s);
  verifica("il record manipolato non ha davvero il campo", !("riconoscimentoPendente" in (await storage.get("session"))));

  const dopo = await stato(gs);
  verifica("dopo la migrazione il campo e' null (non piu' assente)", dopo.riconoscimentoPendente === null);
  verifica("la migrazione e' persistita", "riconoscimentoPendente" in (await storage.get("session")));
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
