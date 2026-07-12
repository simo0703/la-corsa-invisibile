// Test locale: node test-narratore-1848-milano.mjs
//
// Verifica il caricatore (narratore-corsa-invisibile-loader.js) e il
// contenuto vero per il Nodo Temporale "1848-milano"
// (narratore-1848-milano.md), non il motore generico (quello è testato a
// parte in test-narratore-simulato.mjs). Stesso schema di
// test-narratore-corsa-invisibile.mjs, sul contenuto di questo nodo.
//
// Il testo del .md viene letto qui con fs.readFileSync: siamo in un test
// Node locale, non nel Worker su Cloudflare, quindi il filesystem è
// disponibile normalmente. narratore-1848-milano.js (il file che il Worker
// userà davvero) importa lo stesso .md con la sintassi che Wrangler
// risolve in fase di build (vedi la regola [[rules]] in wrangler.toml) —
// per questo qui testiamo il caricatore direttamente sul testo letto da
// disco, invece di importare narratore-1848-milano.js (che sotto Node puro
// non si può caricare: l'import di un .md non è JS valido per il suo
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
const percorsoMd = path.join(__dirname, "src", "lib", "narratore-1848-milano.md");
const testoMarkdown = readFileSync(percorsoMd, "utf8");

console.log("--- caricamento dal file: parseFrammenti ---");
const frammenti = parseFrammenti(testoMarkdown);
verifica("il file produce i tre slot apertura/sviluppo/eco", Object.keys(frammenti).sort().join(",") === "apertura,eco,sviluppo");
verifica(
  "slot apertura: 6 baseline per esito + 4 per ruolo + 6 per competenza=precisione/esito (disarmo) = 16 frammenti",
  frammenti.apertura.length === 16
);
verifica(
  "slot sviluppo: 6 baseline per esito + 5 per competenza + 3 per competenza=precisione/esito (disarmo) = 14 frammenti",
  frammenti.sviluppo.length === 14
);
verifica(
  "slot eco: 3 baseline per esito + 5 per fascia di margine (2 per \"critico\") + 6 per competenza=precisione/esito (disarmo) = 14 frammenti",
  frammenti.eco.length === 14
);

const apertura1 = frammenti.apertura.find((f) => f.id === "apertura-pieno-1");
verifica(
  "il frammento apertura-pieno-1 ha condizione esito=pieno e il testo atteso",
  apertura1 &&
    JSON.stringify(apertura1.condizione) === JSON.stringify({ esito: "pieno" }) &&
    apertura1.testo === "Il varco si apre prima ancora che la polvere si depositi: la carica ha trovato il punto debole."
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

console.log("\n--- asse competenza=precisione + esito, in tutti e tre gli slot (disarmo, milano-ferito) ---");
{
  const attesiPerSlotEsito = {
    apertura: {
      pieno: ["apertura-precisione-pieno-1", "apertura-precisione-pieno-2"],
      parziale: ["apertura-precisione-parziale-1", "apertura-precisione-parziale-2"],
      fallimento: ["apertura-precisione-fallimento-1", "apertura-precisione-fallimento-2"],
    },
    sviluppo: {
      pieno: ["sviluppo-precisione-pieno-1"],
      parziale: ["sviluppo-precisione-parziale-1"],
      fallimento: ["sviluppo-precisione-fallimento-1"],
    },
    eco: {
      pieno: ["eco-precisione-pieno-1", "eco-precisione-pieno-2"],
      parziale: ["eco-precisione-parziale-1", "eco-precisione-parziale-2"],
      fallimento: ["eco-precisione-fallimento-1", "eco-precisione-fallimento-2"],
    },
  };
  const baselinePerSlot = { apertura: "apertura-pieno-1", sviluppo: "sviluppo-pieno-1", eco: "eco-pieno-1" };

  for (const [slot, perEsito] of Object.entries(attesiPerSlotEsito)) {
    for (const [esito, idsAttesi] of Object.entries(perEsito)) {
      const candidati = pool.ottieniFrammenti(slot, contesto({ esito, competenzaId: "precisione" }));
      verifica(
        `slot "${slot}", esito "${esito}": tutti i frammenti di disarmo scritti per questa combinazione sono candidati`,
        idsAttesi.every((id) => candidati.some((f) => f.id === id))
      );
    }
  }

  // Mescolamento accettato per decisione esplicita (Opzione 2, non Opzione 3
  // con asse "scena"/richiestaId): i baseline scritti per la barricata
  // restano candidati anche quando il tiro è sul disarmo. Lo documentiamo
  // qui come comportamento noto, non come regressione.
  for (const slot of Object.keys(baselinePerSlot)) {
    const candidati = pool.ottieniFrammenti(slot, contesto({ esito: "pieno", competenzaId: "precisione" }));
    verifica(
      `slot "${slot}": il baseline della barricata resta candidato anche con competenzaId=precisione ` +
        "(mescolamento noto e accettato, vedi DECISIONI_LA_CORSA_INVISIBILE.md)",
      candidati.some((f) => f.id === baselinePerSlot[slot])
    );
  }

  // Verifica dal vivo (non solo sui candidati): su molti tentativi, il testo
  // composto per il tiro di Precisione deve includere almeno una volta un
  // frammento scritto per il disarmo in ciascuno slot -- non solo essere
  // candidato in teoria.
  for (const esito of ["pieno", "parziale", "fallimento"]) {
    const testiPrecisioneAttesi = [
      ...attesiPerSlotEsito.apertura[esito],
      ...attesiPerSlotEsito.sviluppo[esito],
      ...attesiPerSlotEsito.eco[esito],
    ]
      .map((id) => [...frammenti.apertura, ...frammenti.sviluppo, ...frammenti.eco].find((f) => f.id === id).testo);

    let comparsoAlmenoUnaVolta = false;
    for (let i = 0; i < 100; i++) {
      const { testo } = componiNarrazione(pool, contesto({ esito, competenzaId: "precisione", variabili: {} }));
      if (testiPrecisioneAttesi.some((t) => testo.includes(t))) {
        comparsoAlmenoUnaVolta = true;
        break;
      }
    }
    verifica(
      `esito "${esito}", competenzaId=precisione: su 100 tentativi compare almeno una volta un frammento di disarmo nel testo composto`,
      comparsoAlmenoUnaVolta
    );
  }
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
