// Test locale: node test-risoluzione.mjs

import { creaCompetenzeIniziali, risolviAzione, tiraDado } from "./src/lib/risoluzione.js";

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
verifica("l'Esploratore parte con Precisione a 2 (secondaria)", esploratore.precisione === 2);
verifica("l'Esploratore ha tutte le 5 competenze", Object.keys(esploratore).length === 5);

const incursoreConcentrato = creaCompetenzeIniziali("incursore", { precisione: 2, ancoraggio: 1 });
verifica(
  "l'Incursore con extra su Precisione arriva a 5 (3 + 2, principale)",
  incursoreConcentrato.precisione === 5
);
verifica(
  "l'Incursore con extra su Ancoraggio arriva a 3 (2 + 1, secondaria)",
  incursoreConcentrato.ancoraggio === 3
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

console.log("\n--- Risoluzione con 1d6 (il dado di tutti): confini del range e comparsa dei tier ---");

// tiraDado(facce) rispetta il numero di facce passato, senza toccare il
// default globale (usato da tutti gli altri ruoli/competenze).
{
  let semprePari = true;
  let vistoEstremoBasso = false;
  let vistoEstremoAlto = false;
  for (let i = 0; i < 200; i++) {
    const dado = tiraDado(6);
    if (dado < 1 || dado > 6) semprePari = false;
    if (dado === 1) vistoEstremoBasso = true;
    if (dado === 6) vistoEstremoAlto = true;
  }
  verifica("tiraDado(6) resta sempre nel range 1-6 su 200 tentativi", semprePari);
  verifica("tiraDado(6) su 200 tentativi tocca anche gli estremi 1 e 6", vistoEstremoBasso && vistoEstremoAlto);
}

// Confini esatti forzando il dado: un punteggio 3 (una competenza principale)
// con 1d6 va da 4 (dado 1) a 9 (dado 6) -- il range "normale" di un tiro sulla
// propria principale, uguale per qualunque ruolo (il d6 è di tutti).
{
  const min = risolviAzione(3, 1, 6);
  const max = risolviAzione(3, 6, 6);
  verifica("principale 3 + 1d6: minimo del range è 4", min.totale === 4);
  verifica("principale 3 + 1d6: massimo del range è 9", max.totale === 9);
  verifica("il minimo (4) è sotto la soglia parziale (5): fallimento", min.esito === "fallimento");
  verifica("il massimo (9) supera la soglia piena (8): pieno", max.esito === "pieno");
}

// Con un bonus di +1 (bonusContesto o bonus di grado) il punteggio effettivo
// di una competenza principale passa da 3 a 4: il range si sposta a 5-10.
{
  const min = risolviAzione(4, 1, 6);
  const max = risolviAzione(4, 6, 6);
  verifica("principale 3 + bonus 1 + 1d6: minimo del range è 5", min.totale === 5);
  verifica("principale 3 + bonus 1 + 1d6: massimo del range è 10", max.totale === 10);
  verifica("con il bonus, il minimo (5) raggiunge già la soglia parziale: mai fallimento", min.esito !== "fallimento");
}

// Su molti tentativi con un punteggio 3 (una competenza principale) e il
// dado 1d6 -- ora il dado di tutti -- il tier "pieno" deve comparire: era
// impossibile col vecchio 1d4, dove 3+4=7 restava sotto la soglia di 8.
{
  const tierVisti = new Set();
  for (let i = 0; i < 100; i++) {
    tierVisti.add(risolviAzione(3, null, 6).esito);
  }
  verifica(
    "su 100 tentativi con punteggio 3 e dado 1d6 compare almeno una volta il tier \"pieno\"",
    tierVisti.has("pieno")
  );
}

// risolviAzione senza terzo argomento usa il dado di default configurato in
// GAME_CONFIG.risoluzione.dadoFacce, ora 1d6 per tutti (ribilanciamento).
{
  let sempreNelRange = true;
  for (let i = 0; i < 100; i++) {
    const r = risolviAzione(3);
    if (r.totale < 4 || r.totale > 9) sempreNelRange = false;
  }
  verifica("senza facce esplicite, risolviAzione(3) resta nel range 4-9 (dado di default 1d6)", sempreNelRange);
}

console.log(`\n${falliti === 0 ? "TUTTI I TEST PASSATI" : `${falliti} TEST FALLITI`}`);
process.exit(falliti === 0 ? 0 : 1);
