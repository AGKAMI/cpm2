// One-off: snapshot names on orders that predate the product_name column
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
const orders = await db.execute({ sql: `SELECT o.id, o.product_id, p.name FROM vanta_orders o LEFT JOIN vanta_products p ON p.id = o.product_id WHERE o.product_name IS NULL OR o.product_name = ''`, args: [] });
let fixed = 0, gone = 0;
for (const o of orders.rows) {
  const name = o.name ? String(o.name) : `Product #${o.product_id} (removed)`;
  await db.execute({ sql: `UPDATE vanta_orders SET product_name = ? WHERE id = ?`, args: [name, o.id] });
  if (o.name) fixed++; else gone++;
  console.log(` ${o.id}: product ${o.product_id} -> ${name}`);
}
console.log(`BACKFILLED=${orders.rows.length} named=${fixed} productGone=${gone}`);
