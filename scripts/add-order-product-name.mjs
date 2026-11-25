// Migration: vanta_orders.product_name — the snapshot of what was bought.
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
const cols = await db.execute({ sql: `PRAGMA table_info(vanta_orders)`, args: [] });
if (cols.rows.some(r => r.name === "product_name")) { console.log("already present"); }
else {
  await db.execute({ sql: `ALTER TABLE vanta_orders ADD COLUMN product_name TEXT`, args: [] });
  console.log("product_name column added");
}
