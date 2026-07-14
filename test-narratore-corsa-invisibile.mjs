// Test locale: node test-narratore-corsa-invisibile.mjs
//
// Verifica il caricatore (narratore-corsa-invisibile-loader.js) e il
// contenuto vero per il Nodo Temporale "1836-torino"
// (narratore-corsa-invisibile.md), non il motore generico (quello è testato
// a parte in test-narratore-simulato.mjs).
//
// Il testo del .md viene letto qui con fs.readFileSync: siamo in un test
// Node locale, non nel Worker su Cloudflare, quindi il filesystem è
// disponibile normalmente. narratore-corsa-invisibile.js (il file che il
// Worker userà davvero) importa lo stesso .md con la sintassi che Wrangler
// risolve in fase di build (vedi la regola [[rules]] in wrangler.toml) — per
// questo qui testiamo il caricatore direttamente sul testo letto da disco,
// invece di importare narratore-corsa-invisibile.js (che sotto Node puro non
// si può caricare: l'import di un .md non è JS valido per il suo resolver).

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
const percorsoMd = path.join(__dirname, "src", "lib", "narratore-corsa-invisibile.md");
const testoMarkdown = readFileSync(percorsoMd, "utf8");

console.log("--- caricamento dal file: parseFrammenti ---");
const frammenti = parseFrammenti(testoMarkdown);
verifica("il file produce i tre slot apertura/sviluppo/eco", Object.keys(frammenti).sort().join(",") === "apertura,eco,sviluppo");
verifica("slot apertura: 6 baseline per esito + 4 per ruolo + 12 di scena (richiestaId) = 22 frammenti", frammenti.apertura.length === 22);
verifica("slot sviluppo: 6 baseline per esito + 5 per competenza + 12 di scena (richiestaId) = 23 frammenti", frammenti.sviluppo.length === 23);
verifica("slot eco: 3 baseline per esito + 6 per fascia di margine + 16 di scena (fasciaMargine+richiestaId) = 25 frammenti", frammenti.eco.length === 25);

const apertura1 = frammenti.apertura.find((f) => f.id === "apertura-pieno-1");
verifica(
  "il frammento apertura-pieno-1 ha condizione esito=pieno e il testo atteso",
  apertura1 &&
    JSON.stringify(apertura1.condizione) === JSON.stringify({ esito: "pieno" }) &&
    apertura1.testo === "Il fiato riprende dopo lo sforzo, e per un istante il Decalogo sembra reggersi da solo."
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

console.log("\n--- regola d'oro: le baseline per esito restano INCONDIZIONATE (6/6/3) ---");
{
  // Sostanza, non solo numero: le baseline (frammenti condizionati SOLO su
  // esito) devono restare tante quante servono E incondizionate su richiestaId.
  // Se una baseline dipendesse da richiestaId, un momento senza frammenti di
  // scena dedicati resterebbe senza candidati in quello slot -> componiNarrazione
  // lancerebbe "zero candidati" al tavolo. Il conteggio totale (sopra) non lo
  // vede: solo questo controllo protegge la regola d'oro.
  const soloEsito = (lista) =>
    lista.filter((f) => JSON.stringify(Object.keys(f.condizione).sort()) === JSON.stringify(["esito"]));
  const baseAp = soloEsito(frammenti.apertura);
  const baseSv = soloEsito(frammenti.sviluppo);
  const baseEc = soloEsito(frammenti.eco);
  verifica("apertura: 6 baseline condizionate SOLO su esito", baseAp.length === 6);
  verifica("sviluppo: 6 baseline condizionate SOLO su esito", baseSv.length === 6);
  verifica("eco: 3 baseline condizionate SOLO su esito", baseEc.length === 3);
  verifica(
    "nessuna baseline per esito è condizionata su richiestaId (il Cronista non resta mai muto)",
    [...baseAp, ...baseSv, ...baseEc].every((f) => !("richiestaId" in f.condizione))
  );
  const copreEsiti = (lista) =>
    ["pieno", "parziale", "fallimento"].every((e) => lista.some((f) => f.condizione.esito === e));
  verifica(
    "le baseline coprono pieno/parziale/fallimento in tutti e tre gli slot",
    copreEsiti(baseAp) && copreEsiti(baseSv) && copreEsiti(baseEc)
  );
}

console.log("\n--- markdown malformato: errori chiari, non silenziosi ---");
try {
  parseFrammenti("## Slot: inesistente\n\n| id | testo |\n|---|---|\n| a | prova |\n");
  verifica("uno slot sconosciuto nell'intestazione lancia un errore chiaro", false);
} catch (e) {
  verifica("uno slot sconosciuto nell'intestazione lancia un errore chiaro", e.message.includes("inesistente"));
}
try {
  parseFrammenti("| id | testo |\n|---|---|\n| a | prova |\n");
  verifica("una tabella senza un '## Slot: ...' prima lancia un errore chiaro", false);
} catch (e) {
  verifica("una tabella senza un '## Slot: ...' prima lancia un errore chiaro", e.message.includes("Slot"));
}
try {
  parseFrammenti("## Slot: apertura\n\n| esito | testo |\n|---|---|\n| pieno | prova |\n");
  verifica("una riga senza colonna 'id' lancia un errore chiaro", false);
} catch (e) {
  verifica("una riga senza colonna 'id' lancia un errore chiaro", e.message.includes("id"));
}
try {
  parseFrammenti("## Slot: apertura\n\n| id | esito |\n|---|---|\n| a | pieno |\n");
  verifica("una riga senza colonna 'testo' lancia un errore chiaro", false);
} catch (e) {
  verifica("una riga senza colonna 'testo' lancia un errore chiaro", e.message.includes("testo"));
}

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
const candidatiSenzaRuolo = pool.ottieniFrammenti("apertura", contesto({ ruoloId: null }));
verifica(
  "senza ruolo, il frammento specifico dell'esploratore non è tra i candidati",
  !candidatiSenzaRuolo.some((f) => f.id === "apertura-ruolo-esploratore")
);

console.log("\n--- asse competenza (slot sviluppo) ---");
const candidatiPrecisione = pool.ottieniFrammenti("sviluppo", contesto({ competenzaId: "precisione", esito: "parziale" }));
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
  // Tre frammenti condizionati su fasciaMargine "critico" (più il baseline
  // per esito): su molti tentativi la composizione deve variare, non
  // ripetere sempre lo stesso testo — quello che una complicazione reale
  // deve mostrare al tavolo.
  const candidatiCritico = pool.ottieniFrammenti("eco", contesto({ fasciaMargine: "critico", esito: "pieno" }));
  verifica(
    "sono candidati tutti e tre i frammenti scritti per \"critico\"",
    ["eco-margine-critico", "eco-margine-critico-2", "eco-margine-critico-3"].every((id) =>
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

console.log("\n--- zero candidati impossibile: i 4 momenti nuovi hanno sempre un candidato in ogni slot e fascia ---");
{
  // Per ognuno dei 4 momenti del Prompt 14, ottieniFrammenti deve restituire
  // >=1 candidato in OGNI slot, per OGNI esito e OGNI fascia di margine: è la
  // garanzia concreta che "zero candidati" (l'errore di componiNarrazione) non
  // può capitare in partita, a prescindere dai frammenti di scena presenti.
  const momenti = ["ordine-che-non-arriva", "decisione-presa-prima", "quando-nessuno-guarda", "fiato-corto"];
  const slot = ["apertura", "sviluppo", "eco"];
  const fasce = ["basso", "medio", "alto", "critico"];
  const esiti = ["pieno", "parziale", "fallimento"];
  for (const richiestaId of momenti) {
    let sempreCoperto = true;
    let primoVuoto = "";
    for (const s of slot) {
      for (const fasciaMargine of fasce) {
        for (const esito of esiti) {
          const cand = pool.ottieniFrammenti(
            s,
            contesto({ richiestaId, fasciaMargine, esito, ruoloId: "esploratore", competenzaId: "cadenza" })
          );
          if (cand.length === 0 && !primoVuoto) {
            sempreCoperto = false;
            primoVuoto = `${s}/${fasciaMargine}/${esito}`;
          }
        }
      }
    }
    verifica(
      `momento "${richiestaId}": >=1 candidato in ogni slot x esito x fascia${sempreCoperto ? "" : " — VUOTO a " + primoVuoto}`,
      sempreCoperto
    );
  }
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

console.log("\n--- slot sconosciuto ---");
try {
  pool.ottieniFrammenti("slot-inesistente", contesto());
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
