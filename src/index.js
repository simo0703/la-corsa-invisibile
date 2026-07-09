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
    if (url.pathname === "/api/crea-stanza" && request.method === "POST") {
      const roomId = crypto.randomUUID();
      const id = env.GAME_SESSION.idFromName(roomId);
      const stub = env.GAME_SESSION.get(id);
      const risposta = await stub.fetch(new Request(`https://internal/state`));
      const session = await risposta.json();
      // roomId è indispensabile al client: senza di esso non può più parlare
      // con questa stanza (tutte le rotte /api/stanza/{roomId}/... lo richiedono).
      return Response.json({ roomId, session });
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
