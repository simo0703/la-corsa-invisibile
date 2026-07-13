import { GAME_CONFIG } from "../game-config.js";

// Creazione e risoluzione basate sulle competenze personali. Collegato al
// flusso dei nodi: GameSession.js importa sia creaCompetenzeIniziali() (usata
// in /join) sia risolviAzione() (usata in /scegli, per le risposte con
// competenzaRichiesta). Non tutte le risposte dei 5 nodi usano ancora un
// tiro reale — quelle senza competenzaRichiesta restano a effetto fisso,
// come previsto dal modello di ramificazione in game-config.js.

// Costruisce le competenze iniziali di un personaggio in base al ruolo
// scelto e a una distribuzione libera dei punti extra decisa dal giocatore.
// `distribuzioneExtra` è un oggetto { competenzaId: quanti punti extra },
// la somma non può superare puntiExtra e nessuna competenza può superare
// valoreMassimo.
export function creaCompetenzeIniziali(ruoloId, distribuzioneExtra = {}) {
  const ruolo = GAME_CONFIG.ruoli.find((r) => r.id === ruoloId);
  if (!ruolo) throw new Error(`Ruolo sconosciuto: ${ruoloId}`);

  const { valorePrincipale, valoreAltre, puntiExtra, valoreMassimo } =
    GAME_CONFIG.creazionePersonaggio;

  const competenze = {};
  for (const id of Object.keys(GAME_CONFIG.competenze)) {
    competenze[id] = id === ruolo.competenzaPrincipale ? valorePrincipale : valoreAltre;
  }

  const totaleExtraRichiesto = Object.values(distribuzioneExtra).reduce((a, b) => a + b, 0);
  if (totaleExtraRichiesto > puntiExtra) {
    throw new Error(
      `Punti extra assegnati (${totaleExtraRichiesto}) superano il massimo consentito (${puntiExtra})`
    );
  }

  for (const [id, punti] of Object.entries(distribuzioneExtra)) {
    if (!(id in competenze)) throw new Error(`Competenza sconosciuta: ${id}`);
    competenze[id] = Math.min(competenze[id] + punti, valoreMassimo);
  }

  return competenze;
}

// Tira il dado correttivo (default 1d6, il valore configurato in
// GAME_CONFIG.risoluzione.dadoFacce -- uguale per tutti dal ribilanciamento
// del tiro). `facce` può essere sovrascritto dal chiamante: il meccanismo
// resta per compatibilità (GameSession sa ancora leggere `ruolo.dadoFacce`
// sulla competenza principale), ma nessun ruolo lo usa più.
export function tiraDado(facce = GAME_CONFIG.risoluzione.dadoFacce) {
  return 1 + Math.floor(Math.random() * facce);
}

// Risolve un'azione: punteggio di competenza + dado, confrontato con le
// due soglie configurate. Ritorna il totale, il tiro grezzo e l'esito.
// `facce` si propaga a tiraDado() solo quando il dado non è forzato.
export function risolviAzione(punteggioCompetenza, tiroDadoForzato = null, facce = GAME_CONFIG.risoluzione.dadoFacce) {
  const dado = tiroDadoForzato ?? tiraDado(facce);
  const totale = punteggioCompetenza + dado;
  const { sogliaSuccessoPieno, sogliaSuccessoParziale } = GAME_CONFIG.risoluzione;

  let esito;
  if (totale >= sogliaSuccessoPieno) esito = "pieno";
  else if (totale >= sogliaSuccessoParziale) esito = "parziale";
  else esito = "fallimento";

  return { competenza: punteggioCompetenza, dado, totale, esito };
}
