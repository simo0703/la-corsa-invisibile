import { GAME_CONFIG } from "../game-config.js";
import { creaCompetenzeIniziali, risolviAzione } from "../lib/risoluzione.js";
import { componiNarrazione } from "../lib/narratore-simulato.js";
import { trovaPoolPerNodo } from "../lib/narratore-registro-pool.js";

// Un Durable Object per stanza/sessione: isolamento totale tra sessioni diverse.
// Le risorse sono a livello di SQUADRA (party-level), non per singolo personaggio:
// questa è la differenza architetturale rispetto a La Soglia / The Ledger Game,
// e va tenuta a mente in ogni estensione futura dello stato.
//
// Tracce introdotte in questo passaggio, oltre alle risorse di squadra:
// - orologio: avanza di scelta in scelta, misura il tempo/tensione che passa.
// - margine: cresce o scende in base agli effetti delle risposte scelte;
//   superata la soglia (GAME_CONFIG.margineSoglia) scatta una complicazione.
//   ASSUNZIONE DA VERIFICARE: la definizione di "Margine" qui implementata
//   (distanza dal fallimento) e' un'ipotesi di lavoro, non ancora confermata
//   nei dettagli -- funziona come traccia generica pronta a essere corretta.
// - ramificazione dei nodi: ogni risposta puo' indicare `prossima` (id della
//   richiesta successiva). Se manca, si procede in sequenza come prima
//   (compatibile con i nodi gia' scritti in game-config.js).
//
// Risposte con tiro (risoluzione.js collegato qui): una risposta puo'
// dichiarare `competenzaRichiesta: "<id competenza>"` invece di (o oltre) un
// effetto fisso. Quando presente:
// - il punteggio si legge da giocatore.competenze[competenzaRichiesta]
//   (assegnate a /join, vedi sotto) e si risolve con risolviAzione();
// - gli effetti applicati vengono da `risposta.effettiPerEsito[esitoDelTiro]`
//   invece che da `risposta.effetti` (che resta il campo usato dalle
//   risposte SENZA tiro: le due forme convivono nello stesso nodo);
// - il testo mostrato viene da `risposta.esito[esitoDelTiro]` (un oggetto
//   per le risposte con tiro) invece che da `risposta.esito` come stringa
//   fissa (usato dalle risposte senza tiro).
// Una risposta senza `competenzaRichiesta` si comporta esattamente come
// prima di questo passaggio: effetto fisso, testo fisso, nessun tiro.
//
// Il Cronista (narratore-simulato.js) entra in gioco SOLO per le risposte
// con tiro: solo lì esiste un vero esito a tre tier da cui comporre un
// testo variato: una risposta a effetto fisso ha un solo esito, non un
// tier. Il pool di contenuto da usare si cerca in narratore-registro-pool.js
// (mappa nodoId -> pool, mai una stringa di nodo scritta qui): se il nodo
// attivo non ha un pool registrato (o il pool non si carica in questo
// ambiente, vedi quel file), si ricade sul testo statico per tier già
// scritto in game-config.js -- fallback silenzioso, stesso trattamento di
// un nodo che semplicemente non ha ancora il suo pool. Quando il Cronista
// compone un testo, SOSTITUISCE quello statico (non lo affianca).
// contesto.storicoFrammenti resta sempre [] per ora (decisione: nessun
// nuovo campo di stato finché non emerge un bisogno reale — vedi il log
// delle decisioni).

export class GameSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
  }

  async initState() {
    let stored = await this.state.storage.get("session");
    if (!stored) {
      stored = {
        gameId: GAME_CONFIG.gameId,
        creata_il: new Date().toISOString(),
        giocatori: [], // { id, nome, ruolo, competenze, comandante } -- assegnati a /join
        risorseDiSquadra: {
          cadenza: 0,
          spiritoDiCorpo: 0,
          passoAvanti: 0,
        },
        orologio: 0, // avanza a ogni scelta risolta
        margine: 0, // sale/scende con gli effetti delle risposte
        nodoAttivo: null, // id di uno dei nodiTemporali in game-config.js
        richiestaIndice: 0, // fallback per compatibilita': posizione in sequenza
        richiestaAttivaId: null, // id della richiesta corrente (supporta ramificazioni)
        storicoScelte: [], // { richiestaId, risposteTesto, esito, giocatoreId, tiro, timestamp }
        storicoNodo: [], // { nodoId, iniziato_il, concluso_il, esitoFinale }
        aiUsageStanza: 0, // contatore generazioni AI usate in questa stanza
        // Migrazione automatica: ogni nuovo campo va aggiunto qui E
        // nella funzione migrateState() sotto, altrimenti le sessioni
        // create prima dell'aggiornamento falliscono in silenzio.
      };
      await this.state.storage.put("session", stored);
    }
    return this.migrateState(stored);
  }

  // Applica ai record vecchi eventuali campi nuovi introdotti dopo la loro creazione.
  migrateState(session) {
    let changed = false;
    if (session.nodoAttivo === undefined) {
      session.nodoAttivo = null;
      changed = true;
    }
    if (session.richiestaIndice === undefined) {
      session.richiestaIndice = 0;
      changed = true;
    }
    if (session.richiestaAttivaId === undefined) {
      session.richiestaAttivaId = null;
      changed = true;
    }
    if (session.storicoScelte === undefined) {
      session.storicoScelte = [];
      changed = true;
    }
    if (session.storicoNodo === undefined) {
      session.storicoNodo = [];
      changed = true;
    }
    if (session.orologio === undefined) {
      session.orologio = 0;
      changed = true;
    }
    if (session.margine === undefined) {
      session.margine = 0;
      changed = true;
    }
    if (session.aiUsageStanza === undefined) {
      session.aiUsageStanza = 0;
      changed = true;
    }
    if (changed) this.state.storage.put("session", session);
    return session;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/state") && request.method === "GET") {
      const session = await this.initState();
      return Response.json(session);
    }

    // Il comandante/narratore e' chi crea la stanza, ma non e' un ruolo a
    // parte: e' il PRIMO giocatore che si unisce a una stanza appena
    // creata (nessuno ancora in session.giocatori). Gioca anche lui con
    // uno dei 4 ruoli come chiunque altro; il flag comandante gli sblocca
    // solo controlli in piu' lato client (vedi public/index.html), non
    // permessi diversi qui nel Worker -- nessun controllo di autorizzazione
    // e' stato aggiunto a nessun endpoint, coerente con il resto
    // dell'API (nessuna infrastruttura di sessione/token esiste nel
    // Worker). Limite noto: se il link viene condiviso prima che il
    // creatore stesso faccia /join, un altro giocatore potrebbe diventare
    // comandante per primo -- accettabile per ora.
    if (url.pathname.endsWith("/join") && request.method === "POST") {
      const { nome, ruolo } = await request.json();
      // Competenze base per il ruolo (principale + secondarie, nessun punto
      // extra: la loro distribuzione libera resta un passo a parte).
      let competenze;
      try {
        competenze = creaCompetenzeIniziali(ruolo, {});
      } catch {
        return new Response("Ruolo sconosciuto", { status: 400 });
      }
      const session = await this.initState();
      const comandante = session.giocatori.length === 0;
      session.giocatori.push({ id: crypto.randomUUID(), nome, ruolo, competenze, comandante });
      await this.state.storage.put("session", session);
      return Response.json(session);
    }

    // Le chiavi accettate sono le risorse di squadra oppure "margine" --
    // stesso trattamento che "margine" gia' riceve nel ciclo di effetti di
    // /scegli piu' sotto (una pseudo-risorsa, non nell'oggetto
    // risorseDiSquadra ma modificabile con lo stesso pattern delta).
    // Nessun controllo su chi chiama: come per ogni altro endpoint di
    // questo Worker, il vincolo "solo il comandante" e' lato client.
    if (url.pathname.endsWith("/risorse") && request.method === "POST") {
      const { risorsa, delta } = await request.json();
      const session = await this.initState();
      if (risorsa === "margine") {
        session.margine += delta;
      } else if (risorsa in session.risorseDiSquadra) {
        session.risorseDiSquadra[risorsa] += delta;
      } else {
        return new Response("Risorsa sconosciuta", { status: 400 });
      }
      await this.state.storage.put("session", session);
      return Response.json(session);
    }

    // Avvia un Nodo Temporale: parte dalla prima richiesta del nodo,
    // non tocca lo storico. Registra l'inizio nel diario del nodo.
    if (url.pathname.endsWith("/avvia-nodo") && request.method === "POST") {
      const { nodoId } = await request.json();
      const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === nodoId);
      if (!nodo) return new Response("Nodo sconosciuto", { status: 400 });
      const session = await this.initState();
      const primaRichiesta = nodo.richieste[0] ?? null;
      session.nodoAttivo = nodoId;
      session.richiestaIndice = 0;
      session.richiestaAttivaId = primaRichiesta ? primaRichiesta.id : null;
      session.storicoNodo.push({
        nodoId,
        iniziato_il: new Date().toISOString(),
        concluso_il: null,
        esitoFinale: null,
      });
      await this.state.storage.put("session", session);
      return Response.json({ session, richiestaAttiva: primaRichiesta });
    }

    // Richiesta attualmente attiva nel nodo in corso (situazione + risposte disponibili)
    if (url.pathname.endsWith("/richiesta-attiva") && request.method === "GET") {
      const session = await this.initState();
      const richiestaAttiva = this.trovaRichiestaAttiva(session);
      return Response.json({ session, richiestaAttiva });
    }

    // Un giocatore/la squadra sceglie una delle risposte pre-scritte:
    // applica gli effetti (risorse di squadra + margine), fa avanzare
    // l'orologio, registra la scelta nello storico (con chi l'ha fatta),
    // determina la prossima richiesta (ramificazione se `prossima` e'
    // indicata, altrimenti sequenza).
    // `giocatoreId` e' obbligatorio e deve corrispondere a un giocatore gia'
    // unito alla stanza con /join: senza, non sapremmo mai chi ha scelto.
    if (url.pathname.endsWith("/scegli") && request.method === "POST") {
      const { risposteIndice, giocatoreId } = await request.json();
      const session = await this.initState();

      if (!giocatoreId) {
        return new Response("giocatoreId mancante: serve sapere chi sta scegliendo", { status: 400 });
      }
      const giocatore = session.giocatori.find((g) => g.id === giocatoreId);
      if (!giocatore) {
        return new Response("giocatoreId sconosciuto: nessun giocatore con questo id nella stanza", {
          status: 400,
        });
      }

      const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === session.nodoAttivo);
      const richiestaAttiva = this.trovaRichiestaAttiva(session);
      if (!nodo || !richiestaAttiva) {
        return new Response("Nessuna richiesta attiva: avvia prima un nodo", { status: 400 });
      }
      const risposta = richiestaAttiva.risposte[risposteIndice];
      if (!risposta) return new Response("Risposta sconosciuta", { status: 400 });

      // Risposta con tiro: il punteggio di competenza del giocatore che sta
      // scegliendo decide l'esito (pieno/parziale/fallimento), che a sua
      // volta seleziona quali effetti applicare e quale testo mostrare.
      // Risposta senza `competenzaRichiesta`: effetto fisso e testo fisso,
      // esattamente come prima di questo passaggio.
      let tiro = null;
      let effettiDaApplicare = risposta.effetti || {};
      let testoEsito = risposta.esito;
      if (risposta.competenzaRichiesta) {
        const punteggio = giocatore.competenze[risposta.competenzaRichiesta] ?? 0;
        tiro = risolviAzione(punteggio);
        effettiDaApplicare = (risposta.effettiPerEsito && risposta.effettiPerEsito[tiro.esito]) || {};
        testoEsito = (risposta.esito && risposta.esito[tiro.esito]) || null;
      }

      // Effetti: le chiavi possono essere risorse di squadra oppure "margine".
      const margineDeltaAzione = effettiDaApplicare.margine ?? 0;
      for (const [chiave, delta] of Object.entries(effettiDaApplicare)) {
        if (chiave === "margine") {
          session.margine += delta;
        } else {
          session.risorseDiSquadra[chiave] = (session.risorseDiSquadra[chiave] || 0) + delta;
        }
      }

      // Cronista: solo per risposte con tiro, solo se il nodo attivo ha un
      // pool disponibile (vedi commento in cima al file). Sostituisce
      // testoEsito quando applicabile.
      if (tiro) {
        const pool = await trovaPoolPerNodo(session.nodoAttivo);
        if (pool) {
          const ruoloGiocatore = GAME_CONFIG.ruoli.find((r) => r.id === giocatore.ruolo);
          const { testo } = componiNarrazione(pool, {
            esito: tiro.esito,
            competenzaId: risposta.competenzaRichiesta,
            ruoloId: giocatore.ruolo,
            margine: { valore: session.margine, soglia: GAME_CONFIG.margineSoglia ?? null, delta: margineDeltaAzione },
            variabili: { ruolo: ruoloGiocatore?.nomeConArticolo ?? giocatore.ruolo },
            storicoFrammenti: [],
          });
          testoEsito = testo;
        }
      }

      session.orologio += 1;

      session.storicoScelte.push({
        richiestaId: richiestaAttiva.id,
        risposteTesto: risposta.testo,
        esito: testoEsito,
        giocatoreId,
        tiro,
        timestamp: new Date().toISOString(),
      });

      // Complicazione da margine: soglia configurabile in game-config.js.
      // Al superamento, segnaliamo la complicazione e riportiamo il margine
      // a meta' soglia (attenuazione, non azzeramento) -- punto da confermare.
      let complicazione = null;
      const soglia = GAME_CONFIG.margineSoglia ?? null;
      if (soglia !== null && session.margine >= soglia) {
        complicazione = GAME_CONFIG.margineComplicazioneTesto
          ?? "Il margine e' esaurito: qualcosa va storto.";
        session.margine = Math.floor(soglia / 2);
      }

      // Prossima richiesta: attenzione, tre casi distinti.
      // - campo "prossima" assente -> nodo non ramificato, si va in sequenza (compatibilità).
      // - "prossima": "<id>" -> ramificazione esplicita verso quella richiesta.
      // - "prossima": null (scritto esplicitamente) -> fine ramo, il nodo si chiude qui,
      //   anche se nell'array ci sono altre richieste dopo. Necessario per non "sbandare"
      //   in sequenza per errore in un nodo che usa la ramificazione.
      let prossimaRichiesta = null;
      if (Object.prototype.hasOwnProperty.call(risposta, "prossima")) {
        prossimaRichiesta = risposta.prossima
          ? nodo.richieste.find((r) => r.id === risposta.prossima) ?? null
          : null;
      } else {
        const indiceCorrente = nodo.richieste.findIndex((r) => r.id === richiestaAttiva.id);
        prossimaRichiesta = nodo.richieste[indiceCorrente + 1] ?? null;
      }
      session.richiestaIndice += 1;
      session.richiestaAttivaId = prossimaRichiesta ? prossimaRichiesta.id : null;

      let esitoNodo = null;
      if (!prossimaRichiesta) {
        esitoNodo = this.valutaEsitoNodo(session);
        const diario = session.storicoNodo[session.storicoNodo.length - 1];
        if (diario && diario.nodoId === session.nodoAttivo && !diario.concluso_il) {
          diario.concluso_il = new Date().toISOString();
          diario.esitoFinale = esitoNodo;
        }
      }

      await this.state.storage.put("session", session);
      return Response.json({ session, esito: testoEsito, prossimaRichiesta, esitoNodo, complicazione, tiro });
    }

    return new Response("Not found", { status: 404 });
  }

  trovaRichiestaAttiva(session) {
    if (!session.nodoAttivo) return null;
    const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === session.nodoAttivo);
    if (!nodo) return null;
    if (session.richiestaAttivaId) {
      return nodo.richieste.find((r) => r.id === session.richiestaAttivaId) ?? null;
    }
    return nodo.richieste[session.richiestaIndice] ?? null; // fallback legacy
  }

  // Valutazione generica delle soglie di un nodo, a prescindere dal nodo:
  // ogni nuovo nodo aggiunto in game-config.js funziona qui senza modifiche.
  valutaEsitoNodo(session) {
    const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === session.nodoAttivo);
    if (!nodo || !nodo.esitoFinale) return null;

    for (const variante of nodo.esitoFinale.varianti) {
      const soddisfatta = Object.entries(variante.condizione).every(([risorsa, soglia]) => {
        const valore = session.risorseDiSquadra[risorsa] ?? 0;
        if (soglia.min !== undefined && valore < soglia.min) return false;
        if (soglia.max !== undefined && valore > soglia.max) return false;
        return true;
      });
      if (soddisfatta) return variante.testo;
    }
    return nodo.esitoFinale.default;
  }
}
