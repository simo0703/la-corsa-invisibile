import { GameSession } from "./durable-objects/GameSession.js";
import { GAME_CONFIG } from "./game-config.js";

export { GameSession };

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
