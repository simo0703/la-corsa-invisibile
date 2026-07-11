// Registro delle librerie dell'interprete di testo libero, disponibili per
// richiesta (non per nodo: ogni richiesta ha le sue opzioni). Stesso schema
// di narratore-registro-pool.js per il Cronista.
//
// Aggiungere la libreria di una nuova richiesta significa aggiungere una
// voce qui (o chiamare registraLibreria), NON scrivere un nuovo controllo
// in GameSession.js — che deve restare generico e senza alcuna stringa di
// richiesta o nodo, come richiede la regola del motore neutro (vedi
// CLAUDE.md).
//
// Le librerie reali importano un file .md: import risolvibile solo quando
// il bundler di Wrangler è coinvolto (regola [[rules]] in wrangler.toml),
// non sotto Node puro. Per questo il caricamento usa import() dinamico
// dentro un try/catch: se fallisce (es. nei test locali, senza Wrangler,
// o una richiesta senza libreria) trovaLibreriaPerRichiesta restituisce
// null e il chiamante (GameSession.js) tratta la richiesta come "nessun
// testo libero disponibile" — nessun errore, fallback silenzioso. Questo è
// anche il meccanismo con cui gli altri nodi (senza ancora una libreria)
// restano a soli bottoni: nessuna voce nel registro, stesso fallback.

const CARICATORI = {
  "decalogo-ginnastica": () => import("./interprete-libero/1836-torino/decalogo-ginnastica.js"),
  "decalogo-vaira": () => import("./interprete-libero/1836-torino/decalogo-vaira.js"),
  "decalogo-vaira-severo": () => import("./interprete-libero/1836-torino/decalogo-vaira-severo.js"),
  "milano-barricata": () => import("./interprete-libero/1848-milano/milano-barricata.js"),
  "milano-ferito": () => import("./interprete-libero/1848-milano/milano-ferito.js"),
  "carso-attesa": () => import("./interprete-libero/1915-carso-piave/carso-attesa.js"),
  "carso-bombardamento": () => import("./interprete-libero/1915-carso-piave/carso-bombardamento.js"),
};

// Registra (o sovrascrive) il caricatore di una libreria. Usato soprattutto
// dai test, per iniettare una libreria costruita in modo portabile (con il
// testo del .md già letto da fs) invece di passare dall'import del .md,
// che sotto Node puro non si risolve.
export function registraLibreria(richiestaId, caricaLibreria) {
  CARICATORI[richiestaId] = caricaLibreria;
}

// Restituisce l'array di opzioni (già analizzate da libreria.js) per una
// richiesta, o null se la richiesta non ha una libreria registrata o se il
// caricamento fallisce nell'ambiente corrente.
export async function trovaLibreriaPerRichiesta(richiestaId) {
  const carica = CARICATORI[richiestaId];
  if (!carica) return null;
  try {
    const modulo = await carica();
    return Array.isArray(modulo.opzioni) ? modulo.opzioni : null;
  } catch {
    return null;
  }
}
