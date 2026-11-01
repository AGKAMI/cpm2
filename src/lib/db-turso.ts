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

CREATE TABLE IF NOT EXISTS trade_prices (
  game       TEXT    NOT NULL,
  code       INTEGER NOT NULL,
  kind       TEXT    NOT NULL,
  price      REAL    NOT NULL,
  updated_at TEXT    NOT NULL,
  PRIMARY KEY (game, code),
  CHECK (game IN ('cpm1', 'cpm2')),
  CHECK (kind IN ('paid', 'coin', 'cash')),
  CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS trade_rates (
  key   TEXT PRIMARY KEY,
  value REAL NOT NULL,
  CHECK (value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_account_cars_game
  ON account_cars (account_id, game);

CREATE INDEX IF NOT EXISTS idx_accounts_game
  ON accounts (game);
`;

/**
 * Lightweight libSQL client wrapper that speaks the Turso /v2/pipeline
 * endpoint via fetch. This avoids the @libsql/client Hrana stream quirk that
 * returns HTTP 400 on this host.
 */
class TursoHttpClient {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  async execute(
      sqlOrStmt: string | { sql: string; args: unknown[] },
      args?: unknown[],
    ): Promise<{
      cols: string[];
      rows: Record<string, unknown>[];
      affectedRowCount: number;
      lastInsertRowid: number | null;
    }> {
      let sql: string;
      let stmtArgs: unknown[];
      if (typeof sqlOrStmt === "string") {
        sql = sqlOrStmt;
        stmtArgs = args || [];
      } else {
        sql = sqlOrStmt.sql;
        stmtArgs = sqlOrStmt.args || [];
      }
      const resp = await fetch(`${this.url}/v2/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{ type: "execute", stmt: { sql, args: stmtArgs } }],
        }),
      });
    if (!resp.ok) {
      throw new Error(`Turso HTTP ${resp.status}: ${await resp.text()}`);
    }
    const data = await resp.json();
    const result = data.results?.[0];
    if (!result || result.type !== "ok") {
      throw new Error(`Turso error: ${JSON.stringify(data)}`);
    }
    const res = result.response.result;
    return {
      cols: res.cols.map((c: { name: string }) => c.name),
      rows: res.rows.map((r: { [key: string]: unknown }) =>
        Object.fromEntries(
          r.map((v: { value: unknown }, i: number) => [res.cols[i].name, v.value]),
        ),
      ),
      affectedRowCount: res.affected_row_count ?? 0,
      lastInsertRowid: res.last_insert_rowid ?? null,
    };
  }

  async batch(sqls: string[]): Promise<void> {
      const resp = await fetch(`${this.url}/v2/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: sqls.map((s) => ({ type: "execute", stmt: { sql: s, args: [] } })),
        }),
      });
    if (!resp.ok) {
      throw new Error(`Turso batch HTTP ${resp.status}: ${await resp.text()}`);
    }
  }
}

function getTursoUrl(): string {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL not set");
  // Normalize libsql:// to https:// for the HTTP endpoint
  return url.replace(/^libsql:\/\//, "https://");
}

function getTursoToken(): string {
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!token) throw new Error("TURSO_AUTH_TOKEN not set");
  return token;
}

let _http: TursoHttpClient | null = null;

export async function createTursoClient(): Promise<TursoHttpClient> {
  if (_http) return _http;
  _http = new TursoHttpClient(getTursoUrl(), getTursoToken());
  // Apply schema (idempotent — IF NOT EXISTS everywhere)
  await _http.batch(
    SCHEMA.trim().split(";").filter((s) => s.trim()).map((s) => s.trim() + ";"),
  );
  return _http;
}

let _client: TursoHttpClient | null = null;

export async function getTursoDb(): Promise<TursoHttpClient> {
  if (_client) return _client;
  _client = await createTursoClient();
  return _client;
}

export async function closeTursoDb(): Promise<void> {
  _client = null;
}