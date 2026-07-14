// Logica PURA del tavolo condiviso (Passo 3/3): decisioni derivabili dalla
// sola sessione pubblica, senza nessun accesso al DOM. Vive in public/ per un
// doppio motivo: viene servita come modulo statico al browser (importata da
// index.html) ED è importabile da un test Node (test-vista-esito.mjs). Node
// riconosce l'ESM dalla sintassi `export`, come già fa per src/**/*.js.
//
// Nessun termine specifico del gioco qui dentro: si lavora solo su forme di
// dati generiche (la sessione e l'elenco dei nodi arrivano da fuori).

// Replica lato client di GameSession.trovaRichiestaAttiva: dallo stato
// condiviso (nodoAttivo + richiestaAttivaId, con fallback legacy sull'indice)
// ricava l'oggetto richiesta corrente leggendo i nodi dalla config del gioco.
// È il cardine del Passo 3: il momento mostrato a TUTTI i giocatori è deciso
// qui dallo stato del server, mai dalla navigazione locale del singolo
// browser. Restituisce null quando non c'è un nodo attivo, il nodo non esiste
// nella config, o la richiesta indicata non si trova (nodo esaurito).
export function richiestaAttivaDaSessione(session, nodiTemporali) {
  if (!session || !session.nodoAttivo || !Array.isArray(nodiTemporali)) return null;
  const nodo = nodiTemporali.find((n) => n.id === session.nodoAttivo);
  if (!nodo || !Array.isArray(nodo.richieste)) return null;
  if (session.richiestaAttivaId) {
    return nodo.richieste.find((r) => r.id === session.richiestaAttivaId) ?? null;
  }
  return nodo.richieste[session.richiestaIndice] ?? null; // fallback legacy sull'indice
}

// Decide se mostrare il pannello dell'esito, data la vista condivisa
// `esitoCorrente` e l'ultima richiesta già "scacciata" (dismissa) su QUESTO
// dispositivo. Tre condizioni, tutte necessarie:
// - esitoCorrente esiste (c'è davvero un esito nello stato condiviso);
// - il suo testo è una stringa non vuota. I momenti "corri-prima" (senza
//   tiro) hanno esito "": nessun pannello, si ridisegna direttamente il
//   momento nuovo. Un esito null/undefined (tier di un tiro senza testo
//   scritto) è trattato come "niente da mostrare", non come testo "null";
// - non è già stato scacciato qui: richiestaId diverso dall'ultimo scacciato.
export function deveMostrareEsito(esitoCorrente, ultimaRichiestaScacciata) {
  if (!esitoCorrente) return false;
  if (typeof esitoCorrente.esito !== "string" || esitoCorrente.esito === "") return false;
  return esitoCorrente.richiestaId !== ultimaRichiestaScacciata;
}
