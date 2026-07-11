// Copiato da github.com/simo0703/simulatore-interprete (src/normalizza.js),
// convertito da CommonJS a ESM (require/module.exports -> import/export)
// per coerenza con il resto di questo progetto, che non ha alcun file
// CommonJS. Nessuna modifica di comportamento.
//
// Modulo NEUTRO (nessun riferimento a La Corsa Invisibile): fa parte del
// motore di interpretazione del testo libero, riusabile identico in futuri
// giochi, come già narratore-simulato.js per il Cronista.
//
// Import NOMINALE, non di default: snowball-stemmers imposta
// `exports.__esModule = true` senza impostare `exports.default`. Sotto
// Node puro l'interop CJS->ESM sintetizza comunque un default (avvolgendo
// l'intero modulo), ma esbuild (il bundler usato da Wrangler per i
// Workers) non lo fa in questo caso preciso: `import snowball from
// "snowball-stemmers"` risulterebbe `undefined` a runtime SOLO sotto
// Workers, non sotto Node -- bug scoperto con `wrangler dev` reale, non
// dai soli test locali. L'import nominale funziona identico in entrambi
// gli ambienti, perché si basa sull'analisi statica delle assegnazioni
// `exports.newStemmer = ...` invece dell'interop di default.
import { newStemmer } from "snowball-stemmers";

const stemmerItaliano = newStemmer("italian");

// Vari modi in cui un apostrofo può comparire in testo libero (dritto,
// tipografico, accento grave/acuto usato come apostrofo).
const APOSTROFI = /[‘’ʼ`´]/g;

const SOLO_CIFRE = /^\d+$/;

/**
 * Divide il testo in token: minuscolo, apostrofi trattati come confine di
 * parola (elisione: "dell'uomo" -> "dell", "uomo"), punteggiatura rimossa.
 */
export function tokenizza(testo) {
  return testo
    .toLowerCase()
    .replace(APOSTROFI, "'")
    .replace(/'/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function radiceToken(token) {
  // I numeri non vengono passati allo stemmer: non sono parole da radicare.
  if (SOLO_CIFRE.test(token)) {
    return token;
  }
  return stemmerItaliano.stem(token);
}

/**
 * Normalizza testo libero in un array di token radicati: minuscolo,
 * elisioni separate, punteggiatura rimossa, stemming italiano per token.
 * Non rimuove le stopword (il/la/di/che...): è una decisione separata.
 */
export function normalizza(testo) {
  return tokenizza(testo).map(radiceToken);
}
