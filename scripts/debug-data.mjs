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
    if (data[table].length > 0) {
      console.log(`  First row keys:`, Object.keys(data[table][0]));
      console.log(`  First row values:`, Object.values(data[table][0]));
      console.log(`  First row types:`, Object.entries(data[table][0]).map(([k,v]) => `${k}: ${typeof v} (${v === null ? 'null' : v})`));
    }
  } catch {
    console.log(`${table}: table does not exist locally`);
    data[table] = [];
  }
}

localDb.close();
