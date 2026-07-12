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
//
// Import da game-config.js: questo modulo non è tra i file "neutri"
// (index.js, GameSession.js, narratore-simulato.js) su cui vige il divieto
// di stringhe specifiche del gioco -- contiene già XP_PER_NODO, i nomi dei
// gradi Bersaglieri, ecc. Qui serve solo per leggere l'elenco delle
// competenze valide (assegnaBonusProfilo, Fase 4), stessa fonte unica di
// verità usata dal resto del motore per le stesse competenze.
import { GAME_CONFIG } from "../game-config.js";

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

async function trovaGiocatorePerId(db, id) {
  return db
    .prepare(
      "SELECT id, nome, pin_hash, pin_salt, xp_totale, bonus_scelti, nodi_completati, created_at FROM giocatori_persistenti WHERE id = ?"
    )
    .bind(id)
    .first();
}

// Verifica il PIN contro una riga già letta -- estratto da accediGiocatore
// per essere riusato anche da otteniStatoProfilo (Fase 4), che autentica per
// id invece che per nome ma con la stessa identica logica di confronto.
async function pinCorrisponde(riga, pin) {
  const pinHashCalcolato = await derivaPin(pin, riga.pin_salt);
  return pinHashCalcolato === riga.pin_hash;
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

// bonus_scelti nasce (Fase 1) come array bare '[]', mai scritto con
// contenuto reale finora -- il sistema di bonus non esisteva ancora. Fase 4
// lo struttura come oggetto { assegnati: [...] } (vedi
// DECISIONI_LA_CORSA_INVISIBILE.md). Nessuna riga reale rischia di perdere
// dati normalizzando qui: l'unico valore bare mai scritto è '[]', equivalente
// a "nessun bonus assegnato" in entrambe le forme. La migrazione che aggiorna
// le righe esistenti al nuovo formato arriva quando si introduce la
// scrittura (assegnazione di un bonus), non prima.
export function normalizzaBonusScelti(bonusSceltiJson) {
  const valore = JSON.parse(bonusSceltiJson);
  const assegnati = Array.isArray(valore) ? [] : valore.assegnati;
  return { assegnati: Array.isArray(assegnati) ? assegnati : [] };
}

// Scala gradi (Fase 4): 10 gradi, gerarchia reale dei Bersaglieri (confermata
// con l'autore). Grado 1 (Bersagliere) è il punto di partenza a 0 XP --
// nessuna soglia da superare per averlo. Interpretazione della soglia
// "N × 200 XP cumulativi" scelta qui: sono gli XP cumulativi necessari per
// salire DAL grado N AL grado N+1 (grado 2 a 200 XP, grado 3 a 400, ...,
// grado 10 a 1800) -- da confermare con l'autore se non è quanto intendeva.
export const NOMI_GRADO = [
  "Bersagliere",
  "Bersagliere Scelto",
  "Caporale",
  "Caporal Maggiore",
  "Sergente",
  "Sergente Maggiore",
  "Maresciallo",
  "Sottotenente",
  "Tenente",
  "Capitano",
];

const XP_PER_SALITA_GRADO = 200;
const GRADO_MASSIMO = NOMI_GRADO.length;

// Gradi ai quali si sblocca un bonus di competenza a scelta: ogni 2 gradi,
// 5 bonus massimi (grado 10 incluso) -- deciso a monte, non riaperto qui.
const GRADI_CON_BONUS = [2, 4, 6, 8, 10];

// Calcola il grado corrente da xpTotale e quanti bonus sono disponibili ma
// non ancora assegnati, confrontando i traguardi di grado raggiunti con
// bonusScelti.assegnati (già normalizzato, vedi normalizzaBonusScelti sopra).
// Pura funzione di dominio, riusabile sia dall'endpoint di lettura sia da
// GameSession.js (Fase 4, punto 5) per applicare i bonus al tiro.
export function calcolaGrado(xpTotale, bonusScelti) {
  const xp = Math.max(0, xpTotale || 0);
  const gradoNumero = Math.min(GRADO_MASSIMO, 1 + Math.floor(xp / XP_PER_SALITA_GRADO));

  const assegnati = bonusScelti && Array.isArray(bonusScelti.assegnati) ? bonusScelti.assegnati : [];
  const traguardiRaggiunti = GRADI_CON_BONUS.filter((grado) => grado <= gradoNumero);
  const bonusDisponibili = Math.max(0, traguardiRaggiunti.length - assegnati.length);

  return {
    gradoNumero,
    gradoNome: NOMI_GRADO[gradoNumero - 1],
    sogliaGradoAttuale: (gradoNumero - 1) * XP_PER_SALITA_GRADO,
    sogliaProssimoGrado: gradoNumero < GRADO_MASSIMO ? gradoNumero * XP_PER_SALITA_GRADO : null,
    bonusDisponibili,
    // Traguardo (2/4/6/8/10) a cui appartiene il PROSSIMO bonus da
    // assegnare -- gli `assegnati` sono sempre consumati in ordine di
    // traguardo raggiunto (si assegna sempre "il prossimo disponibile", mai
    // uno a scelta tra più traguardi aperti), quindi l'indice nell'array
    // ordinato basta. `null` se non c'è nessun bonus disponibile.
    prossimoTraguardoBonus: bonusDisponibili > 0 ? traguardiRaggiunti[assegnati.length] : null,
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

  if (!(await pinCorrisponde(riga, pin))) return { successo: false, errore: "credenziali_non_valide" };

  return { successo: true, profilo: rigaAProfilo(riga) };
}

// Legge lo stato completo del profilo (grado, XP, bonus, nodi completati) --
// Fase 4, richiede profiloId + PIN (nessun sistema di token per i profili
// finora, a differenza dei token in-game di GameSession.js): ogni lettura
// riverifica le credenziali, stessa logica di accediGiocatore ma per id
// invece che per nome (il client conosce già il profiloId dopo un login
// avvenuto altrove). Stesso errore generico "credenziali_non_valide" per id
// inesistente o PIN sbagliato -- stessa scelta di non distinguerli presa per
// accediGiocatore (Fase 1).
export async function otteniStatoProfilo(db, profiloId, pin) {
  if (validaPin(pin)) return { successo: false, errore: "credenziali_non_valide" };

  const riga = await trovaGiocatorePerId(db, profiloId);
  if (!riga) return { successo: false, errore: "credenziali_non_valide" };

  if (!(await pinCorrisponde(riga, pin))) return { successo: false, errore: "credenziali_non_valide" };

  const bonusScelti = normalizzaBonusScelti(riga.bonus_scelti);
  const grado = calcolaGrado(riga.xp_totale, bonusScelti);

  return {
    successo: true,
    stato: {
      id: riga.id,
      nome: riga.nome,
      xpTotale: riga.xp_totale,
      grado: {
        numero: grado.gradoNumero,
        nome: grado.gradoNome,
        sogliaGradoAttuale: grado.sogliaGradoAttuale,
        sogliaProssimoGrado: grado.sogliaProssimoGrado,
      },
      bonusDisponibili: grado.bonusDisponibili,
      bonusAssegnati: bonusScelti.assegnati,
      nodiCompletati: JSON.parse(riga.nodi_completati),
    },
  };
}

// Competenze valide su cui si può assegnare un bonus di grado: stesse
// competenze del motore di gioco (game-config.js), niente elenco separato da
// tenere sincronizzato a mano.
const COMPETENZE_VALIDE = new Set(Object.keys(GAME_CONFIG.competenze));

// Assegna UN bonus di grado a una competenza scelta dal giocatore (Fase 4,
// schermata profilo -- mai durante una sessione di gioco live, decisione già
// presa a monte). Stessa autenticazione di otteniStatoProfilo (profiloId +
// pin, errore generico per credenziali). Non fidarsi MAI del client sul
// "c'è un bonus disponibile": ricalcolato qui da xp_totale/bonus_scelti
// appena letti da D1, prima di scrivere qualunque cosa -- se il client ha
// uno stato profilo stantio (es. un'altra scheda ha già assegnato il bonus
// nel frattempo), la richiesta viene comunque rifiutata.
// Ritorna { successo: false, errore } con errore in "credenziali_non_valide"
// | "competenza_non_valida" | "nessun_bonus_disponibile", oppure
// { successo: true, bonusAssegnato, bonusDisponibili } (bonusDisponibili
// già decrementato, per evitare che il chiamante debba ricalcolare).
export async function assegnaBonusProfilo(db, profiloId, pin, competenza) {
  if (validaPin(pin)) return { successo: false, errore: "credenziali_non_valide" };

  const riga = await trovaGiocatorePerId(db, profiloId);
  if (!riga) return { successo: false, errore: "credenziali_non_valide" };

  if (!(await pinCorrisponde(riga, pin))) return { successo: false, errore: "credenziali_non_valide" };

  if (!COMPETENZE_VALIDE.has(competenza)) return { successo: false, errore: "competenza_non_valida" };

  const bonusScelti = normalizzaBonusScelti(riga.bonus_scelti);
  const grado = calcolaGrado(riga.xp_totale, bonusScelti);
  if (grado.bonusDisponibili <= 0) return { successo: false, errore: "nessun_bonus_disponibile" };

  const bonusAssegnato = { grado: grado.prossimoTraguardoBonus, competenza };
  const assegnatiAggiornati = [...bonusScelti.assegnati, bonusAssegnato];

  await db
    .prepare("UPDATE giocatori_persistenti SET bonus_scelti = ? WHERE id = ?")
    .bind(JSON.stringify({ assegnati: assegnatiAggiornati }), profiloId)
    .run();

  return { successo: true, bonusAssegnato, bonusDisponibili: grado.bonusDisponibili - 1 };
}

// Legge le competenze bonificate (bonus_scelti.assegnati) di un profilo --
// chiamata da GameSession.js al momento del tiro, NON da un endpoint HTTP:
// nessuna verifica di PIN qui (non è un'azione dell'utente, è un dettaglio
// interno del calcolo del punteggio). Ritorna un Set di id competenza, vuoto
// se il profilo non esiste o non ha bonus -- MAI un'eccezione per "profilo
// non trovato", solo per un vero fallimento D1 (rete, tabella mancante):
// isolarlo è responsabilità del chiamante (stesso principio già seguito da
// assegnaXpCompletamentoNodo/assegnaXpNodoCompletato in GameSession.js).
export async function otteniCompetenzeBonificate(db, profiloId) {
  const riga = await db.prepare("SELECT bonus_scelti FROM giocatori_persistenti WHERE id = ?").bind(profiloId).first();
  if (!riga) return new Set();
  const bonusScelti = normalizzaBonusScelti(riga.bonus_scelti);
  return new Set(bonusScelti.assegnati.map((b) => b.competenza));
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
