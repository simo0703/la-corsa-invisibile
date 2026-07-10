// Caricatore del pool di contenuto del Cronista per il nodo "1836-torino".
//
// Trasforma il testo grezzo di narratore-corsa-invisibile.md (tabelle
// markdown) nella forma che narratore-simulato.js si aspetta da un pool:
// un oggetto con ottieniFrammenti(slot, contesto) -> Array<Frammento>
// (vedi il contratto documentato in cima a narratore-simulato.js).
//
// Questo file è puro JS, senza I/O: prende il testo già letto come stringa
// e non sa nulla di come è stato ottenuto. Questo lo rende testabile sotto
// Node esattamente come il resto del motore, e riusabile sia dal Worker
// (dove il testo arriva da un import gestito da Wrangler, vedi
// narratore-corsa-invisibile.js) sia dai test (dove il testo arriva da
// fs.readFileSync, cosa che sul Worker in produzione non è possibile: i
// Cloudflare Workers non hanno accesso al filesystem a runtime).
//
// FORMATO ATTESO DEL MARKDOWN: un'intestazione "## Slot: <apertura|sviluppo|eco>"
// seguita da una o più tabelle. In ogni tabella, la colonna "id" identifica
// il frammento, la colonna "testo" è il suo testo (può contenere il
// placeholder {ruolo}), e ogni altra colonna (es. "esito", "ruoloId",
// "competenzaId", "fasciaMargine") è una condizione: il nome della colonna
// è usato così com'è come chiave di contesto da confrontare. Una cella
// vuota su una colonna-condizione significa "nessun vincolo su quell'asse".
//
// Se in futuro un frammento avesse bisogno di logica programmatica (una
// funzione invece di una stringa statica — es. un conteggio, una frase che
// dipende da più variabili insieme), va scritto direttamente in JS invece
// che in questo file: oggi nessun frammento del nodo 1836-torino ne ha
// bisogno, quindi questo caricatore produce solo frammenti-stringa.

const SLOT_VALIDI = ["apertura", "sviluppo", "eco"];

function celleDiRiga(riga) {
  let corpo = riga.trim();
  if (corpo.startsWith("|")) corpo = corpo.slice(1);
  if (corpo.endsWith("|")) corpo = corpo.slice(0, -1);
  return corpo.split("|").map((cella) => cella.trim());
}

function eRigaDiSeparazione(celle) {
  return celle.length > 0 && celle.every((cella) => /^:?-{2,}:?$/.test(cella));
}

// Analizza il markdown e restituisce { apertura: [...], sviluppo: [...], eco: [...] },
// ognuno un array di { id, condizione, testo }.
export function parseFrammenti(markdown) {
  const risultato = { apertura: [], sviluppo: [], eco: [] };
  let slotCorrente = null;
  let intestazioneColonne = null;
  let dentroTabella = false;

  for (const rigaGrezza of markdown.split(/\r?\n/)) {
    const riga = rigaGrezza.trim();

    const matchSlot = riga.match(/^##\s*Slot:\s*(\w+)/i);
    if (matchSlot) {
      const nomeSlot = matchSlot[1];
      if (!SLOT_VALIDI.includes(nomeSlot)) {
        throw new Error(
          `narratore-corsa-invisibile-loader: slot sconosciuto "${nomeSlot}" nell'intestazione ` +
            `(validi: ${SLOT_VALIDI.join(", ")})`
        );
      }
      slotCorrente = nomeSlot;
      intestazioneColonne = null;
      dentroTabella = false;
      continue;
    }

    if (!riga.startsWith("|")) {
      intestazioneColonne = null;
      dentroTabella = false;
      continue;
    }

    const celle = celleDiRiga(riga);

    if (eRigaDiSeparazione(celle)) {
      dentroTabella = true;
      continue;
    }

    if (!intestazioneColonne) {
      intestazioneColonne = celle;
      continue;
    }

    if (!dentroTabella) continue; // riga con "|" prima della separazione: ignorata

    if (!slotCorrente) {
      throw new Error(
        "narratore-corsa-invisibile-loader: trovata una tabella prima di un'intestazione " +
          '"## Slot: ..."'
      );
    }

    const frammento = { id: null, condizione: {}, testo: null };
    intestazioneColonne.forEach((nomeColonna, indice) => {
      const valore = celle[indice] ?? "";
      if (nomeColonna === "id") frammento.id = valore;
      else if (nomeColonna === "testo") frammento.testo = valore;
      else if (valore !== "") frammento.condizione[nomeColonna] = valore;
    });

    if (!frammento.id) {
      throw new Error(`narratore-corsa-invisibile-loader: riga senza "id" nello slot "${slotCorrente}"`);
    }
    if (!frammento.testo) {
      throw new Error(
        `narratore-corsa-invisibile-loader: frammento "${frammento.id}" senza colonna "testo"`
      );
    }

    risultato[slotCorrente].push(frammento);
  }

  return risultato;
}

// Un frammento si applica se, per ogni chiave nella sua condizione, il
// valore corrispondente nel contesto coincide. Un frammento senza
// condizioni (oggetto vuoto) si applica sempre.
function condizioneSoddisfatta(condizione, contesto) {
  return Object.entries(condizione).every(([chiave, valore]) => contesto[chiave] === valore);
}

// Costruisce un pool pronto per componiNarrazione() a partire dal testo
// grezzo del markdown.
export function creaPool(testoMarkdown) {
  const frammentiPerSlot = parseFrammenti(testoMarkdown);
  return {
    ottieniFrammenti(slot, contesto) {
      const elenco = frammentiPerSlot[slot];
      if (!elenco) throw new Error(`narratore-corsa-invisibile-loader: slot sconosciuto "${slot}"`);
      return elenco.filter((frammento) => condizioneSoddisfatta(frammento.condizione, contesto));
    },
  };
}
