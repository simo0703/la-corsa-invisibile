// Test locale: node test-interprete-libero-1915-carso-piave.mjs
//
// Verifica le librerie reali del testo libero per il nodo 1915-carso-piave
// (carso-attesa, carso-bombardamento): si caricano correttamente e, per
// ciascuna delle 4 opzioni totali, una frase chiara scelta a mano produce
// un match automatico su quella e solo quella opzione — stesso approccio
// già usato per la libreria di prova in test-interprete-libero.mjs, e per
// il contenuto reale del nodo 1848-milano in
// test-interprete-libero-1848-milano.mjs.

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
  const percorso = path.join(__dirname, "src", "lib", "interprete-libero", "1915-carso-piave", nomeFile);
  return analizzaLibreria(readFileSync(percorso, "utf8"));
}

// Soglie usate anche in GameSession.js (SOGLIA_ALTA_PROVVISORIA /
// MARGINE_DISTACCO_PROVVISORIO): stesse qui, per verificare lo stesso
// comportamento che avrà davvero il gioco.
const SOGLIE = { sogliaAlta: 0.6, margineDistacco: 0.15 };

console.log("--- carso-attesa.md ---");
{
  const opzioni = caricaLibreria("carso-attesa.md");
  verifica("la libreria ha le 2 opzioni attese", opzioni.length === 2);
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["muovi-subito", "0"], ["aspetta-alba", "1"]])
  );

  const muoviSubito = interpreta("muoviamoci subito, non possiamo aspettare il gelo", opzioni, SOGLIE);
  verifica("muovi-subito: frase chiara -> automatica", muoviSubito.tipo === "automatica" && muoviSubito.opzione.id === "muovi-subito");

  const aspettaAlba = interpreta("aspettiamo l'alba, restiamo uniti al caldo", opzioni, SOGLIE);
  verifica("aspetta-alba: frase chiara -> automatica", aspettaAlba.tipo === "automatica" && aspettaAlba.opzione.id === "aspetta-alba");

  const estranea = interpreta("scrivo una lettera a casa, penso alla mia famiglia", opzioni, SOGLIE);
  verifica("frase estranea -> nessuna_corrispondenza", estranea.tipo === "nessuna_corrispondenza");
}

console.log("\n--- carso-bombardamento.md ---");
{
  const opzioni = caricaLibreria("carso-bombardamento.md");
  verifica("la libreria ha le 2 opzioni attese", opzioni.length === 2);
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["recupera-sotto-fuoco", "0"], ["aspetta-pausa", "1"]])
  );

  const recupera = interpreta("usciamo a prenderlo, non lo lasciamo lì sotto le granate", opzioni, SOGLIE);
  verifica("recupera-sotto-fuoco: frase chiara -> automatica", recupera.tipo === "automatica" && recupera.opzione.id === "recupera-sotto-fuoco");

  const aspettaPausa = interpreta("aspettiamo che il fuoco si fermi un attimo", opzioni, SOGLIE);
  verifica("aspetta-pausa: frase chiara -> automatica", aspettaPausa.tipo === "automatica" && aspettaPausa.opzione.id === "aspetta-pausa");

  const estranea = interpreta("guardo il cielo, sembra che pioverà", opzioni, SOGLIE);
  verifica("frase estranea -> nessuna_corrispondenza", estranea.tipo === "nessuna_corrispondenza");
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
