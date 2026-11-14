// READ-ONLY diagnostic: what happened to the fleet accounts?
// Counts, per-game split, archived, recent events (deletions are event-logged), recent rows.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

const text = (v) => ({ type: "text", value: String(v) });
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

const rows = await pipeline([
  // 1. accounts: total / by game / archived
  { type: "execute", stmt: { sql: "SELECT game, archived, COUNT(*) FROM accounts GROUP BY game, archived", args: [] } },
  // 2. users
  { type: "execute", stmt: { sql: "SELECT id, email, telegram_user_id, created_at FROM users ORDER BY id", args: [] } },
  // 3. recent events (state change log) — last 40
  { type: "execute", stmt: { sql: "SELECT id, account_email, type, summary, created_at FROM events ORDER BY id DESC LIMIT 40", args: [] } },
  // 4. any delete-typed events
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM events WHERE type LIKE '%delete%' OR type LIKE '%remove%'", args: [] } },
  // 5. most recently created accounts
  { type: "execute", stmt: { sql: "SELECT id, email, game, archived, created_at, updated_at FROM accounts ORDER BY id DESC LIMIT 12", args: [] } },
  // 6. earliest account / max updated_at (when did the table last change)
  { type: "execute", stmt: { sql: "SELECT MIN(created_at), MAX(updated_at) FROM accounts", args: [] } },
  // 7. vanta_customers (store customers)
  { type: "execute", stmt: { sql: "SELECT id, telegram_user_id, email, created_at FROM vanta_customers ORDER BY id DESC LIMIT 10", args: [] } },
  // 8. fleet_account_images count (added recently by another agent)
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM fleet_account_images", args: [] } },
]);

const [byGame, users, recentEvents, delEvents, recentAccounts, accountSpan, customers, images] = rows;
const v = (r) => (r ?? []).map((row) => row.map((c) => c.value));
console.log("== accounts by game/archived ==");
console.log(JSON.stringify(v(byGame)));
console.log("== users ==");
console.log(JSON.stringify(v(users)));
console.log("== last 40 events (id, email, type, summary, at) ==");
for (const r of v(recentEvents)) console.log(r.join(" | "));
console.log("== delete/remove event count ==");
console.log(JSON.stringify(v(delEvents)));
console.log("== 12 most recent accounts ==");
for (const r of v(recentAccounts)) console.log(r.join(" | "));
console.log("== account created/updated span ==");
console.log(JSON.stringify(v(accountSpan)));
console.log("== vanta_customers (last 10) ==");
console.log(JSON.stringify(v(customers)));
console.log("== fleet_account_images count ==");
console.log(JSON.stringify(v(images)));
