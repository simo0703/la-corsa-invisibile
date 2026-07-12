import { GameSession } from "./durable-objects/GameSession.js";
import { GAME_CONFIG } from "./game-config.js";
import { registraGiocatore, accediGiocatore, otteniStatoProfilo, assegnaBonusProfilo } from "./lib/profili-giocatore.js";

export { GameSession };

// Messaggi in italiano per il client, mappati dal codice macchina restituito
// da src/lib/profili-giocatore.js (che resta testabile senza sapere nulla
// di HTTP). "credenziali_non_valide" copre sia login quanto sia
// registrazione con un pin mal formato prima ancora del controllo nome: qui
// serve solo per /profilo/accedi, dove l'ambiguità è voluta (requisito 2).
const MESSAGGI_ERRORE_PROFILO = {
  nome_troppo_corto: "Nome troppo corto",
  nome_troppo_lungo: "Nome troppo lungo",
  pin_formato_non_valido: "Il PIN deve essere di 6 cifre numeriche",
  nome_gia_in_uso: "Nome già in uso",
  credenziali_non_valide: "Credenziali non valide",
  competenza_non_valida: "Competenza non valida",
  nessun_bonus_disponibile: "Nessun bonus disponibile da assegnare",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Config pubblica del gioco (terminologia, ruoli, nodi) — letta dal client
    if (url.pathname === "/api/config") {
      return Response.json(GAME_CONFIG);
    }

    // Crea una nuova stanza di gioco: nessun codice richiesto, il gioco è gratuito.
    // Chi crea la stanza condivide poi il link con il resto della squadra.
    //
    // tokenCreazione: generato QUI, prima che il link esista o venga
    // condiviso — è la prova "sei tu il creatore" da presentare al
    // successivo POST /join per ottenere il ruolo di comandante (vedi
    // GameSession.js, endpoint /crea e /join). Restituito al chiamante una
    // sola volta, in questa risposta; salvato lato Durable Object da /crea.
    if (url.pathname === "/api/crea-stanza" && request.method === "POST") {
      const roomId = crypto.randomUUID();
      const tokenCreazione = crypto.randomUUID();
      const id = env.GAME_SESSION.idFromName(roomId);
      const stub = env.GAME_SESSION.get(id);
      const risposta = await stub.fetch(
        new Request(`https://internal/crea`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tokenCreazione }),
        })
      );
      const session = await risposta.json();
      // roomId è indispensabile al client: senza di esso non può più parlare
      // con questa stanza (tutte le rotte /api/stanza/{roomId}/... lo richiedono).
      return Response.json({ roomId, tokenCreazione, session });
    }

    // Profilo giocatore persistente (Fase 1: solo schema + registrazione/
    // accesso -- NESSUN collegamento a /join o a una stanza esistente,
    // vedi DECISIONI_LA_CORSA_INVISIBILE.md). Usa lo stesso D1 di
    // access_codes/subscribers (env.DB): dati non legati a una singola
    // stanza, a differenza dello stato di GameSession.
    if (url.pathname === "/profilo/registra" && request.method === "POST") {
      const { nome, pin } = await request.json();
      const risultato = await registraGiocatore(env.DB, nome, pin);
      if (!risultato.successo) {
        const status = risultato.errore === "nome_gia_in_uso" ? 409 : 400;
        return Response.json({ errore: MESSAGGI_ERRORE_PROFILO[risultato.errore] }, { status });
      }
      // token di sessione (30 giorni, vedi sessioni_profilo in schema.sql):
      // sostituirà il solo profiloId dichiarato al /join -- verifica non
      // ancora collegata (arriva nel Passo 2), qui solo emesso e restituito.
      return Response.json(
        { profilo: risultato.profilo, token: risultato.token, tokenScadenza: risultato.tokenScadenza },
        { status: 201 }
      );
    }

    if (url.pathname === "/profilo/accedi" && request.method === "POST") {
      const { nome, pin } = await request.json();
      const risultato = await accediGiocatore(env.DB, nome, pin);
      if (!risultato.successo) {
        return Response.json({ errore: MESSAGGI_ERRORE_PROFILO.credenziali_non_valide }, { status: 401 });
      }
      return Response.json(
        { profilo: risultato.profilo, token: risultato.token, tokenScadenza: risultato.tokenScadenza },
        { status: 200 }
      );
    }

    // Fase 4: legge grado/XP/bonus/nodi completati di un profilo esistente.
    // Richiede profiloId + pin (nessun token di sessione per i profili, si
    // riverificano le credenziali a ogni lettura, come /profilo/accedi).
    if (url.pathname === "/profilo/stato" && request.method === "POST") {
      const { profiloId, pin } = await request.json();
      const risultato = await otteniStatoProfilo(env.DB, profiloId, pin);
      if (!risultato.successo) {
        return Response.json({ errore: MESSAGGI_ERRORE_PROFILO.credenziali_non_valide }, { status: 401 });
      }
      return Response.json({ stato: risultato.stato }, { status: 200 });
    }

    // Fase 4: assegna UN bonus di grado a una competenza scelta dal
    // giocatore, solo dalla schermata profilo (mai da dentro una stanza di
    // gioco). Il server ricalcola sempre se un bonus è davvero disponibile
    // prima di scrivere -- non si fida di quanto dichiarato dal client.
    if (url.pathname === "/profilo/assegna-bonus" && request.method === "POST") {
      const { profiloId, pin, competenza } = await request.json();
      const risultato = await assegnaBonusProfilo(env.DB, profiloId, pin, competenza);
      if (!risultato.successo) {
        const status = risultato.errore === "credenziali_non_valide" ? 401 : 409;
        return Response.json({ errore: MESSAGGI_ERRORE_PROFILO[risultato.errore] }, { status });
      }
      return Response.json(
        { bonusAssegnato: risultato.bonusAssegnato, bonusDisponibili: risultato.bonusDisponibili },
        { status: 200 }
      );
    }

    // Proxy verso una sessione esistente: /api/stanza/{roomId}/...
    const match = url.pathname.match(/^\/api\/stanza\/([^/]+)(\/.*)$/);
    if (match) {
      const [, roomId, sub] = match;
      const id = env.GAME_SESSION.idFromName(roomId);
      const stub = env.GAME_SESSION.get(id);
      return stub.fetch(new Request(`https://internal${sub}`, request));
    }

    return new Response("La Corsa Invisibile — motore attivo", { status: 200 });
  },
};
