// Test locale: node test-interprete-libero-emergenza-civile.mjs
//
// Verifica le librerie reali del testo libero per il nodo emergenza-civile
// (emergenza-scelta, emergenza-famiglia): si caricano correttamente e, per
// ciascuna delle 4 opzioni totali, una frase chiara scelta a mano produce
// un match automatico su quella e solo quella opzione — stesso approccio
// già usato per la libreria di prova in test-interprete-libero.mjs, e per
// il contenuto reale del nodo 1915-carso-piave in
// test-interprete-libero-1915-carso-piave.mjs.

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
  const percorso = path.join(__dirname, "src", "lib", "interprete-libero", "emergenza-civile", nomeFile);
  return analizzaLibreria(readFileSync(percorso, "utf8"));
}

// Soglie usate anche in GameSession.js (SOGLIA_ALTA_PROVVISORIA /
// MARGINE_DISTACCO_PROVVISORIO): stesse qui, per verificare lo stesso
// comportamento che avrà davvero il gioco.
const SOGLIE = { sogliaAlta: 0.6, margineDistacco: 0.15 };

console.log("--- emergenza-scelta.md ---");
{
  const opzioni = caricaLibreria("emergenza-scelta.md");
  verifica("la libreria ha le 2 opzioni attese", opzioni.length === 2);
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["piu-persone", "0"], ["piu-vicino", "1"]])
  );

  const piuPersone = interpreta("andiamo dove ci sono più persone, anche se è più lontano", opzioni, SOGLIE);
  verifica("piu-persone: frase chiara -> automatica", piuPersone.tipo === "automatica" && piuPersone.opzione.id === "piu-persone");

  const piuVicino = interpreta("andiamo dove arriviamo subito, anche se sono pochi", opzioni, SOGLIE);
  verifica("piu-vicino: frase chiara -> automatica", piuVicino.tipo === "automatica" && piuVicino.opzione.id === "piu-vicino");

  const estranea = interpreta("scrivo una lettera a casa, penso alla mia famiglia", opzioni, SOGLIE);
  verifica("frase estranea -> nessuna_corrispondenza", estranea.tipo === "nessuna_corrispondenza");
}

console.log("\n--- emergenza-famiglia.md ---");
{
  const opzioni = caricaLibreria("emergenza-famiglia.md");
  verifica("la libreria ha le 2 opzioni attese", opzioni.length === 2);
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["insisti-fermezza", "0"], ["parla-fiducia", "1"]])
  );

  const insisti = interpreta("insistiamo con fermezza, li portiamo via se serve", opzioni, SOGLIE);
  verifica("insisti-fermezza: frase chiara -> automatica", insisti.tipo === "automatica" && insisti.opzione.id === "insisti-fermezza");

  const parla = interpreta("restiamo a parlare, guadagniamo la loro fiducia", opzioni, SOGLIE);
  verifica("parla-fiducia: frase chiara -> automatica", parla.tipo === "automatica" && parla.opzione.id === "parla-fiducia");

  const estranea = interpreta("guardo le stelle stanotte", opzioni, SOGLIE);
  verifica("frase estranea -> nessuna_corrispondenza", estranea.tipo === "nessuna_corrispondenza");
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
