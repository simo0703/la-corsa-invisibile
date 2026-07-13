// Il Cronista — motore di narrazione a frammenti combinabili.
//
// QUESTO FILE È NEUTRO: non deve mai contenere un termine specifico di un
// singolo gioco (né "Cadenza", né "Vaira", né nomi di ruoli o nodi di Corsa
// Invisibile, né terminologia de La Soglia). È pensato per essere copiato
// così com'è nel prossimo gioco: cambia solo il "pool" che gli viene passato.
//
// COME FUNZIONA IN BREVE
// Il motore compone il testo di un esito in tre passaggi (slot), sempre
// nello stesso ordine:
//   1. apertura  — aggancia l'azione appena successa al tono del momento
//   2. sviluppo  — il cuore del testo: cosa succede davvero
//   3. eco       — una riga breve che lega l'esito a ciò che si sta
//                  accumulando nella partita (es. una traccia che sale)
// Per ogni slot, il motore chiede al "pool" i frammenti candidati, ne
// sceglie uno (evitando ripetizioni recenti quando possibile), lo risolve
// in testo (sostituendo eventuali placeholder, o eseguendo una funzione se
// il frammento è programmatico) e concatena i tre risultati.
//
// IL CONTRATTO CHE UN "POOL" DEVE RISPETTARE
// Un pool è un modulo scritto per UN gioco specifico (es. il futuro
// `narratore-corsa-invisibile.js`, non ancora scritto). Deve esportare:
//
//   ottieniFrammenti(slot, contesto) -> Array<Frammento>
//     `slot` è una delle stringhe in SLOT (vedi sotto).
//     `contesto` è l'oggetto descritto più sotto.
//     Deve SEMPRE restituire almeno un frammento (mettere un frammento di
//     default generico è responsabilità del pool, non del motore: se la
//     lista è vuota il motore si ferma con un errore chiaro).
//
//   connettivo(slotPrecedente, slotSuccessivo, contesto) -> string  [opzionale]
//     Se non esportata, il motore usa uno spazio singolo come connettivo.
//
// UN FRAMMENTO è un oggetto:
//   {
//     id: string,              // univoco ALMENO all'interno dello stesso slot
//     peso: number,             // opzionale, default 1 — frammenti con peso
//                                // più alto vengono scelti più spesso
//     testo: string | (contesto) => string
//       // Se stringa: può contenere placeholder tipo {ruolo}, {nodo} —
//       //   sostituiti con contesto.variabili[chiave].
//       // Se funzione: il pool genera il testo a mano (utile per frasi che
//       //   dipendono da più variabili insieme, conteggi, condizioni fini
//       //   che un semplice placeholder non regge). Questo è ciò che rende
//       //   il pool "un vero programma" e non solo dati statici.
//   }
//
// IL "CONTESTO" che il motore passa a ogni chiamata (lo costruisce il
// codice del gioco, es. GameSession.js — MAI il motore stesso, che non
// conosce nulla del gioco):
//   {
//     esito: "pieno" | "parziale" | "fallimento",
//     competenzaId: string | null,   // id opaco, il pool decide cosa significa
//     ruoloId: string | null,
//     margine: { valore: number, soglia: number, delta: number },
//       // delta = variazione avvenuta con QUESTA azione (positivo, negativo, 0)
//     variabili: { [chiave]: string },   // per i placeholder {chiave}
//     storicoFrammenti: string[],   // id dei frammenti usati di recente
//                                    // (il chiamante decide quanti tenerne:
//                                    // consigliato, gli ultimi 2-3 esiti)
//   }
//
// Il motore arricchisce il contesto con un campo derivato, `fasciaMargine`
// (vedi fasciaMargine sotto), calcolato automaticamente — il pool lo trova
// già pronto in contesto.fasciaMargine e non deve calcolarlo da solo.

export const SLOT = ["apertura", "sviluppo", "eco"];

// Classifica genericamente quanto una traccia "a soglia" (tipo il Margine)
// è vicina al punto di rottura. Puramente matematico, nessun termine di
// gioco: qualunque traccia con un valore e una soglia può usarlo.
// Ritorna "basso" | "medio" | "alto" | "critico" (critico = soglia raggiunta
// o superata).
export function fasciaMargine(valore, soglia) {
  if (soglia === null || soglia === undefined || soglia <= 0) return "basso";
  const rapporto = valore / soglia;
  if (rapporto >= 1) return "critico";
  if (rapporto >= 0.67) return "alto";
  if (rapporto >= 0.34) return "medio";
  return "basso";
}

// Sceglie un frammento tra i candidati, con selezione pesata (peso di
// default 1) evitando quelli usati di recente. storicoRecente è ordinato dal
// più VECCHIO (indice 0) al più RECENTE (in coda). Rilascio progressivo: si
// parte escludendo tutti gli id recenti; se così non resta nessun candidato
// si rilasciano gli id più vecchi uno alla volta (restringendo la finestra a
// un suffisso sempre più corto di storicoRecente), finché almeno un candidato
// torna disponibile. Il più recente è quindi l'ultimo a essere rilasciato:
// con ≥2 candidati il frammento usato per ultimo non può mai essere riscelto
// al tiro immediatamente successivo. Con storico vuoto non si esclude nulla e
// il comportamento è identico a prima. (Il ciclo arriva al più a i =
// storicoRecente.length, dove il suffisso è vuoto e pool == candidati: la
// terminazione con almeno un candidato è sempre garantita.)
export function scegliFrammento(candidati, storicoRecente = []) {
  if (!Array.isArray(candidati) || candidati.length === 0) {
    throw new Error("scegliFrammento: nessun candidato fornito");
  }

  let pool = [];
  for (let i = 0; i <= storicoRecente.length; i += 1) {
    const esclusi = new Set(storicoRecente.slice(i));
    pool = candidati.filter((f) => !esclusi.has(f.id));
    if (pool.length > 0) break;
  }

  const pesoTotale = pool.reduce((somma, f) => somma + (f.peso ?? 1), 0);
  let soglia = Math.random() * pesoTotale;
  for (const frammento of pool) {
    soglia -= frammento.peso ?? 1;
    if (soglia <= 0) return frammento;
  }
  return pool[pool.length - 1]; // rete di sicurezza per arrotondamenti float
}

// Sostituisce i placeholder {chiave} in un testo con contesto.variabili.
// Un placeholder senza variabile corrispondente resta visibile così com'è
// (es. "{luogo}") invece di sparire silenziosamente: è un bug da notare in
// fase di scrittura dei frammenti, non da nascondere in produzione.
function sostituisciPlaceholder(testo, variabili = {}) {
  return testo.replace(/\{(\w+)\}/g, (intero, chiave) => {
    return chiave in variabili ? String(variabili[chiave]) : intero;
  });
}

// Risolve un frammento in testo finale: esegue la funzione se testo è
// programmatico, altrimenti sostituisce i placeholder nella stringa.
function risolviTesto(frammento, contesto) {
  if (typeof frammento.testo === "function") {
    return frammento.testo(contesto);
  }
  return sostituisciPlaceholder(frammento.testo, contesto.variabili);
}

// Compone il testo completo di un esito interrogando il pool per ognuno dei
// tre slot (apertura, sviluppo, eco), scegliendo un frammento per slot e
// concatenando i risultati. Ritorna sia il testo finale sia gli id dei
// frammenti usati, così il chiamante può aggiungerli allo storico recente
// per la prossima chiamata (evitare ripetizioni immediate).
export function componiNarrazione(pool, contestoBase) {
  if (typeof pool.ottieniFrammenti !== "function") {
    throw new Error("componiNarrazione: il pool deve esportare ottieniFrammenti(slot, contesto)");
  }

  const contesto = {
    ...contestoBase,
    fasciaMargine: contestoBase.margine
      ? fasciaMargine(contestoBase.margine.valore, contestoBase.margine.soglia)
      : "basso",
  };

  const storicoRecente = contesto.storicoFrammenti ?? [];
  const pezzi = [];
  const frammentiUsati = [];

  for (const slot of SLOT) {
    const candidati = pool.ottieniFrammenti(slot, contesto);
    if (!Array.isArray(candidati) || candidati.length === 0) {
      throw new Error(
        `componiNarrazione: il pool non ha restituito nessun frammento per lo slot "${slot}" ` +
          `(contesto: esito=${contesto.esito}, competenza=${contesto.competenzaId}, ruolo=${contesto.ruoloId})`
      );
    }

    const scelto = scegliFrammento(candidati, storicoRecente);
    pezzi.push({ slot, testo: risolviTesto(scelto, contesto) });
    frammentiUsati.push(scelto.id);
  }

  const testo = pezzi
    .map((pezzo, indice) => {
      if (indice === 0) return pezzo.testo;
      const precedente = pezzi[indice - 1].slot;
      const connettivo =
        typeof pool.connettivo === "function"
          ? pool.connettivo(precedente, pezzo.slot, contesto)
          : " ";
      return connettivo + pezzo.testo;
    })
    .join("");

  return { testo, frammentiUsati };
}
