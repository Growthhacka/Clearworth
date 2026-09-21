'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'clearworth.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'XX',
  currency      TEXT NOT NULL DEFAULT 'USD',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS debts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  counterparty    TEXT NOT NULL DEFAULT '',
  for_whom        TEXT NOT NULL DEFAULT '',
  currency        TEXT NOT NULL,
  original_amount REAL NOT NULL DEFAULT 0,
  balance         REAL NOT NULL DEFAULT 0,
  interest_rate   REAL NOT NULL DEFAULT 0,
  min_payment     REAL NOT NULL DEFAULT 0,
  credit_limit    REAL,
  due_date        TEXT,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id);

CREATE TABLE IF NOT EXISTS receivables (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  reason          TEXT NOT NULL DEFAULT '',
  contact         TEXT NOT NULL DEFAULT '',
  currency        TEXT NOT NULL,
  original_amount REAL NOT NULL DEFAULT 0,
  balance         REAL NOT NULL DEFAULT 0,
  due_date        TEXT,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_receivables_user ON receivables(user_id);

CREATE TABLE IF NOT EXISTS investments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  currency        TEXT NOT NULL,
  amount_invested REAL NOT NULL DEFAULT 0,
  current_value   REAL NOT NULL DEFAULT 0,
  acquired_date   TEXT,
  location        TEXT NOT NULL DEFAULT '',
  annual_income   REAL NOT NULL DEFAULT 0,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);

CREATE TABLE IF NOT EXISTS goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,
  currency      TEXT NOT NULL,
  target_amount REAL NOT NULL DEFAULT 0,
  saved_amount  REAL NOT NULL DEFAULT 0,
  target_date   TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium',
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- Every change to a balance: debt payments/charges, money received back, goal contributions, investment top-ups.
CREATE TABLE IF NOT EXISTS transactions (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,          -- debts | receivables | goals | investments
  ref_id   INTEGER NOT NULL,
  delta    REAL NOT NULL,          -- signed change to the balance/saved/invested amount
  day      TEXT NOT NULL,
  note     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_ref ON transactions(user_id, resource, ref_id);

CREATE TABLE IF NOT EXISTS valuations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  value         REAL NOT NULL,
  day           TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_val_inv ON valuations(investment_id);

CREATE TABLE IF NOT EXISTS snapshots (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,
  assets      REAL NOT NULL,
  debts       REAL NOT NULL,
  net_worth   REAL NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS fx_rates (
  currency   TEXT PRIMARY KEY,
  rate       REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_rates (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  rate     REAL NOT NULL,
  PRIMARY KEY (user_id, currency)
);
`);

module.exports = { db, DB_FILE };
