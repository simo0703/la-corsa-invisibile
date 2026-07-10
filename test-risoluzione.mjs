// Test locale: node test-risoluzione.mjs

import { creaCompetenzeIniziali, risolviAzione } from "./src/lib/risoluzione.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

console.log("--- Creazione competenze ---");

const esploratore = creaCompetenzeIniziali("esploratore");
verifica("l'Esploratore parte con Cadenza a 3 (principale)", esploratore.cadenza === 3);
verifica("l'Esploratore parte con Precisione a 1 (secondaria)", esploratore.precisione === 1);
verifica("l'Esploratore ha tutte le 5 competenze", Object.keys(esploratore).length === 5);

const incursoreConcentrato = creaCompetenzeIniziali("incursore", { precisione: 2, ancoraggio: 1 });
verifica(
  "l'Incursore con extra su Precisione arriva a 5 (3 + 2, principale)",
  incursoreConcentrato.precisione === 5
);
verifica(
  "l'Incursore con extra su Ancoraggio arriva a 2 (1 + 1, secondaria)",
  incursoreConcentrato.ancoraggio === 2
);

let erroreCatturato = false;
try {
  creaCompetenzeIniziali("custode", { spiritoDiCorpo: 5 }); // supera puntiExtra (3)
} catch (e) {
  erroreCatturato = true;
}
verifica("assegnare più punti extra del consentito genera un errore", erroreCatturato);

let erroreMassimo = false;
const custodeAlTetto = creaCompetenzeIniziali("custode", { spiritoDiCorpo: 3 });
verifica(
  "il valore massimo (5) non si supera anche sommando principale + extra pieno",
  custodeAlTetto.spiritoDiCorpo === 5 // 3 (principale) + 3 (extra) = 6, tetto a 5
);

console.log("\n--- Risoluzione di un'azione ---");

const rFallimento = risolviAzione(1, 1); // competenza minima + dado minimo = 2
verifica("competenza 1 + dado 1 = totale 2, fallimento", rFallimento.totale === 2 && rFallimento.esito === "fallimento");

const rParziale = risolviAzione(3, 2); // principale base + dado medio = 5
verifica("competenza 3 + dado 2 = totale 5, successo parziale", rParziale.totale === 5 && rParziale.esito === "parziale");

const rPieno = risolviAzione(5, 4); // competenza al tetto + dado massimo = 9
verifica("competenza 5 + dado 4 = totale 9, successo pieno", rPieno.totale === 9 && rPieno.esito === "pieno");

// Verifica che il dado da solo non possa mai ribaltare un netto svantaggio di competenza:
// competenza 1 col dado più alto (4) = 5, competenza 5 col dado più basso (1) = 6.
// La competenza alta vince comunque, anche con la peggior fortuna possibile.
const bassaFortunata = risolviAzione(1, 4);
const altaSfortunata = risolviAzione(5, 1);
verifica(
  "la competenza alta con il dado peggiore batte comunque la competenza bassa col dado migliore",
  altaSfortunata.totale > bassaFortunata.totale
);

console.log(`\n${falliti === 0 ? "TUTTI I TEST PASSATI" : `${falliti} TEST FALLITI`}`);
process.exit(falliti === 0 ? 0 : 1);
