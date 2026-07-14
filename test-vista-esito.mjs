// Test locale: node test-vista-esito.mjs
//
// Passo 3/3 del tavolo condiviso (front-end). Il grosso del Passo 3 è resa a
// schermo (DOM, socket, ridisegno) e va verificato DAL VIVO. Qui si testa la
// sola logica PURA estratta in public/vista-esito.js, condivisa tra il
// front-end e questo test:
// - richiestaAttivaDaSessione(): il momento corrente ricavato dallo stato del
//   server, non dalla navigazione locale — deve combaciare con la logica del
//   Durable Object (GameSession.trovaRichiestaAttiva);
// - deveMostrareEsito(): la decisione mostra/non-mostra il pannello dell'esito
//   data la sessione e l'ultima richiesta scacciata su questo dispositivo.
//
// La verifica del client WebSocket, della riconnessione e del ridisegno vero
// resta DAL VIVO (nessun DOM sotto Node): vedi il changelog.

import { GAME_CONFIG } from "./src/game-config.js";
import {
  richiestaAttivaDaSessione,
  deveMostrareEsito,
  chiaveRifiuto,
  deveMostrareRifiuto,
} from "./public/vista-esito.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

const nodi = GAME_CONFIG.nodiTemporali;
const nodo = nodi.find((n) => n.id === "1836-torino");
const primaRichiesta = nodo.richieste[0];
const secondaRichiesta = nodo.richieste[1] ?? null;

console.log("--- richiestaAttivaDaSessione: nessun nodo / nodo sconosciuto ---");
{
  verifica("senza nodo attivo restituisce null", richiestaAttivaDaSessione({ nodoAttivo: null }, nodi) === null);
  verifica("sessione assente restituisce null", richiestaAttivaDaSessione(null, nodi) === null);
  verifica("nodiTemporali non-array restituisce null", richiestaAttivaDaSessione({ nodoAttivo: "1836-torino" }, null) === null);
  verifica(
    "nodo sconosciuto restituisce null",
    richiestaAttivaDaSessione({ nodoAttivo: "nodo-che-non-esiste", richiestaAttivaId: "x" }, nodi) === null
  );
}

console.log("\n--- richiestaAttivaDaSessione: per id (ramificazione) ---");
{
  const perId = richiestaAttivaDaSessione(
    { nodoAttivo: "1836-torino", richiestaAttivaId: primaRichiesta.id, richiestaIndice: 0 },
    nodi
  );
  verifica("con richiestaAttivaId trova la richiesta giusta", perId && perId.id === primaRichiesta.id);
  verifica(
    "richiestaAttivaId sconosciuto (ramo finito) restituisce null",
    richiestaAttivaDaSessione({ nodoAttivo: "1836-torino", richiestaAttivaId: "id-inesistente" }, nodi) === null
  );
  if (secondaRichiesta) {
    // Priorità all'id: anche con un indice diverso, l'id vince.
    const perIdConIndiceDiverso = richiestaAttivaDaSessione(
      { nodoAttivo: "1836-torino", richiestaAttivaId: secondaRichiesta.id, richiestaIndice: 0 },
      nodi
    );
    verifica(
      "l'id ha priorità sull'indice legacy",
      perIdConIndiceDiverso && perIdConIndiceDiverso.id === secondaRichiesta.id
    );
  }
}

console.log("\n--- richiestaAttivaDaSessione: fallback legacy sull'indice ---");
{
  const perIndice = richiestaAttivaDaSessione(
    { nodoAttivo: "1836-torino", richiestaAttivaId: null, richiestaIndice: 0 },
    nodi
  );
  verifica("senza richiestaAttivaId usa richiestaIndice", perIndice && perIndice.id === primaRichiesta.id);
  verifica(
    "indice fuori range restituisce null",
    richiestaAttivaDaSessione({ nodoAttivo: "1836-torino", richiestaAttivaId: null, richiestaIndice: 999 }, nodi) === null
  );
}

console.log("\n--- deveMostrareEsito ---");
{
  verifica("esitoCorrente null: niente pannello", deveMostrareEsito(null, null) === false);
  verifica("esitoCorrente undefined: niente pannello", deveMostrareEsito(undefined, null) === false);
  verifica(
    "esito vuoto ' corri-prima': niente pannello",
    deveMostrareEsito({ richiestaId: "r1", esito: "" }, null) === false
  );
  verifica(
    "esito null (tier senza testo): niente pannello",
    deveMostrareEsito({ richiestaId: "r1", esito: null }, null) === false
  );
  verifica(
    "esito con testo, mai scacciato: mostra il pannello",
    deveMostrareEsito({ richiestaId: "r1", esito: "Corri nella nebbia." }, null) === true
  );
  verifica(
    "esito con testo, già scacciato (stesso richiestaId): niente pannello",
    deveMostrareEsito({ richiestaId: "r1", esito: "Corri nella nebbia." }, "r1") === false
  );
  verifica(
    "esito con testo, scacciato un ALTRO id: mostra il pannello",
    deveMostrareEsito({ richiestaId: "r2", esito: "Il ramo severo si apre." }, "r1") === true
  );
}

console.log("\n--- chiaveRifiuto (Difetto #6) ---");
{
  verifica("null se nessun rifiuto", chiaveRifiuto(null) === null);
  verifica(
    "combina richiestaId + timestamp",
    chiaveRifiuto({ richiestaId: "decalogo-ginnastica", timestamp: "2026-07-14T10:00:00.000Z" }) ===
      "decalogo-ginnastica:2026-07-14T10:00:00.000Z"
  );
  verifica(
    "due rifiuti sullo stesso momento ma timestamp diversi hanno chiavi diverse",
    chiaveRifiuto({ richiestaId: "r", timestamp: "t1" }) !== chiaveRifiuto({ richiestaId: "r", timestamp: "t2" })
  );
}

console.log("\n--- deveMostrareRifiuto (Difetto #6) ---");
{
  const rifiuto = { richiestaId: "decalogo-ginnastica", giocatoreNome: "Bruno", testoProposta: "corro come il vento", timestamp: "2026-07-14T10:00:00.000Z" };
  verifica("rifiuto null: niente avviso", deveMostrareRifiuto(null, null) === false);
  verifica("rifiuto undefined: niente avviso", deveMostrareRifiuto(undefined, null) === false);
  verifica(
    "proposta vuota: niente avviso",
    deveMostrareRifiuto({ richiestaId: "r", testoProposta: "", timestamp: "t" }, null) === false
  );
  verifica("rifiuto con proposta, mai scacciato: mostra l'avviso", deveMostrareRifiuto(rifiuto, null) === true);
  verifica(
    "rifiuto già scacciato (stessa chiave): niente avviso",
    deveMostrareRifiuto(rifiuto, chiaveRifiuto(rifiuto)) === false
  );
  verifica(
    "un rifiuto NUOVO sullo stesso momento (timestamp diverso) torna a mostrarsi",
    deveMostrareRifiuto({ ...rifiuto, timestamp: "2026-07-14T10:05:00.000Z" }, chiaveRifiuto(rifiuto)) === true
  );
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
