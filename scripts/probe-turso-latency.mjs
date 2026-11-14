// One-off probe: time a single direct Turso round trip + N sequential round trips.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

const q = async () => {
  const t0 = Date.now();
  const r = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql: "SELECT COUNT(*) FROM vanta_products", args: [] } }] }),
  });
  await r.json();
  return Date.now() - t0;
};

console.log("host:", url.replace("https://", "").split(".")[0], "…");
console.log("trip 1:", await q(), "ms");
console.log("trip 2:", await q(), "ms");
console.log("trip 3:", await q(), "ms");

// simulate what /store does: 10 sequential per-product media queries
let seqTotal = 0;
for (let i = 0; i < 10; i++) seqTotal += await q();
console.log("10 sequential queries:", seqTotal, "ms (avg", Math.round(seqTotal / 10), "ms each)");
