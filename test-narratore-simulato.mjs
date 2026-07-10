// Test locale: node test-narratore-simulato.mjs
//
// Il pool qui sotto è FINTO, serve solo a verificare che il motore funzioni.
// Non è il pool vero di Corsa Invisibile (quello si scrive in un'altra
// sessione, come frammenti narrativi reali).

import {
  SLOT,
  fasciaMargine,
  scegliFrammento,
  componiNarrazione,
} from "./src/lib/narratore-simulato.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

console.log("--- fasciaMargine ---");
verifica("valore 0 su soglia 5 è basso", fasciaMargine(0, 5) === "basso");
verifica("valore 1 su soglia 5 è basso", fasciaMargine(1, 5) === "basso");
verifica("valore 2 su soglia 5 è medio", fasciaMargine(2, 5) === "medio");
verifica("valore 4 su soglia 5 è alto", fasciaMargine(4, 5) === "alto");
verifica("valore 5 su soglia 5 è critico", fasciaMargine(5, 5) === "critico");
verifica("valore 7 su soglia 5 è critico", fasciaMargine(7, 5) === "critico");
verifica("soglia 0 o assente non esplode, torna basso", fasciaMargine(3, 0) === "basso");

console.log("\n--- scegliFrammento ---");
// Rapporto di peso 5:1 e 300 tentativi: la probabilità che l'opzione più
// leggera non esca mai per puro caso è astronomicamente bassa (< 1 su 10^28),
// a differenza di un rapporto troppo estremo (es. 100:1) che con poche prove
// fallisce spesso per caso anche a motore funzionante correttamente.
const candidatiProva = [
  { id: "a", testo: "A", peso: 5 },
  { id: "b", testo: "B", peso: 1 },
];
const scelte = new Set();
for (let i = 0; i < 300; i++) scelte.add(scegliFrammento(candidatiProva).id);
verifica("con pesi diversi, escono entrambi su 300 tentativi", scelte.size === 2);

const soloUno = [{ id: "unico", testo: "U" }];
verifica(
  "se l'unico candidato è anche nello storico recente, viene scelto comunque (rete di sicurezza)",
  scegliFrammento(soloUno, ["unico"]).id === "unico"
);

const dueCandidati = [
  { id: "x", testo: "X" },
  { id: "y", testo: "Y" },
];
let escluso = true;
for (let i = 0; i < 20; i++) {
  if (scegliFrammento(dueCandidati, ["x"]).id === "x") escluso = false;
}
verifica("con più candidati disponibili, quello nello storico recente viene evitato", escluso);

try {
  scegliFrammento([]);
  verifica("un pool vuoto lancia un errore", false);
} catch {
  verifica("un pool vuoto lancia un errore", true);
}

console.log("\n--- componiNarrazione: pool minimo, un solo frammento per slot ---");
const poolMinimo = {
  ottieniFrammenti(slot) {
    return [{ id: `${slot}-1`, testo: `[${slot}]` }];
  },
};
const risultatoMinimo = componiNarrazione(poolMinimo, {
  esito: "pieno",
  competenzaId: "prova",
  ruoloId: "prova",
  margine: { valore: 0, soglia: 5, delta: 0 },
  variabili: {},
  storicoFrammenti: [],
});
verifica(
  "concatena i tre slot nell'ordine apertura-sviluppo-eco con spazio di default",
  risultatoMinimo.testo === "[apertura] [sviluppo] [eco]"
);
verifica(
  "restituisce gli id dei frammenti usati, nell'ordine degli slot",
  JSON.stringify(risultatoMinimo.frammentiUsati) ===
    JSON.stringify(["apertura-1", "sviluppo-1", "eco-1"])
);

console.log("\n--- componiNarrazione: placeholder nei frammenti-stringa ---");
const poolConPlaceholder = {
  ottieniFrammenti(slot) {
    if (slot === "apertura") return [{ id: "a1", testo: "{ruolo} agisce." }];
    if (slot === "sviluppo") return [{ id: "s1", testo: "Il {nodo} risponde." }];
    return [{ id: "e1", testo: "Manca {inesistente}." }];
  },
};
const risultatoPlaceholder = componiNarrazione(poolConPlaceholder, {
  esito: "parziale",
  competenzaId: null,
  ruoloId: "esploratore",
  margine: { valore: 2, soglia: 5, delta: 1 },
  variabili: { ruolo: "L'Esploratore", nodo: "Nodo di Prova" },
  storicoFrammenti: [],
});
verifica(
  "sostituisce i placeholder noti con le variabili del contesto",
  risultatoPlaceholder.testo.includes("L'Esploratore agisce.") &&
    risultatoPlaceholder.testo.includes("Il Nodo di Prova risponde.")
);
verifica(
  "un placeholder senza variabile corrispondente resta visibile (non sparisce in silenzio)",
  risultatoPlaceholder.testo.includes("{inesistente}")
);

console.log("\n--- componiNarrazione: frammento programmatico (funzione invece di stringa) ---");
const poolProgrammatico = {
  ottieniFrammenti(slot, contesto) {
    if (slot === "apertura") return [{ id: "a1", testo: "Apertura fissa." }];
    if (slot === "sviluppo") {
      return [
        {
          id: "s-prog",
          testo: (ctx) =>
            `Sviluppo calcolato: esito ${ctx.esito}, margine in fascia ${ctx.fasciaMargine}.`,
        },
      ];
    }
    return [{ id: "e1", testo: "Eco fissa." }];
  },
};
const risultatoProgrammatico = componiNarrazione(poolProgrammatico, {
  esito: "fallimento",
  competenzaId: "precisione",
  ruoloId: "incursore",
  margine: { valore: 5, soglia: 5, delta: 2 },
  variabili: {},
  storicoFrammenti: [],
});
verifica(
  "il motore passa il contesto (incluso fasciaMargine calcolato) a un frammento-funzione",
  risultatoProgrammatico.testo.includes("esito fallimento, margine in fascia critico")
);

console.log("\n--- componiNarrazione: connettivo personalizzato del pool ---");
const poolConConnettivo = {
  ottieniFrammenti(slot) {
    return [{ id: `${slot}-1`, testo: slot.toUpperCase() }];
  },
  connettivo(precedente, successivo) {
    return ` >>${precedente}->${successivo}>> `;
  },
};
const risultatoConnettivo = componiNarrazione(poolConConnettivo, {
  esito: "pieno",
  margine: { valore: 0, soglia: 5, delta: 0 },
  variabili: {},
  storicoFrammenti: [],
});
verifica(
  "usa il connettivo del pool invece dello spazio di default, quando fornito",
  risultatoConnettivo.testo === "APERTURA >>apertura->sviluppo>> SVILUPPO >>sviluppo->eco>> ECO"
);

console.log("\n--- componiNarrazione: pool che non rispetta il contratto ---");
const poolSenzaOttieni = {};
try {
  componiNarrazione(poolSenzaOttieni, { margine: null, variabili: {}, storicoFrammenti: [] });
  verifica("un pool senza ottieniFrammenti lancia un errore chiaro", false);
} catch (e) {
  verifica("un pool senza ottieniFrammenti lancia un errore chiaro", e.message.includes("ottieniFrammenti"));
}

const poolCheRestituisceVuoto = {
  ottieniFrammenti() {
    return [];
  },
};
try {
  componiNarrazione(poolCheRestituisceVuoto, { margine: null, variabili: {}, storicoFrammenti: [] });
  verifica("un pool che restituisce zero candidati per uno slot lancia un errore chiaro", false);
} catch (e) {
  verifica(
    "un pool che restituisce zero candidati per uno slot lancia un errore chiaro",
    e.message.includes("apertura")
  );
}

console.log("\n--- SLOT esportato ---");
verifica(
  "SLOT è la sequenza apertura, sviluppo, eco, in quest'ordine",
  JSON.stringify(SLOT) === JSON.stringify(["apertura", "sviluppo", "eco"])
);

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
