// Test locale: node test-interprete-libero-missione-moderna.mjs
//
// Verifica le librerie reali del testo libero per il nodo missione-moderna
// (moderna-fiducia, moderna-provocazione): si caricano correttamente e, per
// ciascuna delle 4 opzioni totali, una frase chiara scelta a mano produce
// un match automatico su quella e solo quella opzione — stesso approccio
// già usato per la libreria di prova in test-interprete-libero.mjs, e per
// il contenuto reale del nodo emergenza-civile in
// test-interprete-libero-emergenza-civile.mjs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { analizzaLibreria } from "simulatore-interprete/src/libreria.js";
import { interpreta } from "simulatore-interprete/src/interprete.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function caricaLibreria(nomeFile) {
  const percorso = path.join(__dirname, "src", "lib", "interprete-libero", "missione-moderna", nomeFile);
  return analizzaLibreria(readFileSync(percorso, "utf8"));
}

// Soglie usate anche in GameSession.js (SOGLIA_ALTA_PROVVISORIA /
// MARGINE_DISTACCO_PROVVISORIO): stesse qui, per verificare lo stesso
// comportamento che avrà davvero il gioco.
const SOGLIE = { sogliaAlta: 0.6, margineDistacco: 0.15 };

console.log("--- moderna-fiducia.md ---");
{
  const opzioni = caricaLibreria("moderna-fiducia.md");
  verifica("la libreria ha le 2 opzioni attese", opzioni.length === 2);
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["mostra-forza", "0"], ["siediti-parla", "1"]])
  );

  const mostraForza = interpreta("mostriamo la forza, così capiscono che possiamo proteggerli", opzioni, SOGLIE);
  verifica("mostra-forza: frase chiara -> automatica", mostraForza.tipo === "automatica" && mostraForza.opzione.id === "mostra-forza");

  const siedititiParla = interpreta("ci sediamo a parlare, senza fretta e senza armi in vista", opzioni, SOGLIE);
  verifica("siediti-parla: frase chiara -> automatica", siedititiParla.tipo === "automatica" && siedititiParla.opzione.id === "siediti-parla");

  const estranea = interpreta("scrivo una lettera a casa, penso alla mia famiglia", opzioni, SOGLIE);
  verifica("frase estranea -> nessuna_corrispondenza", estranea.tipo === "nessuna_corrispondenza");
}

console.log("\n--- moderna-provocazione.md ---");
{
  const opzioni = caricaLibreria("moderna-provocazione.md");
  verifica("la libreria ha le 2 opzioni attese", opzioni.length === 2);
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["rispondi-fermezza", "0"], ["ignora-calma", "1"]])
  );

  const rispondiFermezza = interpreta("rispondiamo con fermezza, mostrando autorità", opzioni, SOGLIE);
  verifica("rispondi-fermezza: frase chiara -> automatica", rispondiFermezza.tipo === "automatica" && rispondiFermezza.opzione.id === "rispondi-fermezza");

  const ignoraCalma = interpreta("ignoriamo la provocazione e restiamo calmi", opzioni, SOGLIE);
  verifica("ignora-calma: frase chiara -> automatica", ignoraCalma.tipo === "automatica" && ignoraCalma.opzione.id === "ignora-calma");

  const estranea = interpreta("guardo le stelle stanotte", opzioni, SOGLIE);
  verifica("frase estranea -> nessuna_corrispondenza", estranea.tipo === "nessuna_corrispondenza");
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
