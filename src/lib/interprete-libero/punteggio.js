// Copiato da github.com/simo0703/simulatore-interprete (src/punteggio.js),
// convertito da CommonJS a ESM per coerenza con il resto di questo
// progetto. Nessuna modifica di comportamento.

import { tokenizza, normalizza } from "./normalizza.js";
import { STOPWORD_ITALIANE } from "./stopword.js";

function radiciDiFrase(frase) {
  return normalizza(frase);
}

function insiemeRadici(frasi) {
  const insieme = new Set();
  frasi.forEach((frase) => {
    radiciDiFrase(frase).forEach((radice) => insieme.add(radice));
  });
  return insieme;
}

/**
 * Precompila un'opzione della libreria in strutture indicizzate per radice,
 * pronte per il confronto con il testo libero:
 *  - pesoPerOverride: radice -> peso esplicito da peso_parole_chiave
 *  - pesoPerGruppo:   radice -> peso del gruppo sinonimi_pesati a cui appartiene
 *  - radiciFrasi:     radici presenti in frasi_esempio (peso implicito 1)
 */
function compilaOpzione(opzione) {
  const pesoPerOverride = new Map();
  Object.entries(opzione.peso_parole_chiave || {}).forEach(([chiave, peso]) => {
    const [radice] = radiciDiFrase(chiave);
    if (radice !== undefined) {
      pesoPerOverride.set(radice, peso);
    }
  });

  const pesoPerGruppo = new Map();
  Object.values(opzione.sinonimi_pesati || {}).forEach(({ varianti, peso }) => {
    insiemeRadici(varianti).forEach((radice) => {
      const attuale = pesoPerGruppo.get(radice);
      if (attuale === undefined || peso > attuale) {
        pesoPerGruppo.set(radice, peso);
      }
    });
  });

  const radiciFrasi = insiemeRadici(opzione.frasi_esempio || []);

  return { pesoPerOverride, pesoPerGruppo, radiciFrasi };
}

/**
 * Calcola il punteggio di corrispondenza tra un testo libero e una singola
 * opzione della libreria. Restituisce solo un numero: non decide nulla.
 *
 * Per ogni token del testo (nell'ordine in cui compare):
 *  - se è una stopword italiana senza peso esplicito per questa opzione,
 *    viene escluso dal conteggio;
 *  - altrimenti riceve il peso esplicito da peso_parole_chiave, se presente;
 *  - altrimenti il peso del gruppo sinonimi_pesati a cui appartiene, se presente;
 *  - altrimenti, se compare in una frase di esempio, peso 1;
 *  - altrimenti non contribuisce al punteggio.
 * La somma pesata è normalizzata per il numero totale di token del testo
 * (comprese le stopword), per non favorire testi lunghi a caso.
 */
export function calcolaPunteggio(testoLibero, opzione) {
  const grezzi = tokenizza(testoLibero);

  if (grezzi.length === 0) {
    return 0;
  }

  const radici = normalizza(testoLibero);
  const { pesoPerOverride, pesoPerGruppo, radiciFrasi } = compilaOpzione(opzione);

  let sommaPesata = 0;

  grezzi.forEach((grezzo, indice) => {
    const radice = radici[indice];
    const override = pesoPerOverride.get(radice);

    if (STOPWORD_ITALIANE.has(grezzo) && override === undefined) {
      return;
    }

    if (override !== undefined) {
      sommaPesata += override;
      return;
    }

    if (pesoPerGruppo.has(radice)) {
      sommaPesata += pesoPerGruppo.get(radice);
      return;
    }

    if (radiciFrasi.has(radice)) {
      sommaPesata += 1;
    }
  });

  return sommaPesata / grezzi.length;
}

/**
 * Calcola il punteggio del testo libero per ciascuna opzione della libreria.
 * Restituisce un array di { id, punteggio }, nello stesso ordine delle
 * opzioni in ingresso. Non ordina né decide: la logica di soglia e scelta
 * automatica/manuale è compito di interprete.js.
 */
export function calcolaPunteggi(testoLibero, opzioni) {
  return opzioni.map((opzione) => ({
    id: opzione.id,
    punteggio: calcolaPunteggio(testoLibero, opzione),
  }));
}
