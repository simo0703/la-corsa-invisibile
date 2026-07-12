// Profilo giocatore persistente, condiviso tra tutte le stanze (tabella
// giocatori_persistenti in schema.sql -- vedi lì per il perché dello stesso
// D1 già esistente invece di uno nuovo, e per bonus_scelti/nodi_completati
// come colonne JSON). Fase 1: solo schema + registrazione/accesso. Fase 2
// (GameSession.js): profiloId opzionale salvato su /join, nessuna verifica
// di possesso. Fase 3 (questo modulo, sotto): assegnaXpCompletamentoNodo,
// chiamata da GameSession.js al completamento strutturale di un nodo --
// prima volta che GameSession.js scrive su D1, non solo sullo storage
// isolato della propria stanza.
//
// Query sempre parametrizzate: mai concatenare l'input dell'utente nella
// query (rischio injection), stesso principio di access-codes.js.

const NOME_LUNGHEZZA_MINIMA = 3;
const NOME_LUNGHEZZA_MASSIMA = 30; // limite difensivo, non richiesto esplicitamente: evita input abnormi sull'endpoint pubblico

// PIN a 6 cifre = solo 1.000.000 di combinazioni: nessun numero di
// iterazioni rende un hash offline del DB davvero sicuro contro un
// attacco a forza bruta mirato. L'hashing resta comunque nettamente
// meglio del testo in chiaro (chi legge il DB per errore, backup, bug non
// vede il PIN a colpo d'occhio) -- scelta discussa con l'autore, non presa
// unilateralmente. 100.000 iterazioni: costo percepibile per un attacco di
// massa, ma non così alto da introdurre latenza fastidiosa su un singolo
// login reale.
const PBKDF2_ITERAZIONI = 100_000;

function bytesAEsadecimale(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function esadecimaleABytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function generaSalt() {
  return bytesAEsadecimale(crypto.getRandomValues(new Uint8Array(16)));
}

// PBKDF2-SHA256 via Web Crypto (crypto.subtle): disponibile nativamente sia
// nel runtime dei Cloudflare Workers sia sotto Node puro (dove girano questi
// test) -- nessuna dipendenza esterna.
async function derivaPin(pin, saltEsadecimale) {
  const chiaveMateriale = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), { name: "PBKDF2" }, false, [
    "deriveBits",
  ]);
  const bit = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: esadecimaleABytes(saltEsadecimale), iterations: PBKDF2_ITERAZIONI, hash: "SHA-256" },
    chiaveMateriale,
    256
  );
  return bytesAEsadecimale(new Uint8Array(bit));
}

// Validazioni esportate singolarmente: servono sia a registraGiocatore/
// accediGiocatore sia ai test dedicati sul formato (requisito 4).
export function validaNome(nome) {
  if (typeof nome !== "string") return "nome_non_valido";
  const pulito = nome.trim();
  if (pulito.length < NOME_LUNGHEZZA_MINIMA) return "nome_troppo_corto";
  if (pulito.length > NOME_LUNGHEZZA_MASSIMA) return "nome_troppo_lungo";
  return null;
}

export function validaPin(pin) {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) return "pin_formato_non_valido";
  return null;
}

async function trovaGiocatorePerNome(db, nome) {
  return db
    .prepare(
      "SELECT id, nome, pin_hash, pin_salt, xp_totale, bonus_scelti, created_at FROM giocatori_persistenti WHERE nome = ?"
    )
    .bind(nome)
    .first();
}

function rigaAProfilo(riga) {
  // pin_hash/pin_salt intenzionalmente esclusi: mai restituiti al client.
  return {
    id: riga.id,
    nome: riga.nome,
    xpTotale: riga.xp_totale,
    bonusScelti: JSON.parse(riga.bonus_scelti),
    creatoIl: riga.created_at,
  };
}

// Registra un nuovo profilo. Errori possibili (motivo specifico: qui non
// c'è rischio di facilitare un tentativo di accesso indebito, a differenza
// del login): "nome_troppo_corto" | "nome_troppo_lungo" |
// "pin_formato_non_valido" | "nome_gia_in_uso".
export async function registraGiocatore(db, nome, pin) {
  const erroreNome = validaNome(nome);
  if (erroreNome) return { successo: false, errore: erroreNome };
  const errorePin = validaPin(pin);
  if (errorePin) return { successo: false, errore: errorePin };

  const nomePulito = nome.trim();
  const esistente = await trovaGiocatorePerNome(db, nomePulito);
  if (esistente) return { successo: false, errore: "nome_gia_in_uso" };

  const salt = generaSalt();
  const pinHash = await derivaPin(pin, salt);

  await db
    .prepare("INSERT INTO giocatori_persistenti (nome, pin_hash, pin_salt, xp_totale, bonus_scelti) VALUES (?, ?, ?, 0, '[]')")
    .bind(nomePulito, pinHash, salt)
    .run();

  // Riletto dopo l'INSERT (invece di comporre l'oggetto a mano) per usare
  // il timestamp generato davvero dal DB, non uno calcolato lato app.
  const riga = await trovaGiocatorePerNome(db, nomePulito);
  return { successo: true, profilo: rigaAProfilo(riga) };
}

// Verifica nome+pin. Errore SEMPRE generico "credenziali_non_valide",
// qualunque sia la causa (nome inesistente, pin sbagliato, o perfino
// formato non valido) -- non deve essere possibile distinguere dall'esterno
// quale dei due campi è sbagliato (requisito 2).
export async function accediGiocatore(db, nome, pin) {
  if (validaNome(nome) || validaPin(pin)) {
    return { successo: false, errore: "credenziali_non_valide" };
  }

  const riga = await trovaGiocatorePerNome(db, nome.trim());
  if (!riga) return { successo: false, errore: "credenziali_non_valide" };

  const pinHashCalcolato = await derivaPin(pin, riga.pin_salt);
  if (pinHashCalcolato !== riga.pin_hash) return { successo: false, errore: "credenziali_non_valide" };

  return { successo: true, profilo: rigaAProfilo(riga) };
}

// XP fisso per nodo completato (Fase 3): stesso valore per qualunque nodo,
// nessuna variazione per ruolo/difficoltà -- decisione già presa a monte,
// non riaperta qui.
export const XP_PER_NODO = 100;

// Assegna XP per il completamento STRUTTURALE di un nodo (tutte le
// richieste previste risolte -- l'evento e' sempre automatico, mai a
// discrezione del comandante: chi chiama decide QUANDO, questa funzione non
// lo rivaluta). Una sola volta per sempre per coppia profiloId+nodoId,
// anche rigiocando lo stesso nodo in una stanza diversa in futuro --
// verificato leggendo nodi_completati prima di scrivere.
//
// UNA query di lettura (per decidere se assegnare) + UNA query di
// scrittura (che aggiorna nodi_completati E xp_totale insieme) per
// giocatore: chi chiama e' responsabile di isolare gli errori per singolo
// giocatore (vedi commento in GameSession.js) cosi' un fallimento D1 per un
// giocatore non impedisce agli altri di ricevere il proprio XP.
//
// Ritorna { assegnato: true } se l'XP e' stato dato ora, { assegnato:
// false, motivo } altrimenti ("profilo_non_trovato" | "gia_completato") --
// nessuno dei due e' un errore: sono esiti normali attesi dal chiamante.
export async function assegnaXpCompletamentoNodo(db, profiloId, nodoId) {
  const riga = await db.prepare("SELECT nodi_completati FROM giocatori_persistenti WHERE id = ?").bind(profiloId).first();
  if (!riga) return { assegnato: false, motivo: "profilo_non_trovato" };

  const completati = JSON.parse(riga.nodi_completati);
  if (completati.includes(nodoId)) return { assegnato: false, motivo: "gia_completato" };

  completati.push(nodoId);
  await db
    .prepare("UPDATE giocatori_persistenti SET nodi_completati = ?, xp_totale = xp_totale + ? WHERE id = ?")
    .bind(JSON.stringify(completati), XP_PER_NODO, profiloId)
    .run();

  return { assegnato: true };
}
