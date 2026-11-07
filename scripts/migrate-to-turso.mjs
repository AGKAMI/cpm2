import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.join("data", "cpm2.db");
if (!fs.existsSync(dbPath)) {
  console.error(`Local DB not found at ${dbPath}`);
  process.exit(1);
}

const localDb = new Database(dbPath);
localDb.pragma("busy_timeout = 5000");

const TABLES = ["accounts", "account_cars", "account_trophies", "account_events", "trade_prices", "trade_rates"];

const data = {};
for (const table of TABLES) {
  try {
    data[table] = localDb.prepare(`SELECT * FROM ${table}`).all();
    console.log(`${table}: ${data[table].length} rows`);
  } catch {
    console.log(`${table}: table does not exist locally`);
    data[table] = [];
  }
}

localDb.close();

const TURSO_URL = "https://kami-cpm-fleet-agkami.aws-us-east-1.turso.io";
const TURSO_TOKEN = fs.readFileSync(
  "C:/Users/ojuni/AppData/Local/hermes/cache/scratch/turso_token.txt",
  "utf8",
).trim();

function toHranaValue(v) {
  if (typeof v === "bigint") return { type: "integer", value: v.toString() };
  if (typeof v === "number") {
    if (Number.isInteger(v)) return { type: "integer", value: v };
    return { type: "float", value: v };
  }
  if (typeof v === "string") {
    // Try to parse numeric strings
    if (/^-?\d+$/.test(v)) return { type: "integer", value: v };
    if (/^-?\d*\.\d+$/.test(v)) return { type: "float", value: v };
    return { type: "text", value: v };
  }
  if (typeof v === "boolean") return { type: "integer", value: v ? "1" : "0" };
  if (v === null || v === undefined) return { type: "null", value: null };
  return { type: "text", value: String(v) };
}

async function tursoExecute(sql, args = []) {
  const hranaArgs = args.map(toHranaValue);
  const resp = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql, args: hranaArgs } }],
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
  return result.response.result;
}

async function insertRow(table, row) {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  await tursoExecute(sql, Object.values(row));
}

async function main() {
  for (const table of TABLES.reverse()) {
    try {
      await tursoExecute(`DELETE FROM ${table}`);
      console.log(`Cleared ${table}`);
    } catch (e) {
      console.log(`${table}: clear failed (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  for (const row of data.accounts) {
    await insertRow("accounts", row);
  }
  console.log(`Inserted ${data.accounts.length} accounts`);

  for (const table of ["account_cars", "account_trophies", "account_events", "trade_prices", "trade_rates"]) {
    for (const row of data[table]) {
      await insertRow(table, row);
    }
    console.log(`Inserted ${data[table].length} rows into ${table}`);
  }

  console.log("Migration complete!");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
