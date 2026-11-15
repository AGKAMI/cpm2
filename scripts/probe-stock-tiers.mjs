// Verify initial_stock migration + ratio tiers (read-only)
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

const resp = await fetch(`${url}/v2/pipeline`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    requests: [
      {
        type: "execute",
        stmt: {
          sql: `SELECT id, name, stock_quantity, initial_stock FROM vanta_products WHERE is_published = 1 ORDER BY id LIMIT 30`,
          args: [],
        },
      },
    ],
  }),
});
const data = await resp.json();
const rows = data.results?.[0]?.response?.result?.rows ?? [];
console.log(`published products: ${rows.length}`);
for (const r of rows) {
  const [, name, stock, initial] = r.map((v) => v.value);
  const s = Number(stock), i = Number(initial);
  let tier = "no-baseline";
  if (s === 0 || s < 5) tier = "bad";
  else if (i > 0) tier = s / i > 2 / 3 ? "ok" : s / i > 1 / 3 ? "warn" : "bad";
  console.log(`  #${r[0].value}  stock=${s}  initial=${i}  tier=${tier}  ${String(name).slice(0, 40)}`);
}
