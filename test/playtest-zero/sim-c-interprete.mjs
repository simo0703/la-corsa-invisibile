// ============================================================================
// PLAYTEST ZERO — SIM C: taratura dell'interprete di testo libero
// ============================================================================
// Strumento di MISURA, non di correzione. Fuori dalla batteria di test.
//   node test/playtest-zero/sim-c-interprete.mjs
//
// Usa l'interprete VERO (simulatore-interprete) e le librerie VERE del nodo
// 1836-torino, caricate come fa GameSession: .md letto da fs -> analizzaLibreria
// -> opzioni -> interpreta(testo, opzioni, { sogliaAlta, margineDistacco }).
// NON reimplementa la logica e NON tocca sogliaAlta/margineDistacco nel codice:
// li passa come parametri per misurare (valori attuali 0.6 / 0.15).
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { analizzaLibreria } from "simulatore-interprete/src/libreria.js";
import { calcolaPunteggi } from "simulatore-interprete/src/punteggio.js";
import { interpreta } from "simulatore-interprete/src/interprete.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..", "..");
const LIBDIR = path.join(REPO, "src", "lib", "interprete-libero", "1836-torino");

// Valori ATTUALI delle due manopole (src/durable-objects/GameSession.js).
const SOGLIA_ALTA = 0.6;
const MARGINE_DISTACCO = 0.15;

// Librerie vere, caricate come fa GameSession (analizzaLibreria sul .md).
const OPZIONI = {
  "decalogo-ginnastica": analizzaLibreria(readFileSync(path.join(LIBDIR, "decalogo-ginnastica.md"), "utf8")),
  "decalogo-vaira": analizzaLibreria(readFileSync(path.join(LIBDIR, "decalogo-vaira.md"), "utf8")),
  "decalogo-vaira-severo": analizzaLibreria(readFileSync(path.join(LIBDIR, "decalogo-vaira-severo.md"), "utf8")),
};

// Corpus: [id, richiesta, frase, attesoTipo, attesoIndice|null]
const CORPUS = [
  ["A1", "decalogo-ginnastica", "vado a tutta velocità, chi se ne frega dei rischi", "automatica", 0],
  ["A2", "decalogo-ginnastica", "corro con calma e mi tengo il fiato per dopo", "automatica", 1],
  ["A3", "decalogo-ginnastica", "do una mano a chi resta indietro", "automatica", 2],
  ["B6", "decalogo-ginnastica", "me ne frego e spingo", "automatica", 0],
  ["B7", "decalogo-ginnastica", "non strafaccio, tengo il passo giusto", "automatica", 1],
  ["B8", "decalogo-ginnastica", "nessuno resta indietro", "automatica", 2],
  ["C11", "decalogo-ginnastica", "corro veloce ma senza strafare", "manuale", null],
  ["C12", "decalogo-ginnastica", "corro", "manuale", null],
  ["C13", "decalogo-ginnastica", "vado forte però attento a non cadere", "manuale", null],
  ["C14", "decalogo-ginnastica", "corro con gli altri", "manuale", null],
  ["D15", "decalogo-ginnastica", "mangio un panino", "nessuna_corrispondenza", null],
  ["D16", "decalogo-ginnastica", "chiamo mia madre", "nessuna_corrispondenza", null],
  ["D17", "decalogo-ginnastica", "asdfgh", "nessuna_corrispondenza", null],
  ["D18", "decalogo-ginnastica", "buongiorno a tutti", "nessuna_corrispondenza", null],
  ["D19", "decalogo-ginnastica", "", "nessuna_corrispondenza", null],
  ["D20", "decalogo-ginnastica", "non lo so", "nessuna_corrispondenza", null],
  ["A5", "decalogo-vaira", "scherzo e cambio discorso", "automatica", 1],
  ["B10", "decalogo-vaira", "lo dico chiaro: ho paura", "automatica", 0],
  ["A4", "decalogo-vaira-severo", "ammetto che ho paura di sembrare debole", "automatica", 0],
  ["B9", "decalogo-vaira-severo", "tengo la bocca chiusa", "automatica", 1],
];

const L = [];
const line = (s = "") => L.push(s);

// indice scelto quando l'esito è automatica
function indiceScelto(ris) {
  if (ris.tipo !== "automatica") return null;
  return parseInt(ris.opzione.effetto.risposteIndice, 10);
}

// classifica il singolo verdetto in: ok | falso-automatismo | falso-rifiuto | falso-aggancio
function classifica(atteso, attesoIdx, ris) {
  const idx = indiceScelto(ris);
  if (ris.tipo === "automatica") {
    // deciso da solo: giusto solo se ci si aspettava proprio quella automatica su quell'indice
    if (atteso === "automatica" && idx === attesoIdx) return "ok";
    return "falso-automatismo"; // ambigua/spazzatura decisa da sola, o indice sbagliato
  }
  if (atteso === "automatica") {
    // ci si aspettava una scelta automatica, ma è finita in manuale/nessuna
    return "falso-rifiuto";
  }
  if (atteso === "nessuna_corrispondenza" && ris.tipo === "manuale") {
    return "falso-aggancio"; // spazzatura con punteggio > 0 finita in manuale
  }
  // atteso manuale->manuale, atteso nessuna->nessuna
  return ris.tipo === atteso ? "ok" : "altro";
}

// ---- PARTE 1: le 20 frasi coi valori attuali -------------------------------
line("# Playtest zero — Log SIM C (taratura dell'interprete)");
line("");
line(`Data run: ${new Date().toISOString()}`);
line("Interprete e librerie VERI (simulatore-interprete + src/lib/interprete-libero/1836-torino).");
line(`Manopole attuali: sogliaAlta = ${SOGLIA_ALTA}, margineDistacco = ${MARGINE_DISTACCO}.`);
line("");
line("## Le 20 frasi coi valori attuali (0.6 / 0.15)");
line("| id | richiesta | frase | migliore | secondo | distacco | esito | idx | atteso | coincide | errore |");
line("|---|---|---|---|---|---|---|---|---|---|---|");

const conteggio = { "falso-automatismo": 0, "falso-rifiuto": 0, "falso-aggancio": 0, ok: 0, altro: 0 };
const dettaglioErrori = [];

for (const [id, richiesta, frase, atteso, attesoIdx] of CORPUS) {
  const opzioni = OPZIONI[richiesta];
  const punteggi = calcolaPunteggi(frase, opzioni).sort((a, b) => b.punteggio - a.punteggio);
  const migliore = punteggi[0]?.punteggio ?? 0;
  const secondo = punteggi[1]?.punteggio ?? 0;
  const distacco = migliore - secondo;
  const ris = interpreta(frase, opzioni, { sogliaAlta: SOGLIA_ALTA, margineDistacco: MARGINE_DISTACCO });
  const idx = indiceScelto(ris);
  const esitoAtteso = atteso === "automatica" ? `automatica,${attesoIdx}` : atteso;
  const coincide =
    (ris.tipo === atteso) && (atteso !== "automatica" || idx === attesoIdx);
  const errore = classifica(atteso, attesoIdx, ris);
  conteggio[errore] = (conteggio[errore] || 0) + 1;
  if (errore !== "ok") dettaglioErrori.push({ id, frase, esito: ris.tipo, idx, atteso: esitoAtteso, errore });
  const fraseVis = frase === "" ? "«»(vuota)" : frase;
  line(`| ${id} | ${richiesta.replace("decalogo-", "")} | ${fraseVis} | ${migliore.toFixed(3)} | ${secondo.toFixed(3)} | ${distacco.toFixed(3)} | ${ris.tipo} | ${idx ?? "—"} | ${esitoAtteso} | ${coincide ? "✓" : "✗"} | ${errore === "ok" ? "" : errore} |`);
}
line("");

line("## Conteggio errori coi valori attuali (0.6 / 0.15)");
line(`- **FALSI AUTOMATISMI** (il peggiore: azione non richiesta eseguita da sola): **${conteggio["falso-automatismo"]}**`);
line(`- **FALSI RIFIUTI** (frase A/B centrata ma non decisa): **${conteggio["falso-rifiuto"]}**`);
line(`- **FALSI AGGANCI** (spazzatura D finita in manuale invece di nessuna_corrispondenza): **${conteggio["falso-aggancio"]}**`);
line(`- Corrette: ${conteggio.ok}/20` + (conteggio.altro ? ` (altre discrepanze: ${conteggio.altro})` : ""));
line("");
if (dettaglioErrori.length) {
  line("Dettaglio degli errori:");
  for (const e of dettaglioErrori) line(`- [${e.id}] «${e.frase || "(vuota)"}» → ${e.esito}${e.idx != null ? " idx " + e.idx : ""} (atteso ${e.atteso}) = **${e.errore}**`);
  line("");
}

// ---- PARTE 2: la griglia delle manopole ------------------------------------
line("## Griglia: come cambiano gli errori variando le manopole");
line("sogliaAlta 0.40→0.80 (passo 0.05), margineDistacco 0.05→0.35 (passo 0.05). Le 20 frasi per ogni combinazione.");
line("");

function seq(from, to, step) {
  const out = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
const sogliaValori = seq(0.4, 0.8, 0.05);
const distaccoValori = seq(0.05, 0.35, 0.05);

// pre-calcolo dei punteggi per frase (non dipendono dalle manopole): solo per
// coerenza — comunque richiamiamo l'interprete vero per la decisione.
const risultatiGriglia = [];
for (const sa of sogliaValori) {
  for (const md of distaccoValori) {
    const c = { "falso-automatismo": 0, "falso-rifiuto": 0, "falso-aggancio": 0, ok: 0, altro: 0 };
    for (const [, richiesta, frase, atteso, attesoIdx] of CORPUS) {
      const ris = interpreta(frase, OPZIONI[richiesta], { sogliaAlta: sa, margineDistacco: md });
      c[classifica(atteso, attesoIdx, ris)]++;
    }
    risultatiGriglia.push({ sa, md, ...c });
  }
}

// tabella completa (falsi automatismi / rifiuti / agganci)
line("Legenda celle: `automatismi / rifiuti / agganci`.");
line("");
line("| sogliaAlta ↓ / margineDistacco → | " + distaccoValori.map((d) => d.toFixed(2)).join(" | ") + " |");
line("|---|" + distaccoValori.map(() => "---").join("|") + "|");
for (const sa of sogliaValori) {
  const celle = distaccoValori.map((md) => {
    const r = risultatiGriglia.find((x) => x.sa === sa && x.md === md);
    return `${r["falso-automatismo"]}/${r["falso-rifiuto"]}/${r["falso-aggancio"]}`;
  });
  line(`| **${sa.toFixed(2)}** | ${celle.join(" | ")} |`);
}
line("");

// combinazioni con 0 falsi automatismi, poi minimo falsi rifiuti, poi minimo agganci
const zeroAuto = risultatiGriglia.filter((r) => r["falso-automatismo"] === 0);
const minRifiuti = zeroAuto.length ? Math.min(...zeroAuto.map((r) => r["falso-rifiuto"])) : null;
const migliori = zeroAuto.filter((r) => r["falso-rifiuto"] === minRifiuti);
const minAgganci = migliori.length ? Math.min(...migliori.map((r) => r["falso-aggancio"])) : null;
const raccomandate = migliori.filter((r) => r["falso-aggancio"] === minAgganci);

line("## Raccomandazione dalla griglia (solo misura, nessuna modifica al codice)");
if (!zeroAuto.length) {
  line("- Nessuna combinazione nell'intervallo esaminato azzera i falsi automatismi.");
} else {
  line(`- Combinazioni che **azzerano i FALSI AUTOMATISMI**: ${zeroAuto.length} su ${risultatiGriglia.length}.`);
  line(`- Tra quelle, **minimo FALSI RIFIUTI = ${minRifiuti}**; tra queste, minimo FALSI AGGANCI = ${minAgganci}.`);
  line("- **Combinazione/i raccomandata/e** (automatismi 0, rifiuti minimi, agganci minimi):");
  for (const r of raccomandate) {
    line(`  - **sogliaAlta = ${r.sa.toFixed(2)}, margineDistacco = ${r.md.toFixed(2)}** → automatismi ${r["falso-automatismo"]}, rifiuti ${r["falso-rifiuto"]}, agganci ${r["falso-aggancio"]}, corrette ${r.ok}/20`);
  }
  line(`- Confronto coi valori attuali (0.60 / 0.15): automatismi ${conteggio["falso-automatismo"]}, rifiuti ${conteggio["falso-rifiuto"]}, agganci ${conteggio["falso-aggancio"]}, corrette ${conteggio.ok}/20.`);
}
line("");

mkdirSync(__dirname, { recursive: true });
writeFileSync(path.join(__dirname, "log-sim-c.md"), L.join("\n"), "utf8");
console.log(L.join("\n"));
console.log("\n---\nLog scritto in test/playtest-zero/log-sim-c.md");

// per il report a schermo
console.log("\n=== SINTESI ===");
console.log(`Attuali 0.6/0.15 -> automatismi ${conteggio["falso-automatismo"]}, rifiuti ${conteggio["falso-rifiuto"]}, agganci ${conteggio["falso-aggancio"]}, corrette ${conteggio.ok}/20`);
if (raccomandate.length) {
  const r = raccomandate[0];
  console.log(`Raccomandata -> sogliaAlta ${r.sa.toFixed(2)}, margineDistacco ${r.md.toFixed(2)} (automatismi ${r["falso-automatismo"]}, rifiuti ${r["falso-rifiuto"]}, agganci ${r["falso-aggancio"]})`);
}
