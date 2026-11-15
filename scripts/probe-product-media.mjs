// Read-only: which published products have media rows (simple queries, joined in JS)
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

const t0 = Date.now();
const resp = await fetch(`${url}/v2/pipeline`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    requests: [
      {
        type: "execute",
        stmt: {
          sql: `SELECT id, name, is_featured FROM vanta_products WHERE is_published = 1 ORDER BY is_featured DESC, id`,
          args: [],
        },
      },
      {
        type: "execute",
        stmt: {
          sql: `SELECT product_id, public_url, sort_order FROM vanta_product_media WHERE is_published = 1 ORDER BY product_id, sort_order`,
          args: [],
        },
      },
    ],
  }),
});
const data = await resp.json();
const products = data.results?.[0]?.response?.result?.rows ?? [];
const media = data.results?.[1]?.response?.result?.rows ?? [];

const mediaByProduct = new Map();
for (const r of media) {
  const pid = r[0].value;
  if (!mediaByProduct.has(pid)) mediaByProduct.set(pid, []);
  mediaByProduct.get(pid).push(r[1].value);
}

console.log(`products: ${products.length}, media rows: ${media.length} (${Date.now() - t0}ms)`);
let withMedia = 0;
for (const p of products) {
  const [id, name, feat] = p.map((v) => v?.value);
  const urls = mediaByProduct.get(id) ?? [];
  if (urls.length) withMedia++;
  console.log(`  #${id} feat=${feat} media=${urls.length}  ${String(name).slice(0, 34).padEnd(34)} ${urls[0] ?? "-"}`);
}
console.log(`with media: ${withMedia}/${products.length}`);
