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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_giocatori_persistenti_nome ON giocatori_persistenti(nome);
