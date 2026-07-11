// Test locale: node test-interprete-libero.mjs
//
// Porta un sottoinsieme significativo dei test di
// github.com/simo0703/simulatore-interprete (normalizza.test.js,
// punteggio.test.js, interprete.test.js) allo stile di test già usato in
// questo progetto (script Node semplice con verifica(), non il test
// runner `node --test` del repository sorgente) — verifica che i file
// copiati (src/lib/interprete-libero/) si comportino identicamente in
// questo ambiente, prima di collegarli a GameSession.js.
//
// Motore NEUTRO: questi test non usano contenuto di La Corsa Invisibile,
// solo la libreria di prova (opzioni inventate) del repository sorgente.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { normalizza, tokenizza } from "./src/lib/interprete-libero/normalizza.js";
import { analizzaLibreria } from "./src/lib/interprete-libero/libreria.js";
import { calcolaPunteggio, calcolaPunteggi } from "./src/lib/interprete-libero/punteggio.js";
import { interpreta } from "./src/lib/interprete-libero/interprete.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

console.log("--- normalizza.js ---");
{
  const [forzare] = normalizza("forzare");
  const [forzo] = normalizza("forzo");
  const [forzata] = normalizza("forzata");
  verifica("variazioni dello stesso verbo condividono la radice", forzare === forzo && forzo === forzata);

  const [porta] = normalizza("porta");
  const [porte] = normalizza("porte");
  verifica("singolare e plurale dello stesso nome condividono la radice", porta === porte);

  const token = tokenizza("Dell'uomo non so cosa fare, davvero!");
  verifica(
    "una frase con punteggiatura e apostrofi viene tokenizzata correttamente",
    JSON.stringify(token) === JSON.stringify(["dell", "uomo", "non", "so", "cosa", "fare", "davvero"])
  );

  verifica("lo stemming non rimuove le stopword (decisione separata)", normalizza("la porta").length === 2);
}

console.log("\n--- libreria.js + punteggio.js (libreria di prova) ---");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const percorsoLibreria = path.join(__dirname, "src", "lib", "interprete-libero", "libreria-prova", "opzioni-test.md");
const opzioni = analizzaLibreria(readFileSync(percorsoLibreria, "utf8"));

function punteggioPer(id, punteggi) {
  return punteggi.find((p) => p.id === id).punteggio;
}

{
  verifica("la libreria di prova ha le 3 opzioni attese", opzioni.length === 3);

  const punteggi = calcolaPunteggi("provo a sfondare la porta", opzioni);
  const forzare = punteggioPer("forzare_porta", punteggi);
  const scassinare = punteggioPer("scassinare_porta", punteggi);
  const aiuto = punteggioPer("chiedere_aiuto_a_gran_voce", punteggi);
  verifica('match netto: "provo a sfondare la porta" premia forzare_porta > 0.7', forzare > 0.7);
  verifica("forzare_porta supera nettamente scassinare_porta", forzare > scassinare);
  verifica("un'opzione estranea al testo ha punteggio 0", aiuto === 0);

  const punteggiEstranei = calcolaPunteggi("mi siedo e mangio una mela", opzioni);
  verifica(
    "una frase estranea alla libreria non premia nessuna opzione",
    punteggiEstranei.every((p) => p.punteggio === 0)
  );

  const punteggiAmbigui = calcolaPunteggi("la porta", opzioni);
  const forzareAmbiguo = punteggioPer("forzare_porta", punteggiAmbigui);
  const scassinareAmbiguo = punteggioPer("scassinare_porta", punteggiAmbigui);
  verifica(
    '"la porta" da sola premia forzare_porta e scassinare_porta allo stesso modo',
    forzareAmbiguo > 0 && forzareAmbiguo === scassinareAmbiguo
  );

  const conOverride = { id: "con_override", frasi_esempio: [], sinonimi_pesati: {}, peso_parole_chiave: { di: 5 }, effetto: {} };
  const senzaOverride = { id: "senza_override", frasi_esempio: [], sinonimi_pesati: {}, peso_parole_chiave: {}, effetto: {} };
  verifica("una stopword senza override non conta", calcolaPunteggio("di che parli", senzaOverride) === 0);
  verifica("una stopword con peso esplicito viene comunque conteggiata", calcolaPunteggio("di che parli", conOverride) === 5 / 3);
}

console.log("\n--- interprete.js (decisione automatica/manuale/nessuna_corrispondenza) ---");
{
  const automatica = interpreta("provo a sfondare la porta", opzioni, { sogliaAlta: 0.6, margineDistacco: 0.3 });
  verifica("scelta automatica: punteggio alto e distacco netto", automatica.tipo === "automatica");
  verifica("l'opzione scelta è quella giusta", automatica.opzione.id === "forzare_porta");
  verifica("il punteggio riportato è quello atteso", automatica.punteggio === 0.8);

  const manualeAmbiguo = interpreta("la porta", opzioni, { sogliaAlta: 0.3, margineDistacco: 0.2 });
  verifica("manuale: soglia raggiunta ma margine insufficiente", manualeAmbiguo.tipo === "manuale");
  verifica("due candidati in ambiguità", manualeAmbiguo.candidati.length === 2);
  verifica(
    "i candidati sono quelli attesi",
    JSON.stringify(manualeAmbiguo.candidati.map((c) => c.id).sort()) === JSON.stringify(["forzare_porta", "scassinare_porta"])
  );

  const manualeDistacco = interpreta("grido", opzioni, { sogliaAlta: 5, margineDistacco: 0.3 });
  verifica("manuale: distacco ampio ma soglia alta non raggiunta", manualeDistacco.tipo === "manuale");
  verifica("un solo candidato", manualeDistacco.candidati.length === 1 && manualeDistacco.candidati[0].id === "chiedere_aiuto_a_gran_voce");

  const nessunaCorrispondenza = interpreta("mi siedo e mangio una mela", opzioni, { sogliaAlta: 0.3, margineDistacco: 0.1 });
  verifica("nessuna_corrispondenza: testo estraneo alla libreria", nessunaCorrispondenza.tipo === "nessuna_corrispondenza");
  verifica("nessun campo candidati in questo caso", nessunaCorrispondenza.candidati === undefined);

  const [soloForzarePorta] = opzioni.filter((o) => o.id === "forzare_porta");
  const unaSolaOpzione = interpreta("sfondo", [soloForzarePorta], { sogliaAlta: 1, margineDistacco: 999 });
  verifica('libreria con una sola opzione: il distacco dal "secondo" è considerato soddisfatto', unaSolaOpzione.tipo === "automatica");

  let erroriValidazione = 0;
  try { interpreta("sfondo", opzioni, { sogliaAlta: 0.5 }); } catch { erroriValidazione++; }
  try { interpreta("sfondo", opzioni, { sogliaAlta: "alta", margineDistacco: 0.2 }); } catch { erroriValidazione++; }
  try { interpreta("sfondo", [], { sogliaAlta: 0.5, margineDistacco: 0.2 }); } catch { erroriValidazione++; }
  verifica("soglie mancanti/non numeriche o libreria vuota vengono rifiutate (3 casi)", erroriValidazione === 3);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
