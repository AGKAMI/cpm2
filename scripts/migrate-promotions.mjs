// One-off: add game / product_id / pill_color to vanta_promotions (idempotent).
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
const cols = await db.execute({ sql: `PRAGMA table_info(vanta_promotions)`, args: [] });
const have = new Set(cols.rows.map(r => String(r.name)));
for (const [col, ddl] of [
  ["game", "ALTER TABLE vanta_promotions ADD COLUMN game TEXT"],
  ["product_id", "ALTER TABLE vanta_promotions ADD COLUMN product_id INTEGER REFERENCES vanta_products(id) ON DELETE SET NULL"],
  ["pill_color", "ALTER TABLE vanta_promotions ADD COLUMN pill_color TEXT NOT NULL DEFAULT '#d4af4f'"],
]) {
  if (have.has(col)) { console.log(col, "already present"); continue; }
  await db.execute({ sql: ddl, args: [] });
  console.log(col, "added");
}
const after = await db.execute({ sql: `PRAGMA table_info(vanta_promotions)`, args: [] });
console.log("columns now:", after.rows.map(r => r.name).join(", "));
