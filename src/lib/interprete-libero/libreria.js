// Copiato da github.com/simo0703/simulatore-interprete (src/libreria.js),
// convertito da CommonJS a ESM per coerenza con il resto di questo
// progetto. Nessuna modifica di comportamento.
//
// Parser della libreria di opzioni scritta in Markdown da un narratore/autore.
// Non interpreta il significato delle opzioni: si limita a trasformare il
// testo in dati strutturati che i moduli successivi (normalizzazione,
// punteggio) useranno per il confronto.

const INTESTAZIONE_OPZIONE = /^##\s+Opzione:\s*(.+?)\s*$/i;
const INTESTAZIONE_SEZIONE = /^###\s+(.+?)\s*$/;
const RIGA_ELENCO = /^[-*]\s+(.*)$/;

const NOMI_SEZIONE = {
  "frasi di esempio": "frasi_esempio",
  "sinonimi pesati": "sinonimi_pesati",
  "peso parole chiave": "peso_parole_chiave",
  effetto: "effetto",
};

function rimuoviVirgolette(testo) {
  return testo.replace(/^["'“”]+|["'“”]+$/g, "").trim();
}

function analizzaRigaSinonimo(riga, numeroRiga) {
  const indiceDuePunti = riga.indexOf(":");
  if (indiceDuePunti === -1) {
    throw new Error(`Riga ${numeroRiga}: sinonimo malformato, manca ":" -> "${riga}"`);
  }

  const chiave = riga.slice(0, indiceDuePunti).trim();
  let resto = riga.slice(indiceDuePunti + 1).trim();

  if (!chiave) {
    throw new Error(`Riga ${numeroRiga}: sinonimo senza parola chiave -> "${riga}"`);
  }

  let peso = 1;
  const matchPeso = resto.match(/\(peso:\s*([\d.]+)\s*\)/i);
  if (matchPeso) {
    peso = Number(matchPeso[1]);
    resto = resto.slice(0, matchPeso.index).trim();
  }

  const varianti = resto
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  return { chiave, varianti, peso };
}

function analizzaRigaPeso(riga, numeroRiga) {
  const indiceDuePunti = riga.indexOf(":");
  if (indiceDuePunti === -1) {
    throw new Error(`Riga ${numeroRiga}: peso malformato, manca ":" -> "${riga}"`);
  }

  const chiave = riga.slice(0, indiceDuePunti).trim();
  const valore = Number(riga.slice(indiceDuePunti + 1).trim());

  if (!chiave || Number.isNaN(valore)) {
    throw new Error(`Riga ${numeroRiga}: peso non valido -> "${riga}"`);
  }

  return { chiave, peso: valore };
}

function nuovaOpzione(id) {
  return {
    id,
    frasi_esempio: [],
    sinonimi_pesati: {},
    peso_parole_chiave: {},
    effetto: {},
  };
}

/**
 * Analizza il testo Markdown di una libreria di opzioni.
 * Restituisce un array di oggetti opzione:
 *   { id, frasi_esempio, sinonimi_pesati, peso_parole_chiave, effetto }
 *
 * Il contenuto di "effetto" viene riportato come coppie chiave/valore
 * così come scritte: il parser non gli attribuisce alcun significato.
 */
export function analizzaLibreria(testoMarkdown) {
  const righe = testoMarkdown.split(/\r?\n/);

  const opzioni = [];
  const idVisti = new Set();
  let opzioneCorrente = null;
  let sezioneCorrente = null;

  righe.forEach((rigaGrezza, indice) => {
    const numeroRiga = indice + 1;
    const riga = rigaGrezza.trimEnd();
    const rigaVuota = riga.trim().length === 0;

    const matchOpzione = riga.match(INTESTAZIONE_OPZIONE);
    if (matchOpzione) {
      const id = matchOpzione[1].trim();
      if (!id) {
        throw new Error(`Riga ${numeroRiga}: intestazione opzione senza identificatore`);
      }
      if (idVisti.has(id)) {
        throw new Error(`Riga ${numeroRiga}: identificatore opzione duplicato "${id}"`);
      }
      idVisti.add(id);
      opzioneCorrente = nuovaOpzione(id);
      opzioni.push(opzioneCorrente);
      sezioneCorrente = null;
      return;
    }

    const matchSezione = riga.match(INTESTAZIONE_SEZIONE);
    if (matchSezione) {
      if (!opzioneCorrente) {
        throw new Error(
          `Riga ${numeroRiga}: sezione "${matchSezione[1]}" trovata prima di qualsiasi "## Opzione:"`
        );
      }
      const nomeSezione = matchSezione[1].trim().toLowerCase();
      const chiaveSezione = NOMI_SEZIONE[nomeSezione];
      if (!chiaveSezione) {
        throw new Error(`Riga ${numeroRiga}: sezione sconosciuta "${matchSezione[1]}"`);
      }
      sezioneCorrente = chiaveSezione;
      return;
    }

    // Titolo principale (# ...) o riga vuota: ignorati ovunque si trovino.
    if (riga.startsWith("# ") || rigaVuota) {
      return;
    }

    // Testo libero fuori da una sezione riconosciuta (es. paragrafi
    // introduttivi scritti dal narratore): ignorato.
    if (!opzioneCorrente || !sezioneCorrente) {
      return;
    }

    const matchElenco = riga.match(RIGA_ELENCO);
    const contenutoRiga = matchElenco ? matchElenco[1].trim() : riga.trim();

    switch (sezioneCorrente) {
      case "frasi_esempio":
        opzioneCorrente.frasi_esempio.push(rimuoviVirgolette(contenutoRiga));
        break;

      case "sinonimi_pesati": {
        const { chiave, varianti, peso } = analizzaRigaSinonimo(contenutoRiga, numeroRiga);
        opzioneCorrente.sinonimi_pesati[chiave] = { varianti, peso };
        break;
      }

      case "peso_parole_chiave": {
        const { chiave, peso } = analizzaRigaPeso(contenutoRiga, numeroRiga);
        opzioneCorrente.peso_parole_chiave[chiave] = peso;
        break;
      }

      case "effetto": {
        const indiceDuePunti = contenutoRiga.indexOf(":");
        if (indiceDuePunti === -1) {
          throw new Error(
            `Riga ${numeroRiga}: riga di "effetto" malformata, atteso "chiave: valore" -> "${contenutoRiga}"`
          );
        }
        const chiave = contenutoRiga.slice(0, indiceDuePunti).trim();
        const valore = contenutoRiga.slice(indiceDuePunti + 1).trim();
        opzioneCorrente.effetto[chiave] = valore;
        break;
      }

      default:
        break;
    }
  });

  if (opzioni.length === 0) {
    throw new Error('Nessuna opzione trovata nella libreria (manca "## Opzione: <id>")');
  }

  return opzioni;
}
