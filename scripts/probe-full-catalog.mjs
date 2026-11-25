// One-off: the COMPLETE product state, no filters
import fs from "fs";
for (const raw of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim(); const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[line.slice(0, i).trim()] = v;
}
const { getStoreDb } = await import("../src/lib/store-db.ts");
const db = await getStoreDb();
const cols = await db.execute({ sql: `PRAGMA table_info(vanta_products)`, args: [] });
console.log("PRODUCT COLUMNS:", cols.rows.map(r => r.name).join(", "));
const p = await db.execute({ sql: `SELECT * FROM vanta_products ORDER BY id`, args: [] });
console.log("TOTAL PRODUCTS:", p.rows.length);
for (const r of p.rows) console.log(` ${r.id} | ${r.name} | game=${r.game} kind=${r.kind} pub=${r.is_published} cat=${r.category_id || "-"} | stock=${r.stock_quantity}`);
const m = await db.execute({ sql: `SELECT product_id, COUNT(*) c FROM vanta_product_media GROUP BY product_id`, args: [] });
console.log("MEDIA per product:", m.rows.map(r => `${r.product_id}:${r.c}`).join(" "));
const c = await db.execute({ sql: `SELECT id, name, game, kind, is_active FROM vanta_categories ORDER BY id`, args: [] });
console.log("CATEGORIES:", c.rows.map(r => `${r.id}:${r.name}(${r.game||"-"}/${r.kind||"-"}${r.is_active?"":" INACTIVE"})`).join(" "));
const o = await db.execute({ sql: `SELECT id, product_id, product_name, order_state, payment_state FROM vanta_orders ORDER BY created_at DESC LIMIT 15`, args: [] });
console.log("ORDERS:", o.rows.map(r => `${r.id}:p${r.product_id}:${r.product_name ?? "NO-SNAPSHOT"}:${r.order_state}`).join("\n "));
