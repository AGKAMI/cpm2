import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type AccountRow = {
  id: number;
  email: string;
  password_enc: string;
  cash: number;
  coins: number;
  cars: number;
  slots: number;
  notes: string;
  archived: number;
  coins_spent_on_cars: number;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: number;
  account_id: number | null;
  account_email: string;
  type: string;
  summary: string;
  changes: string;
  created_at: string;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT    NOT NULL,
  password_enc TEXT    NOT NULL,
  cash         INTEGER NOT NULL DEFAULT 0,
  coins        INTEGER NOT NULL DEFAULT 0,
  cars         INTEGER NOT NULL DEFAULT 0,
  slots        INTEGER NOT NULL DEFAULT 0,
  notes        TEXT    NOT NULL DEFAULT '',
  archived     INTEGER NOT NULL DEFAULT 0,
  coins_spent_on_cars INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  CHECK (length(email) > 2 AND length(email) <= 254),
  CHECK (cash >= 0 AND cash <= 50000000),
  CHECK (coins >= 0 AND coins <= 30000),
  CHECK (cars >= 0 AND cars <= 20 + slots),
  CHECK (slots >= 0 AND slots <= 15),
  CHECK (coins_spent_on_cars >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email
  ON accounts (email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS account_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER,
  account_email TEXT    NOT NULL,
  type          TEXT    NOT NULL,
  summary       TEXT    NOT NULL DEFAULT '',
  changes       TEXT    NOT NULL DEFAULT '{}',
  created_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_events_created
  ON account_events (created_at DESC);

CREATE TABLE IF NOT EXISTS account_trophies (
  account_id INTEGER NOT NULL,
  class      TEXT    NOT NULL,
  gold       INTEGER NOT NULL DEFAULT 0,
  silver     INTEGER NOT NULL DEFAULT 0,
  bronze     INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT    NOT NULL,
  PRIMARY KEY (account_id, class),
  CHECK (gold >= 0 AND gold <= 999),
  CHECK (silver >= 0 AND silver <= 999),
  CHECK (bronze >= 0 AND bronze <= 999)
);

CREATE INDEX IF NOT EXISTS idx_account_trophies_class
  ON account_trophies (class);
`;

export function resolveDbPath(): string {
  const override = process.env.CPM2_DB_PATH;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.join(process.cwd(), "data", "cpm2.db");
}

/** Opens a fresh database, applies the schema and returns the handle. */
export function createDatabase(filePath: string): Database.Database {
  if (filePath !== ":memory:") {
    fs.mkdirSync(/* turbopackIgnore: true */ path.dirname(filePath), { recursive: true });
  }

  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/**
 * Brings an older database up to the current shape.
 * Only additive migrations live here — the archived flag is the only column
 * added after v1.
 */
function migrate(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(accounts)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "archived")) {
    db.exec(`ALTER TABLE accounts ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columns.some((column) => column.name === "coins_spent_on_cars")) {
    db.exec(`ALTER TABLE accounts ADD COLUMN coins_spent_on_cars INTEGER NOT NULL DEFAULT 0`);
  }
}

declare global {
  var __cpm2Database: Database.Database | undefined;
}

/** Process-wide singleton so Next.js hot reloads reuse one connection. */
export function getDb(): Database.Database {
  if (globalThis.__cpm2Database) return globalThis.__cpm2Database;
  const db = createDatabase(resolveDbPath());
  globalThis.__cpm2Database = db;
  return db;
}

/** Test helper: drops the cached singleton. */
export function closeDb(): void {
  if (globalThis.__cpm2Database) {
    globalThis.__cpm2Database.close();
    globalThis.__cpm2Database = undefined;
  }
}
