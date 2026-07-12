-- Schema D1 per La Corsa Invisibile
-- Progetto indipendente: questo database non è condiviso con Session Zero
-- né con altri giochi roomzero. Nessun campo gameId necessario, perché
-- questo database serve un solo gioco.

CREATE TABLE IF NOT EXISTS access_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at TEXT,
  room_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);

-- Iscrizioni email opzionali (es. per avvisi su nuove sessioni/materiali)
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Profilo giocatore persistente, condiviso tra tutte le stanze -- a
-- differenza dello stato di UNA stanza, che vive nel Durable Object
-- GameSession (isolato per stanza), non qui. Fase 1 (vedi
-- DECISIONI_LA_CORSA_INVISIBILE.md): solo schema + registrazione/accesso,
-- NESSUN collegamento al gameplay esistente.
CREATE TABLE IF NOT EXISTS giocatori_persistenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  -- PIN a 6 cifre: MAI salvato in chiaro. pin_hash è PBKDF2-SHA256 del PIN
  -- combinato con pin_salt (casuale, per record) -- vedi
  -- src/lib/profili-giocatore.js per la scelta e il tradeoff.
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  xp_totale INTEGER NOT NULL DEFAULT 0,
  -- Elenco bonus scelti, JSON serializzato (es. '["bonus_x","bonus_y"]').
  -- Colonna JSON invece di una tabella separata: il sistema di bonus non è
  -- ancora progettato (dipende da un game design che arriva in una fase
  -- successiva) -- decisione presa insieme all'autore, non unilaterale.
  bonus_scelti TEXT NOT NULL DEFAULT '[]',
  -- Elenco id di nodo temporale già completati (JSON, stesso pattern di
  -- bonus_scelti sopra, es. '["1836-torino"]') -- serve a garantire che
  -- l'XP per un nodo sia assegnato una sola volta per sempre a ciascun
  -- profilo, anche rigiocando lo stesso nodo in una stanza diversa in
  -- futuro. Fase 3 (vedi DECISIONI_LA_CORSA_INVISIBILE.md). Colonna
  -- aggiunta con ALTER TABLE su una tabella già popolata in produzione --
  -- vedi migrations/0001_nodi_completati.sql, non basta questo file da
  -- solo (CREATE TABLE IF NOT EXISTS non tocca una tabella già esistente).
  nodi_completati TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_giocatori_persistenti_nome ON giocatori_persistenti(nome);

-- Token di sessione per il profilo persistente (sostituisce il solo
-- profiloId dichiarato senza prova di possesso -- vedi
-- src/lib/profili-giocatore.js, creaSessioneProfilo). Tabella dedicata
-- invece di colonne su giocatori_persistenti: una riga per SESSIONE, non
-- per profilo, così più dispositivi possono avere un token valido
-- contemporaneamente senza che un nuovo login invalidi quelli già aperti
-- altrove -- coerente con "revoca solo tramite logout esplicito" (nessun
-- meccanismo che sovrascriva un token già emesso). Tabella nuova, non
-- un'ALTER su una tabella già popolata: CREATE TABLE IF NOT EXISTS basta,
-- a differenza del caso di nodi_completati (vedi migrations/0001).
CREATE TABLE IF NOT EXISTS sessioni_profilo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profilo_id INTEGER NOT NULL REFERENCES giocatori_persistenti(id),
  -- Token in chiaro restituito al client una sola volta, alla creazione;
  -- qui si salva solo l'hash (SHA-256, non iterato: il token è già a 256
  -- bit di entropia casuale, non un segreto a bassa entropia come il PIN).
  token_hash TEXT NOT NULL UNIQUE,
  creato_il TEXT NOT NULL DEFAULT (datetime('now')),
  scade_il TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessioni_profilo_token_hash ON sessioni_profilo(token_hash);
