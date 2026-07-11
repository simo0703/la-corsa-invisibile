// Test locale: node test-narratore-1915-carso-piave.mjs
//
// Verifica il caricatore (narratore-corsa-invisibile-loader.js) e il
// contenuto vero per il Nodo Temporale "1915-carso-piave"
// (narratore-1915-carso-piave.md), non il motore generico (quello è testato
// a parte in test-narratore-simulato.mjs). Stesso schema di
// test-narratore-1848-milano.mjs, sul contenuto di questo nodo.
//
// Il testo del .md viene letto qui con fs.readFileSync: siamo in un test
// Node locale, non nel Worker su Cloudflare, quindi il filesystem è
// disponibile normalmente. narratore-1915-carso-piave.js (il file che il
// Worker userà davvero) importa lo stesso .md con la sintassi che Wrangler
// risolve in fase di build (vedi la regola [[rules]] in wrangler.toml) —
// per questo qui testiamo il caricatore direttamente sul testo letto da
// disco, invece di importare narratore-1915-carso-piave.js (che sotto Node
// puro non si può caricare: l'import di un .md non è JS valido per il suo
// resolver).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { componiNarrazione } from "./src/lib/narratore-simulato.js";
import { parseFrammenti, creaPool } from "./src/lib/narratore-corsa-invisibile-loader.js";

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
const percorsoMd = path.join(__dirname, "src", "lib", "narratore-1915-carso-piave.md");
const testoMarkdown = readFileSync(percorsoMd, "utf8");

console.log("--- caricamento dal file: parseFrammenti ---");
const frammenti = parseFrammenti(testoMarkdown);
verifica("il file produce i tre slot apertura/sviluppo/eco", Object.keys(frammenti).sort().join(",") === "apertura,eco,sviluppo");
verifica("slot apertura: 6 baseline per esito + 4 per ruolo = 10 frammenti", frammenti.apertura.length === 10);
verifica("slot sviluppo: 6 baseline per esito + 5 per competenza = 11 frammenti", frammenti.sviluppo.length === 11);
verifica("slot eco: 3 baseline per esito + 5 per fascia di margine (2 per \"critico\") = 8 frammenti", frammenti.eco.length === 8);

const apertura1 = frammenti.apertura.find((f) => f.id === "apertura-pieno-1");
verifica(
  "il frammento apertura-pieno-1 ha condizione esito=pieno e il testo atteso",
  apertura1 &&
    JSON.stringify(apertura1.condizione) === JSON.stringify({ esito: "pieno" }) &&
    apertura1.testo === "Non c'è un attimo di esitazione: il corpo si muove prima che la testa finisca di decidere."
);

const aperturaRuolo = frammenti.apertura.find((f) => f.id === "apertura-ruolo-esploratore");
verifica(
  "il frammento apertura-ruolo-esploratore ha condizione ruoloId=esploratore e il placeholder {ruolo}",
  aperturaRuolo &&
    JSON.stringify(aperturaRuolo.condizione) === JSON.stringify({ ruoloId: "esploratore" }) &&
    aperturaRuolo.testo.includes("{ruolo}")
);

const ecoMargine = frammenti.eco.find((f) => f.id === "eco-margine-critico");
verifica(
  "il frammento eco-margine-critico ha condizione fasciaMargine=critico",
  ecoMargine && JSON.stringify(ecoMargine.condizione) === JSON.stringify({ fasciaMargine: "critico" })
);

console.log("\n--- creaPool: il pool costruito dal caricatore rispetta il contratto del Cronista ---");
const pool = creaPool(testoMarkdown);
verifica("creaPool restituisce un oggetto con ottieniFrammenti", typeof pool.ottieniFrammenti === "function");

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

console.log("\n--- copertura minima: ogni esito da solo produce sempre testo ---");
for (const esito of ["pieno", "parziale", "fallimento"]) {
  const { testo } = componiNarrazione(pool, contesto({ esito, variabili: {} }));
  verifica(`esito "${esito}" senza ruolo/competenza produce un testo non vuoto`, typeof testo === "string" && testo.length > 0);
}

console.log("\n--- copertura incrociata: esito x ruolo x competenza non lancia mai errori ---");
const esiti = ["pieno", "parziale", "fallimento"];
const ruoli = [null, "esploratore", "fanfara", "custode", "incursore"];
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
const candidatiEsploratore = pool.ottieniFrammenti("apertura", contesto({ ruoloId: "esploratore" }));
verifica(
  "un ruolo noto aggiunge il proprio frammento di apertura ai candidati",
  candidatiEsploratore.some((f) => f.id === "apertura-ruolo-esploratore")
);
verifica(
  "i frammenti baseline per esito restano candidati anche con un ruolo noto",
  candidatiEsploratore.some((f) => f.id === "apertura-pieno-1")
);

console.log("\n--- asse competenza (slot sviluppo) ---");
const candidatiCadenza = pool.ottieniFrammenti("sviluppo", contesto({ competenzaId: "cadenza", esito: "pieno" }));
verifica(
  "una competenza nota aggiunge il proprio frammento di sviluppo ai candidati",
  candidatiCadenza.some((f) => f.id === "sviluppo-competenza-cadenza")
);
verifica(
  "i frammenti baseline per esito restano candidati anche con una competenza nota",
  candidatiCadenza.some((f) => f.id === "sviluppo-pieno-1")
);

console.log("\n--- asse fascia di margine (slot eco) ---");
for (const [fasciaMargine, idAtteso] of [
  ["basso", "eco-margine-basso"],
  ["medio", "eco-margine-medio"],
  ["alto", "eco-margine-alto"],
  ["critico", "eco-margine-critico"],
]) {
  const candidati = pool.ottieniFrammenti("eco", contesto({ fasciaMargine, esito: "pieno" }));
  verifica(
    `fasciaMargine "${fasciaMargine}" aggiunge "${idAtteso}" ai candidati dell'eco`,
    candidati.some((f) => f.id === idAtteso)
  );
  verifica(
    `fasciaMargine "${fasciaMargine}" non esclude il baseline dell'esito dall'eco`,
    candidati.some((f) => f.id === "eco-pieno-1")
  );
}

console.log("\n--- varietà dei frammenti eco per fasciaMargine critico ---");
{
  // Due frammenti condizionati su fasciaMargine "critico" (più il
  // baseline per esito): su molti tentativi la composizione deve variare.
  const candidatiCritico = pool.ottieniFrammenti("eco", contesto({ fasciaMargine: "critico", esito: "pieno" }));
  verifica(
    "sono candidati entrambi i frammenti scritti per \"critico\"",
    ["eco-margine-critico", "eco-margine-critico-2"].every((id) =>
      candidatiCritico.some((f) => f.id === id)
    )
  );

  const testiVisti = new Set();
  for (let i = 0; i < 60; i++) {
    const { testo } = componiNarrazione(pool, contesto({ esito: "pieno", fasciaMargine: "critico" }));
    testiVisti.add(testo);
  }
  verifica(
    "su 60 tentativi con margine critico, il testo composto varia (più di un risultato distinto)",
    testiVisti.size > 1
  );
}

console.log("\n--- placeholder {ruolo} risolto quando presente in variabili ---");
let placeholderSempreRisolto = true;
for (let i = 0; i < 50; i++) {
  const { testo } = componiNarrazione(
    pool,
    contesto({ ruoloId: "fanfara", variabili: { ruolo: "La Fanfara" } })
  );
  if (testo.includes("{ruolo}")) placeholderSempreRisolto = false;
}
verifica("su 50 tentativi, {ruolo} non resta mai non sostituito quando la variabile è fornita", placeholderSempreRisolto);

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
