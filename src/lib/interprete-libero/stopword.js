// Copiato da github.com/simo0703/simulatore-interprete (src/stopword.js),
// convertito da CommonJS a ESM per coerenza con il resto di questo
// progetto. Nessuna modifica di comportamento.
//
// Lista minima di stopword italiane (articoli, preposizioni semplici,
// congiunzioni comuni), escluse di default dal conteggio in punteggio.js.
// Un'opzione della libreria può "riattivare" una di queste parole per il
// proprio conteggio specificando un peso esplicito in peso_parole_chiave:
// in quel caso il peso esplicito vince sull'esclusione automatica.
//
// Il confronto avviene sulla forma grezza del token (minuscolo, dopo la
// separazione delle elisioni), non sulla radice: sono parole quasi
// invariabili, non serve lo stemming per riconoscerle.
export const STOPWORD_ITALIANE = new Set([
  // articoli determinativi (incluso "l", prodotto dall'elisione: "l'uomo" -> "l", "uomo")
  "il", "lo", "la", "i", "gli", "le", "l",
  // articoli indeterminativi
  "un", "uno", "una",
  // preposizioni semplici
  "di", "a", "da", "in", "con", "su", "per", "tra", "fra",
  // congiunzioni comuni
  "e", "o", "ma", "che",
]);
