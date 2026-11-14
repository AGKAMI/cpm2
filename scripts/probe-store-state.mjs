// READ-ONLY: store-side evidence — customers, orders, audit logs, verifications
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
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM vanta_customers", args: [] } },
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM vanta_orders", args: [] } },
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM vanta_wishlist", args: [] } },
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM vanta_customer_credentials", args: [] } },
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM vanta_telegram_verifications", args: [] } },
  { type: "execute", stmt: { sql: "SELECT id, action, detail, created_at FROM vanta_audit_logs ORDER BY id DESC LIMIT 25", args: [] } },
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM account_events", args: [] } },
  { type: "execute", stmt: { sql: "SELECT id, type, summary, created_at FROM account_events ORDER BY id DESC LIMIT 15", args: [] } },
]);
const labels = ["customers", "orders", "wishlist", "credentials", "tg-verifications", "audit-last25", "account_events count", "account_events last15"];
rows.forEach((r, i) => {
  console.log(`== ${labels[i]} ==`);
  console.log(JSON.stringify(v(r)));
});
