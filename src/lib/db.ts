import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { LIMITS, MAX_CARS, type GameType } from "./constants.ts";

export type AccountRow = {
  id: number;
  email: string;
  password_enc: string;
  cash: number;
  coins: number;
  cars: number;
  base_slots: number;
  slots: number;
  notes: string;
  archived: number;
  coins_spent_on_cars: number;
  /** Which Car Parking Multiplayer title this account belongs to. */
  game: GameType;
  /** CPM2 only: the account owns the purchasable second garage (R299.99). */
  new_garage: number;
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

const ACCOUNT_COLUMNS = `
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT    NOT NULL,
  password_enc TEXT    NOT NULL,
  cash         INTEGER NOT NULL DEFAULT 0,
  coins        INTEGER NOT NULL DEFAULT 0,
  cars         INTEGER NOT NULL DEFAULT 0,
  base_slots   INTEGER NOT NULL DEFAULT 20,
  slots        INTEGER NOT NULL DEFAULT 0,
  notes        TEXT    NOT NULL DEFAULT '',
  archived     INTEGER NOT NULL DEFAULT 0,
  coins_spent_on_cars INTEGER NOT NULL DEFAULT 0,
  game         TEXT    NOT NULL DEFAULT 'cpm2',
  new_garage   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  CHECK (length(email) > 2 AND length(email) <= 254),
  CHECK (cash >= 0 AND cash <= 50000000),
  CHECK (coins >= 0 AND coins <= 30000),
  CHECK (base_slots >= 0 AND base_slots <= 999),
  CHECK (cars >= 0 AND cars <= CASE WHEN game = 'cpm1'
      THEN ${MAX_CARS}
      ELSE base_slots + slots + new_garage * ${LIMITS.NEW_GARAGE_SLOTS} END),
  CHECK (slots >= 0 AND slots <= ${LIMITS.MAX_COIN_SLOTS}),
  CHECK (new_garage IN (0, 1)),
  CHECK (coins_spent_on_cars >= 0),
  CHECK (game IN ('cpm1', 'cpm2')),
  CHECK (game <> 'cpm1' OR (base_slots = 0 AND slots = 0 AND new_garage = 0))
`;

/**
 * A car in a garage. `game` is NOT decoration and NOT derivable from
 * account_id alone at query time without a join — car codes collide between
 * the two titles (CPM1 #13 = 2007 Peugeot 308, CPM2 #13 = HONDA CIVIC), so the
 * code only identifies a car once the game is known.
 */
const CAR_TABLE_COLUMNS = `
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  car_code   INTEGER NOT NULL,
  game       TEXT    NOT NULL DEFAULT 'cpm2',
  notes      TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL,
  CHECK (car_code >= 0 AND car_code <= 9999),
  CHECK (game IN ('cpm1', 'cpm2')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (${ACCOUNT_COLUMNS});

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

CREATE TABLE IF NOT EXISTS account_cars (${CAR_TABLE_COLUMNS});

CREATE INDEX IF NOT EXISTS idx_account_cars_account
  ON account_cars (account_id);
`;

/**
 * Indexes over the `game` column. These CANNOT live in SCHEMA: on an existing
 * database SCHEMA's CREATE TABLE IF NOT EXISTS is a no-op, so `game` only
 * arrives later via migrate() — and an index over a column that does not exist
 * yet is a hard SQLITE_ERROR that would crash the app on boot. They run after
 * the migration instead.
 */
const GAME_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_account_cars_game
  ON account_cars (account_id, game);

CREATE INDEX IF NOT EXISTS idx_accounts_game
  ON accounts (game);
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
  // After migrate(): the game columns must exist before they can be indexed,
  // and the table rebuilds inside migrate() drop any index on the old table.
  db.exec(GAME_INDEXES);
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
  if (!columns.some((column) => column.name === "base_slots")) {
    db.exec(`ALTER TABLE accounts ADD COLUMN base_slots INTEGER NOT NULL DEFAULT 20`);
  }

  // Game discriminator. Every row that predates CPM1 support is a CPM2 row,
  // so DEFAULT 'cpm2' IS the correct backfill — SQLite applies the default to
  // existing rows on ADD COLUMN, which is why no separate UPDATE is needed.
  // This must run BEFORE the table rebuilds below: those rebuilds copy the
  // `game` column, so it has to exist first.
  if (!columns.some((column) => column.name === "game")) {
    db.exec(
      `ALTER TABLE accounts ADD COLUMN game TEXT NOT NULL DEFAULT 'cpm2'
         CHECK (game IN ('cpm1', 'cpm2'))`,
    );
  }

  // The purchasable second garage (CPM2 only). Existing rows never owned it.
  if (!columns.some((column) => column.name === "new_garage")) {
    db.exec(`ALTER TABLE accounts ADD COLUMN new_garage INTEGER NOT NULL DEFAULT 0`);
  }

  const garages = db.prepare(`PRAGMA table_info(account_cars)`).all() as { name: string }[];
  if (garages.length && !garages.some((column) => column.name === "game")) {
    db.exec(
      `ALTER TABLE account_cars ADD COLUMN game TEXT NOT NULL DEFAULT 'cpm2'
         CHECK (game IN ('cpm1', 'cpm2'))`,
    );
  }

  // The garage CHECK is game-aware now (CPM1 has no slots, CPM2 has the coin
  // slot and the second garage). SQLite cannot alter a CHECK, so the table is
  // rebuilt once when the current constraint is still the old flat one.
  const table = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'accounts'`)
    .get() as { sql: string } | undefined;
  if (table && !/CASE\s+WHEN\s+game\s*=\s*'cpm1'/i.test(table.sql)) {
    rebuildAccounts(db);
  }

  const garageTable = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'account_cars'`)
    .get() as { sql: string } | undefined;
  if (
    garageTable &&
    /UNIQUE\s*\(\s*account_id\s*,\s*car_code\s*\)/i.test(garageTable.sql)
  ) {
    rebuildGarage(db);
  }
}

function rebuildAccounts(db: Database.Database): void {
  // SQLite rewrites the foreign keys of OTHER tables when a table is renamed,
  // so `account_cars` would end up pointing at the temporary `accounts_legacy`
  // name — and dropping that table would then fail the FK check. Foreign keys
  // off + legacy_alter_table keeps `account_cars` pointing at `accounts`.
  db.pragma("foreign_keys = OFF");
  db.pragma("legacy_alter_table = ON");
  try {
    db.transaction(() => {
      db.exec(`ALTER TABLE accounts RENAME TO accounts_legacy`);
      db.exec(`DROP INDEX IF EXISTS idx_accounts_email`);
      db.exec(`CREATE TABLE accounts (${ACCOUNT_COLUMNS})`);
      // CPM1 rows are copied with their slots zeroed: CPM1 has no slots, so a
      // legacy row that still carries the CPM2 default (20 base) would fail the
      // new "CPM1 has no slots" CHECK.
      db.exec(
        `INSERT INTO accounts
           (id, email, password_enc, cash, coins, cars, base_slots, slots, notes,
            archived, coins_spent_on_cars, game, new_garage, created_at, updated_at)
         SELECT id, email, password_enc, cash, coins, cars,
                CASE WHEN game = 'cpm1' THEN 0 ELSE base_slots END,
                CASE WHEN game = 'cpm1' THEN 0 ELSE slots END,
                notes, archived, coins_spent_on_cars, game,
                CASE WHEN game = 'cpm1' THEN 0 ELSE new_garage END,
                created_at, updated_at
           FROM accounts_legacy`,
      );
      db.exec(`DROP TABLE accounts_legacy`);
      db.exec(`CREATE UNIQUE INDEX idx_accounts_email ON accounts (email COLLATE NOCASE)`);
    })();
  } finally {
    db.pragma("legacy_alter_table = OFF");
    db.pragma("foreign_keys = ON");
  }
}

function rebuildGarage(db: Database.Database): void {
  db.transaction(() => {
    db.exec(`ALTER TABLE account_cars RENAME TO account_cars_legacy`);
    db.exec(`DROP INDEX IF EXISTS idx_account_cars_account`);
    db.exec(`CREATE TABLE account_cars (${CAR_TABLE_COLUMNS})`);
    db.exec(
      `INSERT INTO account_cars (id, account_id, car_code, game, notes, created_at)
       SELECT id, account_id, car_code, game, notes, created_at FROM account_cars_legacy`,
    );
    db.exec(`DROP TABLE account_cars_legacy`);
    db.exec(`CREATE INDEX idx_account_cars_account ON account_cars (account_id)`);
  })();
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
