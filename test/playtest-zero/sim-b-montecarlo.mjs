// ============================================================================
// PLAYTEST ZERO — SIM B: Monte Carlo offline
// ============================================================================
// Strumento di MISURA, non di correzione. Fuori dalla batteria di test.
//   node test/playtest-zero/sim-b-montecarlo.mjs
//
// Usa le funzioni VERE del gioco importate da src/ (non riscrive le regole):
//  - risolviAzione()  -> tiro reale (1d6, soglie 5/8 da GAME_CONFIG)
//  - creaCompetenzeIniziali() -> punteggi base reali per ruolo
//  - fasciaMargine()  -> basso/medio/alto/critico, formula reale del Cronista
//  - GAME_CONFIG      -> margineSoglia, creazionePersonaggio, ...
//
// L'UNICA cosa replicata a mano (perché vive dentro GameSession.applicaRisposta,
// non è una funzione pura importabile) è il passo del Margine e il dimezzamento:
//   passo per esito: pieno +1, parziale +2, fallimento +3  (pattern dominante
//     degli effettiPerEsito nei nodi di game-config.js);
//   allo scoppio (margine >= soglia): margine = Math.floor(soglia/2)  (=2 con soglia 5).
// Entrambi citati testualmente da GameSession.applicaRisposta (righe ~992 e ~1047-1050).
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { risolviAzione, creaCompetenzeIniziali } from "../../src/lib/risoluzione.js";
import { fasciaMargine } from "../../src/lib/narratore-simulato.js";
import { GAME_CONFIG } from "../../src/game-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOGLIA = GAME_CONFIG.margineSoglia; // 5
const PASSO_MARGINE = { pieno: 1, parziale: 2, fallimento: 3 };
const L = [];
const line = (s = "") => L.push(s);
const pct = (n, tot) => ((100 * n) / tot).toFixed(1) + "%";

// ---------------------------------------------------------------------------
// PARTE 1 — distribuzione del tiro
// ---------------------------------------------------------------------------
function distribuzioneTiro(punteggio, iterazioni = 200000) {
  let pieno = 0, parziale = 0, fallimento = 0, sommaTot = 0;
  for (let i = 0; i < iterazioni; i++) {
    const r = risolviAzione(punteggio); // 1d6 reale, soglie reali
    sommaTot += r.totale;
    if (r.esito === "pieno") pieno++;
    else if (r.esito === "parziale") parziale++;
    else fallimento++;
  }
  return { punteggio, iterazioni, pieno, parziale, fallimento, media: sommaTot / iterazioni };
}

function tabellaTiro(titolo, righe) {
  line(`### ${titolo}`);
  line("| punteggio base | fallimento | parziale | pieno | totale medio |");
  line("|---|---|---|---|---|");
  for (const d of righe) {
    line(`| ${d.punteggio} | ${pct(d.fallimento, d.iterazioni)} | ${pct(d.parziale, d.iterazioni)} | ${pct(d.pieno, d.iterazioni)} | ${d.media.toFixed(2)} |`);
  }
}

function parte1() {
  line("## PARTE 1 — Distribuzione del tiro (200.000 tiri per riga, dado 1d6 reale)");
  line("");
  const princ = distribuzioneTiro(3);
  const nonPrinc = distribuzioneTiro(2);
  tabellaTiro("Senza bonus di grado", [
    { ...princ, punteggio: "3 (principale)" },
    { ...nonPrinc, punteggio: "2 (non principale)" },
  ]);
  line("");
  line("*Cosa significa: con la tua competenza forte (base 3) sbagli 1 volta su 6 e riesci in pieno 1 su 3; con una competenza debole (base 2) sbagli 1 volta su 3 e il pieno è raro.*");
  line("");
  const princB = distribuzioneTiro(4);
  const nonPrincB = distribuzioneTiro(3);
  tabellaTiro("Con bonus di grado +1 attivo", [
    { ...princB, punteggio: "3+1 = 4 (principale)" },
    { ...nonPrincB, punteggio: "2+1 = 3 (non principale)" },
  ]);
  line("");
  line("*Cosa significa: un grado militare (+1) dimezza circa i fallimenti e alza molto i pieni — un veterano \"tiene\" dove una recluta cede.*");
  line("");
}

// ---------------------------------------------------------------------------
// PARTE 2 e 3 — dinamica del Margine
// ---------------------------------------------------------------------------
// Simula un nodo di N tiri con la competenza `base`. Restituisce:
//  scoppi, tiriPrimoScoppio (o null), distanze tra scoppi successivi,
//  conteggio fasce (sul valore del Margine dopo ogni tiro, quello che i
//  giocatori vedono tra una scelta e l'altra).
function simulaNodo(nTiri, base, dopoScoppio, sogliaIniziale) {
  let margine = 0;
  let soglia = sogliaIniziale;
  let scoppi = 0;
  let primoScoppio = null;
  const distanze = [];
  let ultimoScoppioTiro = null;
  const fasce = { basso: 0, medio: 0, alto: 0, critico: 0 };
  for (let t = 1; t <= nTiri; t++) {
    const r = risolviAzione(base);
    margine += PASSO_MARGINE[r.esito];
    if (margine >= soglia) {
      scoppi++;
      if (primoScoppio === null) primoScoppio = t;
      if (ultimoScoppioTiro !== null) distanze.push(t - ultimoScoppioTiro);
      ultimoScoppioTiro = t;
      // variante di cosa succede dopo lo scoppio
      if (dopoScoppio === "meta") margine = Math.floor(soglia / 2);
      else if (dopoScoppio === "zero") margine = 0;
      else if (dopoScoppio === "zero-soglia-su") { margine = 0; soglia += 1; }
    }
    fasce[fasciaMargine(margine, soglia)]++;
  }
  return { scoppi, primoScoppio, distanze, fasce, nTiri };
}

function aggregaNodi(nTiri, base, dopoScoppio, sogliaIniziale, nNodi = 100000) {
  let sommaScoppi = 0;
  let sommaPrimo = 0, contaPrimo = 0;
  const istoPrimo = {}; // tiro -> quante volte è arrivato lì il primo scoppio
  let sommaDistanze = 0, contaDistanze = 0;
  const fasceTot = { basso: 0, medio: 0, alto: 0, critico: 0 };
  let tiriTot = 0;
  for (let i = 0; i < nNodi; i++) {
    const n = simulaNodo(nTiri, base, dopoScoppio, sogliaIniziale);
    sommaScoppi += n.scoppi;
    if (n.primoScoppio !== null) { sommaPrimo += n.primoScoppio; contaPrimo++; istoPrimo[n.primoScoppio] = (istoPrimo[n.primoScoppio] || 0) + 1; }
    for (const d of n.distanze) { sommaDistanze += d; contaDistanze++; }
    for (const k of Object.keys(fasceTot)) fasceTot[k] += n.fasce[k];
    tiriTot += n.nTiri;
  }
  return {
    scoppiMedi: sommaScoppi / nNodi,
    primoScoppioMedio: contaPrimo ? sommaPrimo / contaPrimo : null,
    percNodiConScoppio: (100 * contaPrimo) / nNodi,
    istoPrimo,
    distanzaMedia: contaDistanze ? sommaDistanze / contaDistanze : null,
    fascePerc: Object.fromEntries(Object.keys(fasceTot).map((k) => [k, (100 * fasceTot[k]) / tiriTot])),
  };
}

function parte2() {
  line("## PARTE 2 — Il Margine: ogni quanto trabocca");
  line(`Soglia reale: ${SOGLIA}. Dopo lo scoppio torna a ${Math.floor(SOGLIA / 2)} (dimezzamento, regola attuale). 100.000 nodi per riga.`);
  line("Assunzione: tiri con la **competenza principale (base 3)** — il caso più favorevole (\"mandi lo specialista\"). Con base 2 traboccherebbe prima (vedi nota).");
  line("");
  line("| N tiri | scoppi medi/nodo | % nodi con ≥1 scoppio | primo scoppio (tiro medio) | distanza media tra scoppi | basso | medio | alto | critico |");
  line("|---|---|---|---|---|---|---|---|---|");
  const risultati = {};
  for (const N of [3, 5, 8, 12, 20]) {
    const a = aggregaNodi(N, 3, "meta", SOGLIA);
    risultati[N] = a;
    line(`| ${N} | ${a.scoppiMedi.toFixed(2)} | ${a.percNodiConScoppio.toFixed(1)}% | ${a.primoScoppioMedio ? a.primoScoppioMedio.toFixed(2) : "—"} | ${a.distanzaMedia ? a.distanzaMedia.toFixed(2) : "—"} | ${a.fascePerc.basso.toFixed(0)}% | ${a.fascePerc.medio.toFixed(0)}% | ${a.fascePerc.alto.toFixed(0)}% | ${a.fascePerc.critico.toFixed(1)}% |`);
  }
  line("");
  line("*Cosa significa: \"scoppi medi/nodo\" = quante complicazioni da Margine ti aspetti in un nodo di quella lunghezza; \"primo scoppio\" = a che tiro arriva la prima; \"distanza\" = ogni quanti tiri arrivano le successive.*");
  line("");
  // distribuzione del primo scoppio per N=8
  const iP = risultati[8].istoPrimo;
  const chiavi = Object.keys(iP).map(Number).sort((x, y) => x - y);
  const totP = chiavi.reduce((s, k) => s + iP[k], 0);
  line("**Distribuzione del PRIMO scoppio (nodi da 8 tiri):**");
  line("| al tiro n. | " + chiavi.join(" | ") + " |");
  line("|---|" + chiavi.map(() => "---").join("|") + "|");
  line("| % dei nodi | " + chiavi.map((k) => ((100 * iP[k]) / totP).toFixed(0) + "%").join(" | ") + " |");
  line("");
  // verifica ipotesi
  const primo8 = risultati[8].primoScoppioMedio;
  const dist8 = risultati[8].distanzaMedia;
  line("**Verifica dell'ipotesi** (primo scoppio ~3° tiro, successivi ogni ~2 tiri):");
  line(`- Primo scoppio medio (N=8): **${primo8.toFixed(2)} tiri** → ipotesi \"~3\": ${primo8 >= 2.5 && primo8 <= 3.5 ? "CONFERMATA" : "da rivedere"}.`);
  line(`- Distanza media tra scoppi (N=8): **${dist8.toFixed(2)} tiri** → ipotesi \"~2\": ${dist8 >= 1.5 && dist8 <= 2.5 ? "CONFERMATA" : "da rivedere"}.`);
  line("*Il dimezzamento riporta a 2, non a 0: per questo dopo il primo scoppio ne bastano molti meno per il successivo.*");
  line("");
  // nota base 2
  const b2 = aggregaNodi(8, 2, "meta", SOGLIA);
  line(`*Nota (competenza debole, base 2, N=8): primo scoppio a ${b2.primoScoppioMedio.toFixed(2)} tiri, ${b2.scoppiMedi.toFixed(2)} scoppi/nodo — chi tira \"fuori ruolo\" fa traboccare il Margine più in fretta.*`);
  line("");
  return risultati;
}

function parte3() {
  line("## PARTE 3 — Varianti del dimezzamento (N = 8 e 12, base 3)");
  line("");
  const varianti = [
    ["(a) torna a 2 — oggi", "meta", SOGLIA],
    ["(b) torna a 0 — azzeramento", "zero", SOGLIA],
    ["(c) torna a 0 + soglia +1 ogni scoppio", "zero-soglia-su", SOGLIA],
  ];
  for (const N of [8, 12]) {
    line(`### Nodo da ${N} tiri`);
    line("| variante | scoppi medi/nodo | distanza media tra scoppi |");
    line("|---|---|---|");
    for (const [nome, modo, s0] of varianti) {
      const a = aggregaNodi(N, 3, modo, s0);
      line(`| ${nome} | ${a.scoppiMedi.toFixed(2)} | ${a.distanzaMedia ? a.distanzaMedia.toFixed(2) : "—"} |`);
    }
    line("");
  }
  line("*Cosa significa: \"torna a 0\" rende la complicazione un vero respiro (gli scoppi si diradano); \"soglia +1\" li dirada sempre di più, così un nodo lungo non diventa una sequenza di guai a raffica.*");
  line("");
}

// ---------------------------------------------------------------------------
// PARTE 4 — i puntiExtra
// ---------------------------------------------------------------------------
function parte4() {
  line("## PARTE 4 — I puntiExtra (3 punti mai assegnati)");
  line(`Regole di creazione reali: principale ${GAME_CONFIG.creazionePersonaggio.valorePrincipale}, altre ${GAME_CONFIG.creazionePersonaggio.valoreAltre}, punti extra ${GAME_CONFIG.creazionePersonaggio.puntiExtra}, tetto ${GAME_CONFIG.creazionePersonaggio.valoreMassimo}. Punteggi costruiti con creaCompetenzeIniziali() reale (Esploratore).`);
  line("");
  // (a) zero extra
  const a = creaCompetenzeIniziali("esploratore", {});
  // (b) 3 extra, max +1 a competenza NON principale
  const b = creaCompetenzeIniziali("esploratore", { precisione: 1, spiritoDiCorpo: 1, passoAvanti: 1 });
  // (c) 3 extra ovunque, principale inclusa (qui: tutti sulla principale -> cap 5)
  const c = creaCompetenzeIniziali("esploratore", { cadenza: 3 });
  const scenari = [
    ["(a) zero extra (oggi)", a.cadenza, a.precisione],
    ["(b) +1 a 3 non principali", b.cadenza, b.precisione],
    ["(c) 3 sulla principale (cap 5)", c.cadenza, c.precisione],
  ];
  line("| regola | punt. principale | fall/parz/pieno (principale) | punt. non princ. | fall/parz/pieno (non princ.) |");
  line("|---|---|---|---|---|");
  for (const [nome, sp, snp] of scenari) {
    const dp = distribuzioneTiro(sp);
    const dnp = distribuzioneTiro(snp);
    line(`| ${nome} | ${sp} | ${pct(dp.fallimento, dp.iterazioni)} / ${pct(dp.parziale, dp.iterazioni)} / ${pct(dp.pieno, dp.iterazioni)} | ${snp} | ${pct(dnp.fallimento, dnp.iterazioni)} / ${pct(dnp.parziale, dnp.iterazioni)} / ${pct(dnp.pieno, dnp.iterazioni)} |`);
  }
  line("");
  line("*Cosa significa: (b) tocca poco la specialità ma toglie fragilità alle competenze deboli (meno fallimenti fuori ruolo); (c) su un solo punto forte porta la principale al tetto 5 — pieni frequentissimi, ma il resto resta fragile. È la scelta \"specialista vs. equilibrato\".*");
  line("");
}

function finish() {
  mkdirSync(__dirname, { recursive: true });
  writeFileSync(path.join(__dirname, "log-sim-b.md"), L.join("\n"), "utf8");
  console.log(L.join("\n"));
  console.log("\n---\nLog scritto in test/playtest-zero/log-sim-b.md");
}

line("# Playtest zero — Log SIM B (Monte Carlo offline)");
line("");
line(`Data run: ${new Date().toISOString()}`);
line("Regole prese dal codice vero: risolviAzione(), creaCompetenzeIniziali(), fasciaMargine(), GAME_CONFIG.");
line(`Soglia Margine: ${SOGLIA}. Passo per esito: pieno +${PASSO_MARGINE.pieno}, parziale +${PASSO_MARGINE.parziale}, fallimento +${PASSO_MARGINE.fallimento}.`);
line("");
parte1();
const ris2 = parte2();
parte3();
parte4();

// ---- risposta secca in coda ----
const primo3 = aggregaNodi(3, 3, "meta", SOGLIA);
line("## Risposta secca");
line(`- **Quanti tiri servono perché il Margine si accenda almeno una volta?** Con la competenza principale (base 3): un nodo da 3 tiri trabocca nel ${primo3.percNodiConScoppio.toFixed(0)}% dei casi; il primo scoppio arriva in media al ${ris2[5].primoScoppioMedio.toFixed(2)}° tiro. In pratica: **sotto i ~3 tiri il Margine quasi non si accende; serve un nodo da almeno 3-4 tiri perché la complicazione diventi probabile.**`);
line(`- **Il dimezzamento a 2 è troppo generoso?** No verso il basso, sì verso l'alto: dopo il primo scoppio i successivi arrivano ogni ~${ris2[12].distanzaMedia.toFixed(1)} tiri (contro i ~${ris2[12].primoScoppioMedio.toFixed(1)} del primo), perché ripartire da 2 lascia solo ${SOGLIA - Math.floor(SOGLIA / 2)} punti al prossimo scoppio. In un nodo lungo questo produce guai \"a raffica\". Le varianti (b)/(c) della Parte 3 li diradano.`);
line("");
finish();
