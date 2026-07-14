// Test locale: node test-interprete-libero-1836-torino.mjs
//
// Verifica le librerie reali del testo libero per i quattro momenti del nodo
// 1836-torino che aprono una scelta (ordine-che-non-arriva, decisione-presa-prima,
// quando-nessuno-guarda, fiato-corto): ogni frase campione viene valutata
// contro la SUA libreria, esattamente come fa il motore in partita
// (GameSession.js sceglie la libreria dal richiestaId attivo tramite
// trovaLibreriaPerRichiesta, poi chiama interpreta() con le stesse soglie).
// Stesso approccio degli altri test-interprete-libero-<nodo>.mjs.
//
// NOTA su "lo tiro su" (momento fiato-corto): l'esito atteso e' MANUALE, non
// automatico -- decisione presa in chat. "lo tiro su" (3 token, "lo"/"su"
// stopword) porta solo "tiro" al punteggio: 1/3 = 0.333 < 0.6, quindi va al
// comandante. Non e' un bug: pesare "tiro" per farla passare farebbe scattare
// in automatico anche "tiro dritto"/"tiro avanti" (proseguire, senso opposto),
// vedi la diagnosi dei Prompt 15-16. La frase resta manuale di proposito.

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
  const percorso = path.join(__dirname, "src", "lib", "interprete-libero", "1836-torino", nomeFile);
  return analizzaLibreria(readFileSync(percorso, "utf8"));
}

// Stesse soglie di GameSession.js (SOGLIA_ALTA_PROVVISORIA /
// MARGINE_DISTACCO_PROVVISORIO): stesso comportamento del gioco vero.
const SOGLIE = { sogliaAlta: 0.6, margineDistacco: 0.15 };

console.log("--- ordine-che-non-arriva.md ---");
{
  const opzioni = caricaLibreria("ordine-che-non-arriva.md");
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["muoversi-subito", "0"], ["aspettare-e-vedere", "1"], ["chiedere-ordini", "2"]])
  );
  const dec = interpreta("me ne frego e parto", opzioni, SOGLIE);
  verifica(
    "\"me ne frego e parto\" -> automatica su muoversi-subito (idx 0)",
    dec.tipo === "automatica" && dec.opzione.id === "muoversi-subito" && dec.opzione.effetto.risposteIndice === "0"
  );
}

console.log("\n--- decisione-presa-prima.md ---");
{
  const opzioni = caricaLibreria("decisione-presa-prima.md");
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["decidere-prima", "0"], ["fermarsi-e-mirare", "1"]])
  );
  const dec = interpreta("sparo senza fermarmi", opzioni, SOGLIE);
  verifica(
    "\"sparo senza fermarmi\" -> automatica su decidere-prima (idx 0)",
    dec.tipo === "automatica" && dec.opzione.id === "decidere-prima" && dec.opzione.effetto.risposteIndice === "0"
  );
}

console.log("\n--- quando-nessuno-guarda.md ---");
{
  const opzioni = caricaLibreria("quando-nessuno-guarda.md");
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["tenere-il-passo", "0"], ["rallentare-di-nascosto", "1"]])
  );
  const dec = interpreta("tanto non guarda nessuno", opzioni, SOGLIE);
  verifica(
    "\"tanto non guarda nessuno\" -> automatica su rallentare-di-nascosto (idx 1)",
    dec.tipo === "automatica" && dec.opzione.id === "rallentare-di-nascosto" && dec.opzione.effetto.risposteIndice === "1"
  );
}

console.log("\n--- fiato-corto.md ---");
{
  const opzioni = caricaLibreria("fiato-corto.md");
  verifica(
    "gli id sono quelli attesi, con risposteIndice coerente",
    JSON.stringify(opzioni.map((o) => [o.id, o.effetto.risposteIndice])) ===
      JSON.stringify([["raccogliere-il-compagno", "0"], ["andare-avanti", "1"]])
  );
  const dec = interpreta("lo tiro su", opzioni, SOGLIE);
  // Esito atteso: MANUALE (vedi nota in cima al file). NON deve essere automatica.
  verifica("\"lo tiro su\" -> NON automatica (resta manuale, va al comandante)", dec.tipo !== "automatica");
  verifica("\"lo tiro su\" -> manuale", dec.tipo === "manuale");
  verifica(
    "\"lo tiro su\": tra i candidati manuali c'e' raccogliere-il-compagno (idx 0)",
    dec.tipo === "manuale" &&
      dec.candidati.some((c) => c.opzione.id === "raccogliere-il-compagno" && c.opzione.effetto.risposteIndice === "0")
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
