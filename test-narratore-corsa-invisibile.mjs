// Test locale: node test-narratore-corsa-invisibile.mjs
//
// Verifica il pool di contenuto VERO per il Nodo Temporale "1836-torino"
// (src/lib/narratore-corsa-invisibile.js), non il motore generico (quello è
// testato a parte in test-narratore-simulato.mjs). Qui controlliamo che il
// pool rispetti il contratto del Cronista e che i tre assi di variazione
// decisi (esito, ruolo, competenza, più la fascia di margine per l'eco)
// funzionino davvero.

import { componiNarrazione } from "./src/lib/narratore-simulato.js";
import { ottieniFrammenti } from "./src/lib/narratore-corsa-invisibile.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

const pool = { ottieniFrammenti };

function contesto(extra = {}) {
  return {
    esito: "pieno",
    competenzaId: null,
    ruoloId: null,
    margine: { valore: 0, soglia: 5, delta: 0 },
    variabili: { ruolo: "L'Esploratore" },
    storicoFrammenti: [],
    ...extra,
  };
}

console.log("--- copertura minima: ogni esito da solo produce sempre testo ---");
for (const esito of ["pieno", "parziale", "fallimento"]) {
  const { testo } = componiNarrazione(pool, contesto({ esito, variabili: {} }));
  verifica(`esito "${esito}" senza ruolo/competenza produce un testo non vuoto`, typeof testo === "string" && testo.length > 0);
}

console.log("\n--- copertura incrociata: esito x ruolo x competenza non lancia mai errori ---");
const esiti = ["pieno", "parziale", "fallimento"];
const ruoli = [null, "esploratore", "fanfarista", "custode", "incursore"];
const competenze = [null, "cadenza", "precisione", "spiritoDiCorpo", "passoAvanti", "ancoraggio"];
let combinazioniOk = true;
for (const esito of esiti) {
  for (const ruoloId of ruoli) {
    for (const competenzaId of competenze) {
      try {
        componiNarrazione(pool, contesto({ esito, ruoloId, competenzaId }));
      } catch {
        combinazioniOk = false;
      }
    }
  }
}
verifica(
  `tutte le ${esiti.length * ruoli.length * competenze.length} combinazioni di esito/ruolo/competenza funzionano`,
  combinazioniOk
);

console.log("\n--- asse ruolo (slot apertura) ---");
const candidatiEsploratore = ottieniFrammenti("apertura", contesto({ ruoloId: "esploratore" }));
verifica(
  "un ruolo noto aggiunge il proprio frammento di apertura ai candidati",
  candidatiEsploratore.some((f) => f.id === "apertura-ruolo-esploratore")
);
verifica(
  "i frammenti baseline per esito restano candidati anche con un ruolo noto",
  candidatiEsploratore.some((f) => f.id === "apertura-pieno-1")
);
const candidatiSenzaRuolo = ottieniFrammenti("apertura", contesto({ ruoloId: null }));
verifica(
  "senza ruolo, il frammento specifico dell'esploratore non è tra i candidati",
  !candidatiSenzaRuolo.some((f) => f.id === "apertura-ruolo-esploratore")
);

console.log("\n--- asse competenza (slot sviluppo) ---");
const candidatiPrecisione = ottieniFrammenti("sviluppo", contesto({ competenzaId: "precisione", esito: "parziale" }));
verifica(
  "una competenza nota aggiunge il proprio frammento di sviluppo ai candidati",
  candidatiPrecisione.some((f) => f.id === "sviluppo-competenza-precisione")
);
verifica(
  "i frammenti baseline per esito restano candidati anche con una competenza nota",
  candidatiPrecisione.some((f) => f.id === "sviluppo-parziale-1")
);

console.log("\n--- asse fascia di margine (slot eco) ---");
for (const [fasciaMargine, idAtteso] of [
  ["basso", "eco-margine-basso"],
  ["medio", "eco-margine-medio"],
  ["alto", "eco-margine-alto"],
  ["critico", "eco-margine-critico"],
]) {
  const candidati = ottieniFrammenti("eco", contesto({ fasciaMargine, esito: "pieno" }));
  verifica(
    `fasciaMargine "${fasciaMargine}" aggiunge "${idAtteso}" ai candidati dell'eco`,
    candidati.some((f) => f.id === idAtteso)
  );
  verifica(
    `fasciaMargine "${fasciaMargine}" non esclude il baseline dell'esito dall'eco`,
    candidati.some((f) => f.id === "eco-pieno-1")
  );
}

console.log("\n--- placeholder {ruolo} risolto quando presente in variabili ---");
let placeholderSempreRisolto = true;
for (let i = 0; i < 50; i++) {
  const { testo } = componiNarrazione(
    pool,
    contesto({ ruoloId: "fanfarista", variabili: { ruolo: "Il Fanfarista" } })
  );
  if (testo.includes("{ruolo}")) placeholderSempreRisolto = false;
}
verifica("su 50 tentativi, {ruolo} non resta mai non sostituito quando la variabile è fornita", placeholderSempreRisolto);

console.log("\n--- slot sconosciuto ---");
try {
  ottieniFrammenti("slot-inesistente", contesto());
  verifica("uno slot sconosciuto lancia un errore chiaro", false);
} catch (e) {
  verifica("uno slot sconosciuto lancia un errore chiaro", e.message.includes("slot-inesistente"));
}

console.log("\n--- esito non valido senza ruolo/competenza: fallisce in modo chiaro, non in silenzio ---");
try {
  componiNarrazione(pool, contesto({ esito: "boh", variabili: {} }));
  verifica("un esito sconosciuto senza altri agganci lancia un errore chiaro", false);
} catch (e) {
  verifica(
    "un esito sconosciuto senza altri agganci lancia un errore chiaro",
    e.message.includes("apertura")
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
