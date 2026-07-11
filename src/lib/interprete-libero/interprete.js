// Copiato da github.com/simo0703/simulatore-interprete (src/interprete.js),
// convertito da CommonJS a ESM per coerenza con il resto di questo
// progetto. Nessuna modifica di comportamento.

import { calcolaPunteggi } from "./punteggio.js";

function validaNumeroFinito(valore, nome) {
  if (typeof valore !== "number" || !Number.isFinite(valore)) {
    throw new Error(`interpreta: ${nome} deve essere un numero, ricevuto ${JSON.stringify(valore)}`);
  }
}

/**
 * Sceglie, tra le opzioni della libreria, quella che meglio corrisponde al
 * testo libero — oppure segnala che la scelta va fatta a mano.
 *
 * Non genera contenuto nuovo e non inventa effetti: sceglie solo tra opzioni
 * già scritte in anticipo, restituendo l'oggetto opzione così come prodotto
 * da libreria.js (incluso il suo "effetto" opaco).
 *
 * @param {string} testoLibero
 * @param {Array} opzioni - array di opzioni già analizzate da libreria.js
 * @param {{ sogliaAlta: number, margineDistacco: number }} soglie
 *
 * @returns {
 *   { tipo: 'automatica', opzione, punteggio } |
 *   { tipo: 'manuale', candidati: [{ id, opzione, punteggio }, ...] } |
 *   { tipo: 'nessuna_corrispondenza' }
 * }
 *
 * Decisione:
 *  - punteggio migliore >= sogliaAlta E distacco dal secondo >= margineDistacco
 *    -> automatica;
 *  - altrimenti, se almeno un'opzione ha punteggio > 0 -> manuale, con solo
 *    le opzioni con punteggio > 0 (le altre sono rumore, non candidati);
 *  - altrimenti (nessuna opzione con punteggio > 0) -> nessuna_corrispondenza,
 *    distinto dal caso manuale: non è ambiguità tra candidati deboli, è
 *    assenza di corrispondenza.
 *
 * Se la libreria contiene una sola opzione, il distacco dal "secondo" non è
 * definito: si considera automaticamente soddisfatto (nulla con cui essere
 * ambigui), quindi la scelta dipende solo da sogliaAlta.
 */
export function interpreta(testoLibero, opzioni, soglie) {
  if (!Array.isArray(opzioni) || opzioni.length === 0) {
    throw new Error("interpreta: serve almeno una opzione della libreria");
  }
  const { sogliaAlta, margineDistacco } = soglie || {};
  validaNumeroFinito(sogliaAlta, "sogliaAlta");
  validaNumeroFinito(margineDistacco, "margineDistacco");

  const opzionePerId = new Map(opzioni.map((opzione) => [opzione.id, opzione]));

  const ordinati = calcolaPunteggi(testoLibero, opzioni).sort(
    (a, b) => b.punteggio - a.punteggio
  );

  const migliore = ordinati[0];
  const secondo = ordinati[1];
  const distacco = migliore.punteggio - (secondo ? secondo.punteggio : -Infinity);

  const sceltaAutomatica = migliore.punteggio >= sogliaAlta && distacco >= margineDistacco;

  if (sceltaAutomatica) {
    return {
      tipo: "automatica",
      opzione: opzionePerId.get(migliore.id),
      punteggio: migliore.punteggio,
    };
  }

  const candidati = ordinati
    .filter((p) => p.punteggio > 0)
    .map((p) => ({
      id: p.id,
      opzione: opzionePerId.get(p.id),
      punteggio: p.punteggio,
    }));

  if (candidati.length === 0) {
    return { tipo: "nessuna_corrispondenza" };
  }

  return { tipo: "manuale", candidati };
}
