import { GameSession } from "./durable-objects/GameSession.js";
import { verificaCodice, consumaCodice, generaCodici } from "./lib/access-codes.js";
import { GAME_CONFIG } from "./game-config.js";

export { GameSession };

// Controlla la password admin passata nell'header Authorization.
// Formato atteso: "Authorization: Bearer <password>"
// La password vera va impostata come secret, MAI scritta nel codice:
//   npx.cmd wrangler secret put ADMIN_PASSWORD
function verificaPasswordAdmin(request, env) {
  const header = request.headers.get("Authorization") || "";
  const fornita = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(env.ADMIN_PASSWORD) && fornita === env.ADMIN_PASSWORD;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Config pubblica del gioco (terminologia, ruoli, nodi) — letta dal client
    if (url.pathname === "/api/config") {
      return Response.json(GAME_CONFIG);
    }

    // Ingresso in una stanza tramite codice stampato nel libro
    if (url.pathname === "/api/entra" && request.method === "POST") {
      const { code } = await request.json();
      const esito = await verificaCodice(env.DB, code);
      if (!esito.valido) {
        return Response.json(esito, { status: 403 });
      }
      const roomId = crypto.randomUUID();
      await consumaCodice(env.DB, code, roomId);
      const id = env.GAME_SESSION.idFromName(roomId);
      const stub = env.GAME_SESSION.get(id);
      return stub.fetch(new Request(`https://internal/state`));
    }

    // Proxy verso una sessione esistente: /api/stanza/{roomId}/...
    const match = url.pathname.match(/^\/api\/stanza\/([^/]+)(\/.*)$/);
    if (match) {
      const [, roomId, sub] = match;
      const id = env.GAME_SESSION.idFromName(roomId);
      const stub = env.GAME_SESSION.get(id);
      return stub.fetch(new Request(`https://internal${sub}`, request));
    }

    // Admin: generazione codici — protetta da password (ADMIN_PASSWORD, impostata come secret)
    if (url.pathname === "/admin/genera-codici" && request.method === "POST") {
      if (!verificaPasswordAdmin(request, env)) {
        return new Response("Non autorizzato", { status: 401 });
      }
      const { quantita } = await request.json();
      const codici = await generaCodici(env.DB, quantita || 1);
      return Response.json({ codici });
    }

    return new Response("La Corsa Invisibile — motore attivo", { status: 200 });
  },
};
