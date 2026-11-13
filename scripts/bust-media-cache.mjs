/**
 * One-off cache-buster: appends `&v=2` to every seeded Unsplash media URL so the
 * `/_next/image` URL changes and Chromium drops its cached 400 failures
 * (same cache-key lesson as the logo rename). Idempotent — skips already-versioned rows.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();
if (!url || !token) throw new Error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing");

async function pipeline(requests) {
  const resp = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!resp.ok) throw new Error(`Turso HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const bad = data.results?.find((r) => r.type !== "ok");
  if (bad) throw new Error(`Turso error: ${JSON.stringify(bad)}`);
  return data.results;
}
const count = async (sql) => {
  const r = await pipeline([{ type: "execute", stmt: { sql, args: [] } }]);
  return r[0]?.response?.result?.rows?.[0]?.[0]?.value ?? "?";
};

const WHERE =
  "public_url LIKE '%auto=format&fit=crop&w=1200%' AND public_url NOT LIKE '%&v=%'";
console.log("to update:", await count(`SELECT COUNT(*) FROM vanta_product_media WHERE ${WHERE}`));

await pipeline([
  {
    type: "execute",
    stmt: {
      sql: `UPDATE vanta_product_media SET public_url = public_url || '&v=2' WHERE ${WHERE}`,
      args: [],
    },
  },
]);
console.log("now versioned:", await count("SELECT COUNT(*) FROM vanta_product_media WHERE public_url LIKE '%&v=2%'"));
