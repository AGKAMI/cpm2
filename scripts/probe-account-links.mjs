// READ-ONLY: who do the accounts belong to (user_id links)?
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

async function pipeline(requests) {
  const resp = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!resp.ok) throw new Error(`Turso HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.results.map((r) => r?.response?.result?.rows ?? []);
}
const v = (r) => (r ?? []).map((row) => row.map((c) => c.value));

const rows = await pipeline([
  { type: "execute", stmt: { sql: "SELECT COALESCE(user_id, 'NULL'), game, COUNT(*) FROM accounts GROUP BY user_id, game", args: [] } },
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM events", args: [] } },
  { type: "execute", stmt: { sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", args: [] } },
]);
const [links, events, tables] = rows;
console.log("== accounts by user_id x game ==");
console.log(JSON.stringify(v(links)));
console.log("== total events ==");
console.log(JSON.stringify(v(events)));
console.log("== tables ==");
console.log(v(tables).flat().join(", "));
