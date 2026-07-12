// Test locale: node test-identita-client.mjs
//
// Verifica la logica client (public/index.html) che decide se un secondo
// /join nella stessa stanza sovrascriverebbe silenziosamente un'identità
// già presente in localStorage -- il bug al centro dell'indagine sul
// messaggio "sessione non più valida" (vedi DECISIONI_LA_CORSA_INVISIBILE.md).
//
// public/index.html non è un modulo (è HTML con uno <script> inline, senza
// export): questo test estrae il testo delle sole funzioni pure coinvolte
// (identitaValida, pulisciIdentita, identitaEsistentePerStanzaCorrente --
// nessuna delle tre tocca il DOM) direttamente dal file reale con una regex,
// invece di duplicarle qui a mano. Così il test resta sincronizzato con
// l'implementazione vera senza bisogno di un bundler o di un browser headless
// -- stesso principio già usato altrove nel repo (es.
// test-narratore-1848-milano.mjs legge il .md vero invece di un fixture a
// parte). Le funzioni estratte vengono eseguite in un contesto vm isolato,
// con STATO dichiarato "var" (non "let", come nel file originale) SOLO nello
// scaffolding di questo test: è l'unico modo per cui il contesto vm esponga
// STATO come proprietà leggibile/scrivibile dall'esterno tra un'asserzione e
// l'altra -- il comportamento delle funzioni estratte non cambia in base a
// come STATO viene dichiarato, quindi la sostituzione è sicura.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

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
const percorsoHtml = path.join(__dirname, "public", "index.html");
const html = readFileSync(percorsoHtml, "utf8");

function estraiFunzione(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio === -1) {
    throw new Error(`test-identita-client: funzione "${nome}" non trovata in public/index.html`);
  }
  const fineGraffa = html.indexOf("\n}", inizio);
  if (fineGraffa === -1) {
    throw new Error(`test-identita-client: chiusura di "${nome}" non trovata (pattern "\\n}" assente)`);
  }
  return html.slice(inizio, fineGraffa + 2);
}

const sorgente = [
  estraiFunzione("identitaValida"),
  estraiFunzione("pulisciIdentita"),
  estraiFunzione("identitaEsistentePerStanzaCorrente"),
].join("\n\n");

console.log("--- funzioni estratte da public/index.html ---");
verifica("identitaValida() estratta (contiene il controllo giocatoreId/token)", sorgente.includes("STATO.giocatoreId && STATO.token"));
verifica("pulisciIdentita() estratta (azzera identitaRoomId)", sorgente.includes("STATO.identitaRoomId = null"));
verifica(
  "identitaEsistentePerStanzaCorrente() estratta (confronta identitaRoomId con roomId)",
  sorgente.includes("STATO.identitaRoomId === STATO.roomId")
);

// STATO di default identico a quello dichiarato in public/index.html, ma
// con "var" invece di "let" (vedi commento in cima al file: solo per
// esporlo come proprietà del contesto vm).
function nuovoContesto(statoIniziale) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    `var STATO = ${JSON.stringify(statoIniziale)};\n${sorgente}`,
    sandbox
  );
  return sandbox;
}

function statoDefault(extra = {}) {
  return {
    roomId: null,
    nome: null,
    ruolo: null,
    giocatoreId: null,
    token: null,
    tokenCreazione: null,
    comandante: false,
    competenze: null,
    identitaRoomId: null,
    ...extra,
  };
}

console.log("\n--- identitaEsistentePerStanzaCorrente(): nessuna identità salvata ---");
{
  const ctx = nuovoContesto(statoDefault({ roomId: "stanza-A" }));
  verifica(
    "browser mai unito a nessuna stanza: false (nessun avviso, /join procede come sempre)",
    ctx.identitaEsistentePerStanzaCorrente() === false
  );
}

console.log("\n--- identitaEsistentePerStanzaCorrente(): identità per una stanza DIVERSA ---");
{
  const ctx = nuovoContesto(statoDefault({
    roomId: "stanza-B", // stanza verso cui si sta per fare /join
    nome: "Mario",
    giocatoreId: "g1",
    token: "t1",
    identitaRoomId: "stanza-A", // identità valida, ma per un'ALTRA stanza
  }));
  verifica(
    "identità presente ma per un'altra stanza: false, comportamento invariato (caso legittimo)",
    ctx.identitaEsistentePerStanzaCorrente() === false
  );
}

console.log("\n--- identitaEsistentePerStanzaCorrente(): identità per la STESSA stanza (il bug) ---");
{
  const ctx = nuovoContesto(statoDefault({
    roomId: "stanza-A",
    nome: "Mario",
    giocatoreId: "g1",
    token: "t1",
    identitaRoomId: "stanza-A", // stessa stanza verso cui si sta per fare /join
  }));
  verifica(
    "identità presente per QUESTA stanza: true, deve scattare l'avviso invece del /join diretto",
    ctx.identitaEsistentePerStanzaCorrente() === true
  );
}

console.log("\n--- identitaEsistentePerStanzaCorrente(): sessione pre-fix (identitaRoomId assente) ---");
{
  // Simula un record di localStorage salvato PRIMA di questo fix: nessun
  // campo identitaRoomId (JSON.parse di un vecchio salvataggio lo
  // lascerebbe undefined, non null). Deve restare false: nessun falso
  // positivo per chi aveva già una sessione valida prima dell'aggiornamento.
  const vecchioStato = statoDefault({ roomId: "stanza-A", nome: "Mario", giocatoreId: "g1", token: "t1" });
  delete vecchioStato.identitaRoomId;
  const ctx = nuovoContesto(vecchioStato);
  verifica(
    "sessione salvata prima del fix (identitaRoomId assente): false, nessun crash, nessun avviso spurio",
    ctx.identitaEsistentePerStanzaCorrente() === false
  );
}

console.log("\n--- pulisciIdentita(): ripulisce l'identità, non tocca roomId/tokenCreazione ---");
{
  const ctx = nuovoContesto(statoDefault({
    roomId: "stanza-B",
    tokenCreazione: "creazione-xyz",
    nome: "Mario",
    ruolo: "incursore",
    giocatoreId: "g1",
    token: "t1",
    comandante: true,
    competenze: { cadenza: 3 },
    identitaRoomId: "stanza-A",
  }));
  ctx.pulisciIdentita();
  verifica("nome azzerato", ctx.STATO.nome === null);
  verifica("ruolo azzerato", ctx.STATO.ruolo === null);
  verifica("giocatoreId azzerato", ctx.STATO.giocatoreId === null);
  verifica("token azzerato", ctx.STATO.token === null);
  verifica("comandante riportato a false", ctx.STATO.comandante === false);
  verifica("competenze azzerate", ctx.STATO.competenze === null);
  verifica("identitaRoomId azzerato", ctx.STATO.identitaRoomId === null);
  verifica("roomId NON toccato (responsabilità di chi chiama)", ctx.STATO.roomId === "stanza-B");
  verifica("tokenCreazione NON toccato (responsabilità di chi chiama)", ctx.STATO.tokenCreazione === "creazione-xyz");
}

console.log("\n--- dopo pulisciIdentita(), identitaEsistentePerStanzaCorrente() torna false ---");
{
  const ctx = nuovoContesto(statoDefault({
    roomId: "stanza-A",
    nome: "Mario",
    giocatoreId: "g1",
    token: "t1",
    identitaRoomId: "stanza-A",
  }));
  verifica("prima della pulizia: true", ctx.identitaEsistentePerStanzaCorrente() === true);
  ctx.pulisciIdentita();
  verifica("dopo la pulizia: false (il /join può procedere senza avviso)", ctx.identitaEsistentePerStanzaCorrente() === false);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
