// ============================================================================
// PLAYTEST ZERO — SIM A: partita funzionale completa in PRODUZIONE
// ============================================================================
// Strumento di MISURA, non di correzione. NON fa parte della batteria di test
// (nessuna asserzione OK/FAIL): gioca una partita reale via HTTP contro
// https://la-corsa-invisibile.roomzero.workers.dev e scrive un log dettagliato.
//
//   node test/playtest-zero/sim-a-funzionale.mjs
//
// Cosa fa:
//  - crea una stanza di test in produzione (nomi "Sim..." riconoscibili);
//  - 4 giocatori simulati (Esploratore=comandante, Incursore, Fanfara, Custode);
//  - gioca il nodo 1836-torino dall'inizio alla fine, mischiando bottoni e
//    testo libero (frasi fisse pertinenti/fuori tema, alternate);
//  - a metà nodo il Custode "perde" identità e rientra col Riconoscimento;
//  - ogni giocatore manda >=2 messaggi in chat;
//  - misura ogni tiro, il Margine tiro per tiro, i frammenti del Cronista;
//  - fa uno smoke offline dei contenuti degli altri 4 nodi;
//  - scrive test/playtest-zero/log-sim-a.md.
//
// RIPRODUCIBILITA': tutte le scelte del CLIENT usano un RNG con seme fisso
// (20260714), quindi metodo/indice/frase/rotazione sono identici a ogni run.
// L'UNICO elemento non riproducibile e' il DADO, che e' server-side
// (Math.random nel Worker): i numeri del tiro cambiano di run in run, ma il
// PERCORSO del nodo no (in 1836-torino la ramificazione dipende dalla scelta,
// non dall'esito del tiro).
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseFrammenti, creaPool } from "../../src/lib/narratore-corsa-invisibile-loader.js";
import { componiNarrazione } from "../../src/lib/narratore-simulato.js";

const BASE = "https://la-corsa-invisibile.roomzero.workers.dev";
const SEED = 20260714;
const NODO = "1836-torino";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..", "..");

// --- RNG deterministico (mulberry32) ---------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const randInt = (n) => Math.floor(rng() * n);

// --- log --------------------------------------------------------------------
const L = [];
const line = (s = "") => L.push(s);
const anomalie = [];

// --- HTTP -------------------------------------------------------------------
async function api(method, sub, body, roomId) {
  const p = roomId ? `/api/stanza/${roomId}${sub}` : sub;
  const res = await fetch(BASE + p, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

// fasciaMargine: stessa formula del motore (narratore-simulato.js)
function fasciaMargine(valore, soglia) {
  if (soglia === null || soglia === undefined || soglia <= 0) return "basso";
  const r = valore / soglia;
  if (r >= 1) return "critico";
  if (r >= 0.67) return "alto";
  if (r >= 0.34) return "medio";
  return "basso";
}

// --- misure -----------------------------------------------------------------
const misure = {
  passi: [],
  tiri: [],
  margine: [],
  frammentiCronista: [], // snapshot cumulativi di session.storicoFrammenti
  traboccamenti: [],
};

async function main() {
  line("# Playtest zero — Log SIM A (partita funzionale completa)");
  line("");
  line(`Data run: ${new Date().toISOString()}`);
  line(`Ambiente: ${BASE} (PRODUZIONE)`);
  line(`Seme RNG client: ${SEED} — Nodo: ${NODO}`);
  line("");

  // --- config: margineSoglia --------------------------------------------
  const cfg = await api("GET", "/api/config");
  if (cfg.status !== 200 || !cfg.json) {
    anomalie.push("BLOCCANTE: /api/config non risponde 200");
    return finish(true);
  }
  const margineSoglia = cfg.json.margineSoglia ?? 5;
  line(`margineSoglia (da /api/config): ${margineSoglia}`);
  line("");

  // --- crea stanza -------------------------------------------------------
  const crea = await api("POST", "/api/crea-stanza", {});
  if (crea.status !== 200 || !crea.json?.roomId) {
    anomalie.push(`BLOCCANTE: /api/crea-stanza fallita (status ${crea.status})`);
    return finish(true);
  }
  const roomId = crea.json.roomId;
  const tokenCreazione = crea.json.tokenCreazione;
  line("## Stanza di test");
  line(`roomId: \`${roomId}\``);
  line("");

  // --- join 4 giocatori --------------------------------------------------
  const P = {
    esploratore: { nome: "SimEsploratore", ruolo: "esploratore" },
    incursore: { nome: "SimIncursore", ruolo: "incursore" },
    fanfara: { nome: "SimFanfara", ruolo: "fanfara" },
    custode: { nome: "SimCustode", ruolo: "custode" },
  };
  line("## Ingressi (/join)");
  // Esploratore per primo, con tokenCreazione -> diventa comandante
  {
    const r = await api("POST", "/join", { nome: P.esploratore.nome, ruolo: "esploratore", tokenCreazione }, roomId);
    if (r.status !== 200 || !r.json?.token) { anomalie.push("BLOCCANTE: join Esploratore fallito"); return finish(true); }
    const me = r.json.giocatori[r.json.giocatori.length - 1];
    P.esploratore.id = me.id; P.esploratore.token = r.json.token; P.esploratore.comandante = me.comandante;
    line(`- ${P.esploratore.nome} (esploratore) → id ${me.id.slice(0, 8)}…, comandante=${me.comandante}`);
  }
  for (const key of ["incursore", "fanfara", "custode"]) {
    const r = await api("POST", "/join", { nome: P[key].nome, ruolo: P[key].ruolo }, roomId);
    if (r.status !== 200 || !r.json?.token) { anomalie.push(`BLOCCANTE: join ${key} fallito`); return finish(true); }
    const me = r.json.giocatori[r.json.giocatori.length - 1];
    P[key].id = me.id; P[key].token = r.json.token; P[key].comandante = me.comandante;
    line(`- ${P[key].nome} (${P[key].ruolo}) → id ${me.id.slice(0, 8)}…, comandante=${me.comandante}`);
  }
  line("");
  if (!P.esploratore.comandante) anomalie.push("Esploratore NON è comandante dopo il join col tokenCreazione");

  const attori = [P.esploratore, P.incursore, P.fanfara, P.custode];
  const chatCount = { esploratore: 0, incursore: 0, fanfara: 0, custode: 0 };
  async function chat(key, testo) {
    const r = await api("POST", "/chat", { testo, giocatoreId: P[key].id, token: P[key].token }, roomId);
    if (r.status === 200) chatCount[key]++;
    else anomalie.push(`Chat di ${key} fallita (status ${r.status})`);
  }

  // --- chat iniziale -----------------------------------------------------
  line("## Partita — passo per passo");
  await chat("esploratore", "Squadra, ci siamo tutti? Prendo io il comando.");
  await chat("incursore", "Pronto. Io copro le azioni di precisione.");

  // --- avvia nodo (comandante) ------------------------------------------
  const avvio = await api("POST", "/avvia-nodo", { nodoId: NODO, giocatoreId: P.esploratore.id, token: P.esploratore.token }, roomId);
  if (avvio.status !== 200 || !avvio.json?.richiestaAttiva) {
    anomalie.push(`BLOCCANTE: /avvia-nodo fallita (status ${avvio.status}: ${avvio.text.slice(0, 120)})`);
    return finish(true);
  }
  line(`- **avvio nodo** ${NODO} da ${P.esploratore.nome} (comandante). Prima richiesta: \`${avvio.json.richiestaAttiva.id}\``);
  let margineCorrente = avvio.json.session.margine ?? 0;

  // frasi di testo libero: pertinente (da un testo di risposta reale) e fuori tema
  const FRASE_FUORI_TEMA = "vorrei ordinare una pizza margherita e andare al mare";
  let usaFuoriTema = false; // alterna

  // registra un tiro + margine leggendo la risposta HTTP di scegli/interpreta/risolvi
  function registraEsito(passoN, key, richiestaAttiva, rispostaScelta, ris) {
    const esitoTier = ris.tiro ? ris.tiro.esito : "(nessun tiro)";
    misure.passi.push({
      n: passoN, giocatore: P[key].nome, richiestaId: richiestaAttiva.id,
      risposta: rispostaScelta?.testo ?? "(via interprete)", esito: esitoTier,
    });
    if (ris.tiro) {
      misure.tiri.push({
        n: passoN, giocatore: P[key].nome, competenza: ris.competenzaId,
        base: ris.tiro.competenza, dado: ris.tiro.dado, totale: ris.tiro.totale, esito: ris.tiro.esito,
      });
    }
    // margine: prima -> dopo (dalla sessione restituita)
    const dopo = ris.session?.margine ?? margineCorrente;
    let delta = 0;
    if (rispostaScelta) {
      const ep = rispostaScelta.effettiPerEsito?.[ris.tiro?.esito ?? ""];
      delta = (ep?.margine ?? rispostaScelta.effetti?.margine ?? 0);
    }
    const traboccato = !!ris.complicazione;
    misure.margine.push({
      n: passoN, prima: margineCorrente, delta, dopo, soglia: margineSoglia,
      fascia: fasciaMargine(dopo, margineSoglia), traboccato,
    });
    if (traboccato) {
      misure.traboccamenti.push({ n: passoN, complicazione: ris.complicazione, dimezzatoA: dopo });
    }
    margineCorrente = dopo;
    // frammenti del Cronista (session.storicoFrammenti è esposto in sessionPubblica)
    if (ris.session?.storicoFrammenti) {
      misure.frammentiCronista.push({ n: passoN, storico: [...ris.session.storicoFrammenti] });
    }
  }

  // ---- PASSO scriptato #1: il tiro (Esploratore, Cadenza) --------------
  let passoN = 0;
  let concluso = false;
  {
    passoN++;
    const ra = (await api("GET", "/richiesta-attiva", null, roomId)).json.richiestaAttiva;
    const idxTiro = ra.risposte.findIndex((r) => r.competenzaRichiesta);
    const idx = idxTiro >= 0 ? idxTiro : 0;
    const risposta = ra.risposte[idx];
    const r = await api("POST", "/scegli", { risposteIndice: idx, giocatoreId: P.esploratore.id, token: P.esploratore.token }, roomId);
    if (r.status !== 200) { anomalie.push(`BLOCCANTE: /scegli tiro fallita (status ${r.status}: ${r.text.slice(0, 120)})`); return finish(true); }
    registraEsito(passoN, "esploratore", ra, risposta, r.json);
    line(`- **[${passoN}] tiro** — ${P.esploratore.nome} sceglie «${risposta.testo}» su \`${ra.id}\` → esito ${r.json.tiro?.esito} (dado ${r.json.tiro?.dado}, tot ${r.json.tiro?.totale})`);
    if (r.json.esitoNodo) concluso = true;
  }

  // ---- EVENTO SCRIPTATO: il Custode perde identità e rientra ------------
  line("");
  line("### Evento scriptato — Riconoscimento del Custode (rientro ospite)");
  const custodePrima = (await api("GET", "/state", null, roomId)).json.giocatori.find((g) => g.nome === "SimCustode");
  // il harness "butta via" token e id del Custode (come un browser che perde il localStorage)
  const idPerso = P.custode.id, tokenPerso = P.custode.token;
  P.custode.id = null; P.custode.token = null;
  line(`- Il Custode scarta token+id (simulando perdita localStorage). Vecchio id: ${idPerso.slice(0, 8)}…`);
  // ritrova il proprio record dal roster pubblico (per nome), come farebbe la UI
  const rec = (await api("GET", "/state", null, roomId)).json.giocatori.find((g) => g.nome === "SimCustode");
  const versoGiocatoreId = rec?.id;
  // CASO 1: richiedi-rientro -> biglietto
  const richiesta = await api("POST", "/richiedi-rientro", { versoGiocatoreId }, roomId);
  const biglietto = richiesta.json?.biglietto;
  line(`- /richiedi-rientro su ${versoGiocatoreId?.slice(0, 8)}… → biglietto ${biglietto ? "ricevuto" : "MANCANTE"}`);
  // un ALTRO giocatore conferma (l'Incursore)
  const conferma = await api("POST", "/conferma-riconoscimento", { giocatoreId: P.incursore.id, token: P.incursore.token }, roomId);
  line(`- /conferma-riconoscimento da ${P.incursore.nome} → status ${conferma.status}`);
  // il Custode reclama -> token nuovo
  const reclama = await api("POST", "/reclama-rientro", { versoGiocatoreId, biglietto }, roomId);
  let riconoscimentoOk = false;
  if (reclama.status === 200 && reclama.json?.stato === "approvato") {
    P.custode.id = reclama.json.giocatoreId;
    P.custode.token = reclama.json.token;
    const custodeDopo = reclama.json.giocatori.find((g) => g.id === P.custode.id);
    const stessoPosto =
      P.custode.id === idPerso &&
      custodeDopo?.ruolo === custodePrima?.ruolo &&
      JSON.stringify(custodeDopo?.competenze) === JSON.stringify(custodePrima?.competenze);
    riconoscimentoOk = stessoPosto;
    line(`- /reclama-rientro → **approvato**. Nuovo token ricevuto, id ripristinato: ${P.custode.id === idPerso ? "STESSO id" : "id DIVERSO!"}`);
    line(`- Verifica "stesso personaggio, stesso stato": ruolo ${custodeDopo?.ruolo} (era ${custodePrima?.ruolo}), competenze ${JSON.stringify(custodeDopo?.competenze) === JSON.stringify(custodePrima?.competenze) ? "INVARIATE" : "CAMBIATE!"} → ${stessoPosto ? "OK" : "ANOMALIA"}`);
    if (!stessoPosto) anomalie.push("Riconoscimento: il Custode NON ha ripreso esattamente il suo posto");
  } else {
    anomalie.push(`BLOCCANTE: /reclama-rientro non approvato (status ${reclama.status}, stato ${reclama.json?.stato})`);
    return finish(true);
  }
  await chat("custode", "Scusate, mi era saltata la connessione. Rientrato!");
  await chat("fanfara", "Bentornato Custode, tenevo io il ritmo intanto.");
  line("");

  // ---- resto del nodo: alterna testo libero e bottoni ------------------
  line("### Resto del nodo (bottoni + testo libero alternati)");
  let guardia = 0;
  while (!concluso && guardia < 12) {
    guardia++; passoN++;
    const raRes = await api("GET", "/richiesta-attiva", null, roomId);
    const ra = raRes.json?.richiestaAttiva;
    if (!ra) { line(`- [${passoN}] nessuna richiesta attiva → nodo concluso`); break; }
    const key = ["esploratore", "incursore", "fanfara", "custode"][passoN % 4];
    const usaTestoLibero = passoN % 2 === 0; // alterna
    if (usaTestoLibero) {
      // pertinente = incipit del testo di una risposta reale; fuori tema = frase fissa
      const rispPert = ra.risposte[randInt(ra.risposte.length)];
      const frase = usaFuoriTema ? FRASE_FUORI_TEMA : rispPert.testo.split(" ").slice(0, 6).join(" ");
      usaFuoriTema = !usaFuoriTema;
      const r = await api("POST", "/interpreta", { testoLibero: frase, richiestaId: ra.id, giocatoreId: P[key].id, token: P[key].token }, roomId);
      if (r.status !== 200) { line(`- [${passoN}] /interpreta status ${r.status} (${r.text.slice(0, 80)}) → fallback bottone`); }
      const esito = r.json?.esito;
      if (esito === "manuale") {
        // il comandante risolve, scegliendo il primo candidato
        const pend = (await api("GET", "/state", null, roomId)).json.interpretazionePendente;
        const idxCand = pend?.candidati?.[0]?.opzione?.effetto?.risposteIndice ?? pend?.candidati?.[0]?.risposteIndice;
        const idx = idxCand != null ? parseInt(idxCand, 10) : 0;
        const rr = await api("POST", "/risolvi-interpretazione", { risposteIndice: idx, giocatoreId: P.esploratore.id, token: P.esploratore.token }, roomId);
        registraEsito(passoN, key, ra, ra.risposte[idx], rr.json ?? {});
        line(`- **[${passoN}] testo libero (ambiguo→comandante)** — ${P[key].nome}: «${frase}» → risolto su risposta #${idx}`);
        if (rr.json?.esitoNodo) concluso = true;
      } else if (esito === "automatica") {
        registraEsito(passoN, key, ra, null, r.json);
        line(`- **[${passoN}] testo libero (auto)** — ${P[key].nome}: «${frase}» → applicata; esito ${r.json.tiro?.esito ?? "(fisso)"}`);
        if (r.json.esitoNodo) concluso = true;
      } else {
        // nessuna_corrispondenza o errore → fallback su un bottone
        const idx = randInt(ra.risposte.length);
        const rr = await api("POST", "/scegli", { risposteIndice: idx, giocatoreId: P[key].id, token: P[key].token }, roomId);
        registraEsito(passoN, key, ra, ra.risposte[idx], rr.json ?? {});
        line(`- **[${passoN}] testo libero (fuori tema: «${frase}») → nessun match, fallback bottone #${idx}** — ${P[key].nome}`);
        if (rr.json?.esitoNodo) concluso = true;
      }
    } else {
      const idx = randInt(ra.risposte.length);
      const r = await api("POST", "/scegli", { risposteIndice: idx, giocatoreId: P[key].id, token: P[key].token }, roomId);
      if (r.status !== 200) { anomalie.push(`/scegli passo ${passoN} status ${r.status}`); break; }
      registraEsito(passoN, key, ra, ra.risposte[idx], r.json);
      line(`- **[${passoN}] bottone** — ${P[key].nome} sceglie «${ra.risposte[idx].testo}» → esito ${r.json.tiro?.esito ?? "(fisso)"}`);
      if (r.json.esitoNodo) concluso = true;
    }
    // qualche messaggio di chat sparso
    if (passoN === 2) await chat("incursore", "Andiamo decisi, non rallentiamo.");
    if (passoN === 3) await chat("fanfara", "Reggo io il morale della squadra.");
    if (passoN === 3) await chat("custode", "Occhio ai feriti, li copro io.");
    if (passoN === 4) await chat("esploratore", "Bene così, ultimo sforzo.");
  }
  if (guardia >= 12 && !concluso) anomalie.push("BLOCCANTE: il nodo non si è concluso entro 12 passi (possibile loop)");

  // --- chat: garantisci >=2 messaggi per ciascuno (il nodo può finire in
  // pochi passi, quindi non affidiamo il conteggio alla durata del loop) ---
  const codaChat = {
    esploratore: "Buona corsa a tutti, ci si rivede al prossimo nodo.",
    incursore: "Chiudo io, tutto sotto controllo.",
    fanfara: "La fanfara non si ferma mai, avanti!",
    custode: "Nessuno resta indietro, ci penso io.",
  };
  for (const k of ["esploratore", "incursore", "fanfara", "custode"]) {
    while (chatCount[k] < 2) await chat(k, codaChat[k]);
  }

  // --- esito finale del nodo --------------------------------------------
  const statoFinale = (await api("GET", "/state", null, roomId)).json;
  const diario = statoFinale.storicoNodo?.[statoFinale.storicoNodo.length - 1];
  line("");
  line(`- **Nodo concluso**: ${concluso ? "SÌ" : "NO"}. Esito finale: ${diario?.esitoFinale ? JSON.stringify(diario.esitoFinale).slice(0, 200) : "(non registrato)"}`);
  line("");

  // --- coerenza: 4 letture con le 4 identità ----------------------------
  line("## Coerenza finale (i 4 giocatori vedono la stessa stanza)");
  const viste = [];
  for (const a of attori) {
    const s = (await api("GET", "/state", null, roomId)).json;
    viste.push(JSON.stringify({ margine: s.margine, orologio: s.orologio, nGiocatori: s.giocatori.length, nodo: s.nodoAttivo, chat: s.chat.length }));
  }
  const tutteUguali = viste.every((v) => v === viste[0]);
  line(`- Le 4 fotografie della stanza (margine/orologio/giocatori/nodo/chat) sono ${tutteUguali ? "IDENTICHE ✓" : "DIVERSE ✗"}`);
  line(`- Snapshot: \`${viste[0]}\``);
  if (!tutteUguali) anomalie.push("Le 4 letture di /state non coincidono");
  line(`- Messaggi in chat per giocatore: ${JSON.stringify(chatCount)} (ognuno deve avere ≥2)`);
  for (const k of Object.keys(chatCount)) if (chatCount[k] < 2) anomalie.push(`${k} ha meno di 2 messaggi in chat (${chatCount[k]})`);
  line("");

  scriviMisure();
  await smokeAltriNodi();
  finish(false);
  return { roomId, concluso, riconoscimentoOk };
}

// --- PASSO 3: sezioni di misura --------------------------------------------
function scriviMisure() {
  line("## Misure (PASSO 3)");
  line("");
  line("### a) Passi");
  for (const p of misure.passi) line(`- [${p.n}] ${p.giocatore} · \`${p.richiestaId}\` · «${p.risposta}» · esito: ${p.esito}`);
  line("");
  line("### b) Tiri");
  if (misure.tiri.length === 0) line("- (nessun tiro)");
  for (const t of misure.tiri) line(`- [${t.n}] ${t.giocatore} · ${t.competenza}: base ${t.base} + dado ${t.dado} = **${t.totale}** → ${t.esito}`);
  line("");
  line("### c) Margine, tiro per tiro");
  line("| passo | prima | +delta | dopo | soglia | fascia | traboccato |");
  line("|---|---|---|---|---|---|---|");
  for (const m of misure.margine) line(`| ${m.n} | ${m.prima} | ${m.delta >= 0 ? "+" : ""}${m.delta} | ${m.dopo} | ${m.soglia} | ${m.fascia} | ${m.traboccato ? "SÌ" : "no"} |`);
  line("");
  const nTrab = misure.traboccamenti.length;
  const nTiri = misure.tiri.length;
  line(`**Traboccamenti totali nel nodo: ${nTrab}.**`);
  if (nTrab > 0) {
    for (const t of misure.traboccamenti) line(`- al passo ${t.n}: «${t.complicazione}» → margine dimezzato a ${t.dimezzatoA}`);
    line(`- Media: un traboccamento ogni ${(misure.margine.length / nTrab).toFixed(1)} scelte (${(nTiri / nTrab || 0).toFixed(1)} tiri).`);
  } else {
    line(`- Il Margine non ha mai raggiunto la soglia ${misure.margine[0]?.soglia ?? 5} in questo nodo (con ${nTiri} tiro/i e ${misure.margine.length} scelte). Dato utile alla taratura: la soglia potrebbe essere alta per un nodo breve.`);
  }
  line("");
  line("### d) Frammenti del Cronista (finestra anti-ripetizione = 12)");
  const ultimo = misure.frammentiCronista[misure.frammentiCronista.length - 1];
  if (!ultimo) {
    line("- Il Cronista non è stato invocato (nessun tiro con pool).");
  } else {
    line(`- storicoFrammenti finale (${ultimo.storico.length} id): \`${ultimo.storico.join(", ")}\``);
    const set = new Set(ultimo.storico);
    const unici = set.size === ultimo.storico.length;
    line(`- Ripetizioni entro la finestra di 12: ${unici ? "NESSUNA ✓" : "PRESENTI ✗"}`);
    if (!unici) anomalie.push("Il Cronista ha ripetuto un frammento entro la finestra di 12");
    line(`- Nota: 1836-torino ha una sola risposta a tiro, quindi il Cronista scatta una sola volta (≈3 id, uno per slot): la finestra di 12 non può essere realmente stressata in un singolo nodo — servirebbero più tiri o repliche.`);
  }
  line("");
}

// --- PASSO 4: smoke offline degli altri 4 nodi -----------------------------
async function smokeAltriNodi() {
  line("## Smoke test contenuti degli altri 4 nodi (offline, PASSO 4)");
  const nodi = [
    ["1848-milano", "narratore-1848-milano.md"],
    ["1915-carso-piave", "narratore-1915-carso-piave.md"],
    ["emergenza-civile", "narratore-emergenza-civile.md"],
    ["missione-moderna", "narratore-missione-moderna.md"],
  ];
  for (const [nome, file] of nodi) {
    try {
      const md = readFileSync(path.join(REPO, "src", "lib", file), "utf8");
      const frammenti = parseFrammenti(md);
      const slots = Object.keys(frammenti).sort().join(",");
      const strutturaOk = slots === "apertura,eco,sviluppo";
      const pool = creaPool(md); // creaPool vuole il markdown grezzo, non i frammenti già parsati
      // prova una composizione minima per esito=pieno
      const { testo } = componiNarrazione(pool, {
        esito: "pieno", competenzaId: "cadenza", ruoloId: "esploratore",
        margine: { valore: 0, soglia: 5, delta: 0 }, variabili: { ruolo: "La squadra" },
        storicoFrammenti: [],
      });
      const composeOk = typeof testo === "string" && testo.length > 0;
      line(`- **${nome}** (${file}): slot [${slots}] ${strutturaOk ? "✓" : "✗ struttura diversa da 1836-torino"}; composizione ${composeOk ? "OK" : "FALLITA"}`);
      if (!strutturaOk) anomalie.push(`Nodo ${nome}: struttura slot diversa da 1836-torino`);
      if (!composeOk) anomalie.push(`Nodo ${nome}: componiNarrazione non produce testo`);
    } catch (e) {
      line(`- **${nome}** (${file}): ERRORE di caricamento — ${e.message}`);
      anomalie.push(`Nodo ${nome}: errore di caricamento offline — ${e.message}`);
    }
  }
  line("");
}

function finish(bloccante) {
  line("## ANOMALIE");
  if (anomalie.length === 0) line("- (nessuna)");
  else for (const a of anomalie) line(`- ${a}`);
  line("");
  if (bloccante) line("> ⚠️ Run interrotto da un problema BLOCCANTE (vedi sopra).");
  mkdirSync(__dirname, { recursive: true });
  writeFileSync(path.join(__dirname, "log-sim-a.md"), L.join("\n"), "utf8");
  console.log(L.join("\n"));
  console.log("\n---\nLog scritto in test/playtest-zero/log-sim-a.md");
}

main().catch((e) => {
  anomalie.push(`ECCEZIONE non gestita: ${e.stack || e.message}`);
  finish(true);
});
