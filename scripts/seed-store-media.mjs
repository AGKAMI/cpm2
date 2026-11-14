/**
 * VANTA GARAGE media seeder — attaches a curated Unsplash car photo to every
 * published product that has NO media yet. Leaves existing media untouched.
 * Photos are pooled per category so cards look plausible, cycled by product id
 * for deterministic assignment. Idempotent: re-running finds nothing to do.
 *
 * User-approved 2026-11-14 ("IMAGES AINT RENDERING" after the catalog re-seed).
 * All photo URLs verified HTTP 200 at time of writing.
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
const rowsOf = (result) => result?.[0]?.response?.result?.rows ?? [];

const unsplash = (id) => `/store-covers/${id}.jpg`;

// category_id -> photo pool (verified Unsplash car photos)
// 6 Hatchback, 5 Coupes, 4 Sedans, 3 4x4, 1 SUV, 2 Offroad
const POOLS = {
  6: ["1502877338535-766e1452684a", "1494905998402-395d579af36f", "1555215695-3004980ad54e", "1552519507-da3b142c6e3d"],
  5: ["1494976388531-d1058494cdd8", "1502877338535-766e1452684a", "1511919884226-fd3cad34687c", "1494905998402-395d579af36f", "1583121274602-3e2820c69888", "1605559424843-9e4c228bf1c2", "1619405399517-d7fce0f13302"],
  4: ["1555215695-3004980ad54e", "1580273916550-e323be2ae537", "1616422285623-13ff0162193c", "1503376780353-7e6692767b70", "1568605117036-5fe5e7bab0b7"],
  3: ["1533473359331-0135ef1b58bf", "1568605117036-5fe5e7bab0b7"],
  1: ["1533473359331-0135ef1b58bf", "1555215695-3004980ad54e"],
  2: ["1533473359331-0135ef1b58bf", "1552519507-da3b142c6e3d", "1568605117036-5fe5e7bab0b7"],
  null: ["1580273916550-e323be2ae537", "1605559424843-9e4c228bf1c2", "1503376780353-7e6692767b70", "1619405399517-d7fce0f13302", "1494905998402-395d579af36f", "1555215695-3004980ad54e"],
};

// Published products with no media row yet
const res = await pipeline([
  {
    type: "execute",
    stmt: {
      sql: `SELECT p.id, p.category_id FROM vanta_products p
            WHERE p.is_published = 1
              AND NOT EXISTS (SELECT 1 FROM vanta_product_media m WHERE m.product_id = p.id)
            ORDER BY p.id`,
      args: [],
    },
  },
]);
const products = rowsOf(res).map((r) => ({
  id: Number(r[0].value),
  categoryId: r[1]?.value == null ? null : Number(r[1].value),
}));
console.log(`Products without media: ${products.length}`);

const now = new Date().toISOString();
const requests = products.map(({ id, categoryId }) => {
  const pool = POOLS[categoryId] ?? POOLS.null;
  const photo = pool[id % pool.length];
  return {
    type: "execute",
    stmt: {
      sql: `INSERT INTO vanta_product_media
            (product_id, provider, provider_id, public_url, file_type, sort_order, version, is_published, uploaded_at)
            VALUES (${id}, 'local', '', '${unsplash(photo)}', 'image', 0, 1, 1, '${now}')`,
      args: [],
    },
  };
});
if (requests.length) await pipeline(requests);
console.log(`Inserted ${requests.length} media rows.`);

const after = await pipeline([
  { type: "execute", stmt: { sql: "SELECT COUNT(*) AS n FROM vanta_product_media", args: [] } },
]);
console.log(`Media rows total: ${after[0]?.response?.result?.rows?.[0]?.[0]?.value ?? "?"}`);
