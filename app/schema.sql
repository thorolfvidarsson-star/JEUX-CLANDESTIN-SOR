-- Schéma de référence pour la base D1 `cloudpoker-db` (Black Woods Poker v4.1.0).
-- Le Worker crée automatiquement ces tables au premier appel (CREATE TABLE IF NOT EXISTS) :
-- ce fichier sert de documentation et peut être exécuté sans risque sur une base existante.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  chips INTEGER NOT NULL DEFAULT 0 CHECK(chips >= 0),
  avatar TEXT NOT NULL DEFAULT '',
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- active_tables : 1 à 6 ; min_bet : petite blinde (la grosse blinde vaut le double).
INSERT OR IGNORE INTO settings(key,value) VALUES ('active_tables','6'),('min_bet','10');
CREATE TABLE IF NOT EXISTS tables_state (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}'
);
INSERT OR IGNORE INTO tables_state(id,name,state_json) VALUES
  (1,'Table 01','{}'),(2,'Table 02','{}'),(3,'Table 03','{}'),
  (4,'Table 04','{}'),(5,'Table 05','{}'),(6,'Table 06','{}');
CREATE TABLE IF NOT EXISTS table_seats (
  table_id INTEGER NOT NULL REFERENCES tables_state(id),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_no INTEGER NOT NULL,
  PRIMARY KEY(table_id,user_id),
  UNIQUE(table_id,seat_no)
);
CREATE INDEX IF NOT EXISTS idx_seats_user ON table_seats(user_id);
-- Limitation des tentatives de connexion (par nom d'utilisateur).
CREATE TABLE IF NOT EXISTS login_throttle (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

-- Blackjack : tables et garde-fous ajoutés, comptes existants conservés.
CREATE TABLE IF NOT EXISTS blackjack_hands (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_key TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('playing','settled')), revision INTEGER NOT NULL DEFAULT 0, state_json TEXT NOT NULL, operation_token TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(user_id,request_key));
CREATE UNIQUE INDEX IF NOT EXISTS idx_blackjack_live_user ON blackjack_hands(user_id) WHERE status='playing';
CREATE TABLE IF NOT EXISTS blackjack_events (hand_id TEXT NOT NULL REFERENCES blackjack_hands(id) ON DELETE CASCADE, request_key TEXT NOT NULL, action TEXT NOT NULL, from_revision INTEGER NOT NULL, wagered INTEGER NOT NULL, returned INTEGER NOT NULL, chips_delta INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(hand_id,request_key));
CREATE TRIGGER IF NOT EXISTS guard_blackjack_no_poker BEFORE INSERT ON blackjack_hands WHEN NEW.status='playing' AND EXISTS(SELECT 1 FROM table_seats WHERE user_id=NEW.user_id) BEGIN SELECT RAISE(ABORT,'POKER_ACTIVE'); END;
CREATE TRIGGER IF NOT EXISTS guard_poker_no_blackjack BEFORE INSERT ON table_seats WHEN EXISTS(SELECT 1 FROM blackjack_hands WHERE user_id=NEW.user_id AND status='playing') BEGIN SELECT RAISE(ABORT,'BLACKJACK_ACTIVE'); END;

-- Roulette : historique et idempotence, sans modification des tables existantes.
CREATE TABLE IF NOT EXISTS roulette_spins (id TEXT PRIMARY KEY NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_key TEXT NOT NULL, bets_json TEXT NOT NULL, result INTEGER NOT NULL CHECK(result BETWEEN 0 AND 36), stake INTEGER NOT NULL CHECK(stake BETWEEN 10 AND 10000), returned INTEGER NOT NULL CHECK(returned>=0), created_at INTEGER NOT NULL, UNIQUE(user_id,request_key));
CREATE INDEX IF NOT EXISTS idx_roulette_user_recent ON roulette_spins(user_id,created_at);
