import { GAME_CONFIG } from "../game-config.js";

// Un Durable Object per stanza/sessione: isolamento totale tra sessioni diverse.
// Le risorse sono a livello di SQUADRA (party-level), non per singolo personaggio:
// questa è la differenza architetturale rispetto a La Soglia / The Ledger Game,
// e va tenuta a mente in ogni estensione futura dello stato.

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
        giocatori: [], // { id, nome, ruolo }
        risorseDiSquadra: {
          cadenza: 0,
          spiritoDiCorpo: 0,
          passoAvanti: 0,
        },
        nodoAttivo: null, // id di uno dei nodiTemporali in game-config.js
        richiestaIndice: 0, // a che punto della sequenza di richieste del nodo siamo
        storicoScelte: [], // { richiestaId, risposteTesto, esito, timestamp }
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
    if (session.storicoScelte === undefined) {
      session.storicoScelte = [];
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

    if (url.pathname.endsWith("/join") && request.method === "POST") {
      const { nome, ruolo } = await request.json();
      const session = await this.initState();
      session.giocatori.push({ id: crypto.randomUUID(), nome, ruolo });
      await this.state.storage.put("session", session);
      return Response.json(session);
    }

    if (url.pathname.endsWith("/risorse") && request.method === "POST") {
      const { risorsa, delta } = await request.json();
      const session = await this.initState();
      if (!(risorsa in session.risorseDiSquadra)) {
        return new Response("Risorsa sconosciuta", { status: 400 });
      }
      session.risorseDiSquadra[risorsa] += delta;
      await this.state.storage.put("session", session);
      return Response.json(session);
    }

    // Avvia un Nodo Temporale: azzera l'indice di richiesta, non tocca lo storico
    if (url.pathname.endsWith("/avvia-nodo") && request.method === "POST") {
      const { nodoId } = await request.json();
      const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === nodoId);
      if (!nodo) return new Response("Nodo sconosciuto", { status: 400 });
      const session = await this.initState();
      session.nodoAttivo = nodoId;
      session.richiestaIndice = 0;
      await this.state.storage.put("session", session);
      return Response.json({ session, richiestaAttiva: nodo.richieste[0] ?? null });
    }

    // Richiesta attualmente attiva nel nodo in corso (situazione + risposte disponibili)
    if (url.pathname.endsWith("/richiesta-attiva") && request.method === "GET") {
      const session = await this.initState();
      const richiestaAttiva = this.trovaRichiestaAttiva(session);
      return Response.json({ session, richiestaAttiva });
    }

    // Un giocatore/la squadra sceglie una delle risposte pre-scritte:
    // applica gli effetti alle risorse di squadra, registra la scelta nello
    // storico, avanza alla richiesta successiva del nodo.
    if (url.pathname.endsWith("/scegli") && request.method === "POST") {
      const { risposteIndice } = await request.json();
      const session = await this.initState();
      const richiestaAttiva = this.trovaRichiestaAttiva(session);
      if (!richiestaAttiva) {
        return new Response("Nessuna richiesta attiva: avvia prima un nodo", { status: 400 });
      }
      const risposta = richiestaAttiva.risposte[risposteIndice];
      if (!risposta) return new Response("Risposta sconosciuta", { status: 400 });

      for (const [risorsa, delta] of Object.entries(risposta.effetti || {})) {
        session.risorseDiSquadra[risorsa] = (session.risorseDiSquadra[risorsa] || 0) + delta;
      }
      session.storicoScelte.push({
        richiestaId: richiestaAttiva.id,
        risposteTesto: risposta.testo,
        esito: risposta.esito,
        timestamp: new Date().toISOString(),
      });
      session.richiestaIndice += 1;
      await this.state.storage.put("session", session);

      const prossimaRichiesta = this.trovaRichiestaAttiva(session);
      const esitoNodo = prossimaRichiesta ? null : this.valutaEsitoNodo(session);
      return Response.json({ session, esito: risposta.esito, prossimaRichiesta, esitoNodo });
    }

    return new Response("Not found", { status: 404 });
  }

  trovaRichiestaAttiva(session) {
    if (!session.nodoAttivo) return null;
    const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === session.nodoAttivo);
    if (!nodo) return null;
    return nodo.richieste[session.richiestaIndice] ?? null; // null = nodo esaurito
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
