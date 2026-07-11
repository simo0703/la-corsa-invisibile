// Registro dei pool di contenuto del Cronista disponibili per nodo.
//
// Aggiungere il pool di un nuovo nodo significa aggiungere una voce qui (o
// chiamare registraPool), NON scrivere un nuovo controllo in
// GameSession.js — che deve restare generico e senza alcuna stringa di
// nodo, come richiede la regola del motore neutro (vedi CLAUDE.md).
//
// I pool reali importano un file .md (vedi narratore-corsa-invisibile.js):
// import risolvibile solo quando il bundler di Wrangler è coinvolto
// (regola [[rules]] in wrangler.toml), non sotto Node puro. Per questo il
// caricamento usa import() dinamico dentro un try/catch: se fallisce (es.
// nei test locali, senza Wrangler) trovaPoolPerNodo restituisce null e
// GameSession.js ricade sul testo statico già previsto per i nodi senza
// pool — nessun errore, stesso fallback silenzioso.

const CARICATORI = {
  "1836-torino": () => import("./narratore-corsa-invisibile.js"),
  "1848-milano": () => import("./narratore-1848-milano.js"),
  "1915-carso-piave": () => import("./narratore-1915-carso-piave.js"),
  "emergenza-civile": () => import("./narratore-emergenza-civile.js"),
  "missione-moderna": () => import("./narratore-missione-moderna.js"),
};

// Registra (o sovrascrive) il caricatore di un pool. Usato soprattutto dai
// test, per iniettare un pool costruito in modo portabile (con il testo
// del .md già letto da fs, come fa test-narratore-corsa-invisibile.mjs)
// invece di passare dall'import del .md, che sotto Node puro non si
// risolve.
export function registraPool(nodoId, caricaPool) {
  CARICATORI[nodoId] = caricaPool;
}

// Restituisce il pool per un nodo (un oggetto con ottieniFrammenti), o
// null se il nodo non ha un pool registrato o se il caricamento fallisce
// nell'ambiente corrente.
export async function trovaPoolPerNodo(nodoId) {
  const carica = CARICATORI[nodoId];
  if (!carica) return null;
  try {
    const modulo = await carica();
    return typeof modulo.ottieniFrammenti === "function" ? modulo : null;
  } catch {
    return null;
  }
}
