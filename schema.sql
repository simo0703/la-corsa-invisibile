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
