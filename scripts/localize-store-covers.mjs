/**
 * Localizes store cover photos: downloads every unique Unsplash URL referenced
 * by vanta_product_media once into public/store-covers/<photo-id>.jpg, then
 * rewrites the media rows to local paths. After this, product cards never hit
 * Unsplash at render time (it became slow/throttled — optimizer 504s, blank pages).
 * Idempotent: skips URLs already localized.
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { writeFileSync } from "node:fs";
import path from "node:path";

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
  const bad = data.results?.find((r) => r.type !== "ok");
  if (bad) throw new Error(`Turso error: ${JSON.stringify(bad)}`);
  return data.results;
}
const rowsOf = (r) => r?.[0]?.response?.result?.rows ?? [];

const outDir = path.join(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "public", "store-covers");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Unique unsplash URLs currently referenced
const sel = await pipeline([
  {
    type: "execute",
    stmt: {
      sql: `SELECT DISTINCT public_url FROM vanta_product_media WHERE public_url LIKE '%images.unsplash.com%'`,
      args: [],
    },
  },
]);
const urls = rowsOf(sel).map((r) => String(r[0].value));
console.log(`unique unsplash urls: ${urls.length}`);

const photoIdOf = (u) => (u.match(/photo-([0-9a-f-]{10,})/) || [])[1];
const canonical = (u) => {
  const id = photoIdOf(u);
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
};

const updates = [];
for (const u of urls) {
  const id = photoIdOf(u);
  if (!id) {
    console.log(`skip (no id): ${u.slice(0, 80)}`);
    continue;
  }
  const localRel = `/store-covers/${id}.jpg`;
  const file = path.join(outDir, `${id}.jpg`);
  if (!existsSync(file)) {
    const t0 = Date.now();
    const r = await fetch(canonical(u), { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) {
      console.log(`DOWNLOAD FAILED ${r.status}: ${id}`);
      continue;
    }
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    console.log(`downloaded ${id} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } else {
    console.log(`already have ${id}`);
  }
  updates.push({ from: u, to: localRel });
}

// Rewrite rows (one statement per distinct URL — safe, exact-match UPDATE)
const text = (v) => ({ type: "text", value: String(v) });
let n = 0;
for (const { from, to } of updates) {
  await pipeline([
    {
      type: "execute",
      stmt: {
        sql: "UPDATE vanta_product_media SET public_url = ? WHERE public_url = ?",
        args: [text(to), text(from)],
      },
    },
  ]);
  n++;
}
console.log(`updated ${n} distinct urls -> local paths`);
const check = await pipeline([
  { type: "execute", stmt: { sql: "SELECT COUNT(*) FROM vanta_product_media WHERE public_url LIKE '%images.unsplash.com%'", args: [] } },
]);
console.log(`remaining unsplash rows: ${check[0]?.response?.result?.rows?.[0]?.[0]?.value ?? "?"}`);
