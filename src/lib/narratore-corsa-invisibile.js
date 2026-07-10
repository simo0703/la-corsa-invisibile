// Pool di frammenti narrativi VERI per il Cronista (src/lib/narratore-simulato.js),
// scoped al Nodo Temporale "1836-torino" (La Scuola del Decalogo) — decisione
// del 10/07/2026: partire da un solo nodo per validare l'approccio prima di
// scalare agli altri 4.
//
// Non ancora collegato a GameSession.js: oggi i nodi usano solo effetti fissi
// (vedi CLAUDE.md), non generano un `esito` pieno/parziale/fallimento. Questo
// pool è pronto per quando "collegare le competenze al flusso dei nodi" (voce
// in "Cosa manca" del log delle decisioni) sarà fatto e GameSession potrà
// passare al Cronista un contesto con `esito` reale.
//
// VARIABILI attese in contesto.variabili quando questo pool viene usato:
//   { ruolo: "<nome del ruolo, es. 'L'Esploratore'>" }
// (nessun altro placeholder è usato qui per ora)
//
// Assi di variazione supportati (decisione 10/07/2026: esito + ruolo +
// competenza, oltre alla fascia di margine già gestita dal motore per l'eco):
//   apertura  — varia per esito (baseline) e per ruoloId (flavor del personaggio
//               in azione; non anticipa l'esito, resta un aggancio)
//   sviluppo  — varia per esito (baseline, il cuore del cosa succede) e per
//               competenzaId (come si è manifestata l'azione)
//   eco       — varia per esito (baseline) e per fasciaMargine (quanto la
//               tensione accumulata si fa sentire)

// Un frammento si applica se, per ogni chiave nella sua `condizione`, il
// valore corrispondente nel contesto coincide (o è incluso, se la condizione
// specifica un array di valori accettati). Un frammento senza `condizione`
// si applica sempre.
function condizioneSoddisfatta(condizione, contesto) {
  if (!condizione) return true;
  return Object.entries(condizione).every(([chiave, valore]) => {
    const attesi = Array.isArray(valore) ? valore : [valore];
    return attesi.includes(contesto[chiave]);
  });
}

const FRAMMENTI = {
  apertura: [
    // Baseline per esito: garantisce sempre almeno un candidato.
    { id: "apertura-pieno-1", condizione: { esito: "pieno" },
      testo: "Il fiato riprende dopo lo sforzo, e per un istante il Decalogo sembra reggersi da solo." },
    { id: "apertura-pieno-2", condizione: { esito: "pieno" },
      testo: "La Marmora osserva senza dire nulla — ma chi conosce il generale sa che il silenzio, qui, è approvazione." },
    { id: "apertura-parziale-1", condizione: { esito: "parziale" },
      testo: "Non tutto fila liscio, ma nemmeno crolla: il Decalogo lascia comunque il segno." },
    { id: "apertura-parziale-2", condizione: { esito: "parziale" },
      testo: "Qualcosa si incrina nell'ordine previsto, ma la squadra tiene." },
    { id: "apertura-fallimento-1", condizione: { esito: "fallimento" },
      testo: "Il percorso vince questa mano: la nebbia di Torino inghiotte ogni piano fatto a tavolino." },
    { id: "apertura-fallimento-2", condizione: { esito: "fallimento" },
      testo: "Il Decalogo non perdona: quello che doveva essere semplice, oggi non lo è stato." },

    // Flavor per ruolo: descrivono il personaggio in azione, restano neutri
    // sull'esito (che si scopre nello sviluppo), quindi non filtrano per esito.
    { id: "apertura-ruolo-esploratore", condizione: { ruoloId: "esploratore" },
      testo: "{ruolo} è già avanti di due falcate, gli occhi fissi sul percorso nella nebbia." },
    { id: "apertura-ruolo-fanfarista", condizione: { ruoloId: "fanfarista" },
      testo: "{ruolo} scandisce il ritmo a fiato, prima ancora che gli altri si muovano." },
    { id: "apertura-ruolo-custode", condizione: { ruoloId: "custode" },
      testo: "{ruolo} controlla la fila con un'occhiata, contando teste prima di contare metri." },
    { id: "apertura-ruolo-incursore", condizione: { ruoloId: "incursore" },
      testo: "{ruolo} non aspetta il segnale: è già dentro il primo fossato." },
  ],

  sviluppo: [
    // Baseline per esito: il cuore del testo, cosa succede davvero.
    { id: "sviluppo-pieno-1", condizione: { esito: "pieno" },
      testo: "Il gesto è preciso, il tempo giusto: il tratto si supera senza sbavature." },
    { id: "sviluppo-pieno-2", condizione: { esito: "pieno" },
      testo: "La squadra passa il tratto più duro come se lo avesse già corso cento volte." },
    { id: "sviluppo-parziale-1", condizione: { esito: "parziale" },
      testo: "Il tratto si supera, ma con un prezzo: qualcosa resta indietro, un fiato, un attimo di esitazione." },
    { id: "sviluppo-parziale-2", condizione: { esito: "parziale" },
      testo: "Non è la prova migliore vista da La Marmora, ma è comunque una prova superata." },
    { id: "sviluppo-fallimento-1", condizione: { esito: "fallimento" },
      testo: "Il piede scivola, l'ordine si rompe: il Decalogo si prende il suo tributo, oggi." },
    { id: "sviluppo-fallimento-2", condizione: { esito: "fallimento" },
      testo: "Quello che doveva essere metodo diventa improvvisazione, e si vede." },

    // Flavor per competenza: come si è manifestata l'azione, indipendente
    // dall'esito (che resta nel frammento baseline scelto per lo stesso slot
    // in un'altra chiamata — qui descriviamo SOLO il "come", non il "quanto bene").
    { id: "sviluppo-competenza-cadenza", condizione: { competenzaId: "cadenza" },
      testo: "È la Cadenza a decidere: le gambe rispondono prima che la testa finisca di pensare." },
    { id: "sviluppo-competenza-precisione", condizione: { competenzaId: "precisione" },
      testo: "È la Precisione a fare la differenza: ogni appoggio calcolato, nessun passo sprecato." },
    { id: "sviluppo-competenza-spiritoDiCorpo", condizione: { competenzaId: "spiritoDiCorpo" },
      testo: "È lo Spirito di Corpo a reggere il tratto: nessuno molla, perché nessuno vuole essere quello che molla." },
    { id: "sviluppo-competenza-passoAvanti", condizione: { competenzaId: "passoAvanti" },
      testo: "È il Passo Avanti a spingere oltre la fatica: la paura di fermarsi pesa più di quella di cadere." },
    { id: "sviluppo-competenza-ancoraggio", condizione: { competenzaId: "ancoraggio" },
      testo: "È l'Ancoraggio a tenere in piedi tutto il resto: la testa resta ferma anche quando le gambe tremano." },
  ],

  eco: [
    // Baseline per esito: garantisce sempre almeno un candidato.
    { id: "eco-pieno-1", condizione: { esito: "pieno" },
      testo: "Un altro passo del Decalogo segnato, e nessuno lo dimentica." },
    { id: "eco-parziale-1", condizione: { esito: "parziale" },
      testo: "Resta il segno di quello che è costato, anche se il tratto è alle spalle." },
    { id: "eco-fallimento-1", condizione: { esito: "fallimento" },
      testo: "Il Decalogo prende nota. La Marmora, forse, anche." },

    // Fascia di margine: lega l'esito a quanto sta salendo la tensione
    // accumulata nella partita (calcolata automaticamente dal motore).
    { id: "eco-margine-basso", condizione: { fasciaMargine: "basso" },
      testo: "Il piano regge ancora, per ora." },
    { id: "eco-margine-medio", condizione: { fasciaMargine: "medio" },
      testo: "Qualcosa comincia a scricchiolare sotto la superficie del piano." },
    { id: "eco-margine-alto", condizione: { fasciaMargine: "alto" },
      testo: "Il margine si assottiglia: un altro passo falso, e sarà complicazione." },
    { id: "eco-margine-critico", condizione: { fasciaMargine: "critico" },
      testo: "Il piano ha ceduto: il peso accumulato si fa sentire tutto insieme, ora." },
  ],
};

export function ottieniFrammenti(slot, contesto) {
  const elenco = FRAMMENTI[slot];
  if (!elenco) throw new Error(`narratore-corsa-invisibile: slot sconosciuto "${slot}"`);
  return elenco.filter((frammento) => condizioneSoddisfatta(frammento.condizione, contesto));
}
