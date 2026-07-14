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

// Chiave di identità di un avviso di rifiuto (Difetto #6): richiestaId +
// timestamp. Il timestamp la rende unica per OGNI rifiuto, così un secondo
// rifiuto sullo stesso momento (dopo che il proponente ha riprovato) è un
// avviso nuovo, non "già scacciato". Restituisce null se non c'è rifiuto.
export function chiaveRifiuto(rifiutoCorrente) {
  if (!rifiutoCorrente) return null;
  return `${rifiutoCorrente.richiestaId}:${rifiutoCorrente.timestamp}`;
}

// Decide se mostrare l'avviso di rifiuto della proposta di testo libero, data
// la vista condivisa `rifiutoCorrente` e l'ultimo rifiuto già scacciato su
// QUESTO dispositivo. Mostra se: il rifiuto esiste, ha un testo di proposta
// (una stringa non vuota) e non è già stato scacciato qui (chiave diversa
// dall'ultima scacciata).
export function deveMostrareRifiuto(rifiutoCorrente, ultimoRifiutoScacciato) {
  if (!rifiutoCorrente) return false;
  if (typeof rifiutoCorrente.testoProposta !== "string" || rifiutoCorrente.testoProposta === "") return false;
  return chiaveRifiuto(rifiutoCorrente) !== ultimoRifiutoScacciato;
}

// Decide se scorrere la pagina fino a un pannello, data la sua visibilità
// attuale, la chiave di ciò che mostra ora e la chiave dell'ultimo contenuto a
// cui si è GIÀ scorso su questo dispositivo. Si scorre SOLO alla transizione
// nascosto→visibile di un contenuto NUOVO: se il pannello è già visibile con la
// stessa chiave (un redraw da un broadcast qualsiasi) non si scorre, per non
// strattonare chi sta leggendo o scrivendo. È la parte PURA della decisione;
// il "è già tutto in viewport?" resta un controllo DOM a parte (vedi
// scorriSeNecessario in index.html).
export function deveScorrereAlPannello(visibileOra, chiaveCorrente, ultimaChiaveScorsa) {
  if (!visibileOra) return false;
  return chiaveCorrente !== ultimaChiaveScorsa;
}

// Difetto #7: un momento accetta testo libero SOLO se qualcosa di scritto può
// portare a un esito — cioè se ha un tiro (una risposta con competenzaRichiesta,
// leggibile dai dati della richiesta) e/o una libreria dell'interprete
// registrata per il suo id. La lista delle richieste con libreria è DATA:
// deriva dal registro server (Object.keys dei caricatori, esposta al client via
// /api/config come richiesteConTestoLibero), non da un elenco di id scritto a
// mano — così i nodi futuri la ereditano senza toccare questa funzione.
//
// Nota: tiro e libreria NON coincidono. In 1836-torino le richieste del
// Decalogo (decalogo-vaira, -severo) hanno una libreria ma NESSUN tiro: il solo
// tiro le nasconderebbe per errore, per questo serve anche la libreria. Al
// contrario un momento "beat" come corri-prima non ha né l'uno né l'altra → il
// campo sparisce.
export function momentoAccettaTestoLibero(richiesta, richiesteConLibreria) {
  if (!richiesta) return false;
  const haTiro = Array.isArray(richiesta.risposte)
    && richiesta.risposte.some((r) => r && r.competenzaRichiesta);
  const haLibreria = Array.isArray(richiesteConLibreria)
    && richiesteConLibreria.includes(richiesta.id);
  return haTiro || haLibreria;
}
