// Test locale: node test-interprete-libero-1848-milano.mjs
//
// Verifica le librerie reali del testo libero per il nodo 1848-milano
// (milano-barricata, milano-ferito): si caricano correttamente e, per
// ciascuna delle 6 opzioni totali, una frase chiara scelta a mano produce
// un match automatico su quella e solo quella opzione — stesso approccio
// già usato per la libreria di prova in test-interprete-libero.mjs, ma
// sul contenuto reale del nodo.

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
  const percorso = path.join(__dirname, "src", "lib", "interprete-libero", "1848-milano", nomeFile);
  return analizzaLibreria(readFileSync(percorso, "utf8"));
}

// Soglie usate anche in GameSession.js (SOGLIA_ALTA_PROVVISORIA /
// MARGINE_DISTACCO_PROVVISORIO): stesse qui, per verificare lo stesso
// comportamento che avrà davvero il gioco.
const SOGLIE = { sogliaAlta: 0.6, margineDistacco: 0.15 };

console.log("--- milano-barricata.md ---");
{
  const opzioni = caricaLibreria("milano-barricata.md");
  verifica("la libreria ha le 3 opzioni attese", opzioni.length === 3);
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["carica-diretta", "0"], ["aggira-fianco", "1"], ["parla-barricata", "2"]])
  );

  const carica = interpreta("carico a testa bassa contro la barricata", opzioni, SOGLIE);
  verifica("carica-diretta: frase chiara -> automatica", carica.tipo === "automatica" && carica.opzione.id === "carica-diretta");

  const aggira = interpreta("vicoli, aggiro il fianco", opzioni, SOGLIE);
  verifica("aggira-fianco: frase chiara -> automatica", aggira.tipo === "automatica" && aggira.opzione.id === "aggira-fianco");

  const parla = interpreta("provo a parlare con chi è dietro la barricata", opzioni, SOGLIE);
  verifica("parla-barricata: frase chiara -> automatica", parla.tipo === "automatica" && parla.opzione.id === "parla-barricata");

  const estranea = interpreta("mi fermo a mangiare qualcosa", opzioni, SOGLIE);
  verifica("frase estranea -> nessuna_corrispondenza", estranea.tipo === "nessuna_corrispondenza");
}

console.log("\n--- milano-ferito.md ---");
{
  const opzioni = caricaLibreria("milano-ferito.md");
  verifica("la libreria ha le 3 opzioni attese", opzioni.length === 3);
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["soccorri-ferito", "0"], ["disarma-prosegui", "1"], ["interroga-ferito", "2"]])
  );

  const soccorri = interpreta("lo soccorro, non importa la divisa che porta", opzioni, SOGLIE);
  verifica("soccorri-ferito: frase chiara -> automatica", soccorri.tipo === "automatica" && soccorri.opzione.id === "soccorri-ferito");

  const disarma = interpreta("lo disarmo e proseguo senza fermarmi", opzioni, SOGLIE);
  verifica("disarma-prosegui: frase chiara -> automatica", disarma.tipo === "automatica" && disarma.opzione.id === "disarma-prosegui");

  const interroga = interpreta("mi fermo a interrogarlo prima di decidere", opzioni, SOGLIE);
  verifica("interroga-ferito: frase chiara -> automatica", interroga.tipo === "automatica" && interroga.opzione.id === "interroga-ferito");

  const estranea = interpreta("guardo il cielo, sembra che pioverà", opzioni, SOGLIE);
  verifica("frase estranea -> nessuna_corrispondenza", estranea.tipo === "nessuna_corrispondenza");
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
