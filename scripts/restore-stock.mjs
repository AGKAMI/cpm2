// One-off: republish the Golf + Hilux (KAMI's staged stock, imageless rule
// satisfied - both have published media) and restore their 1-unit stock.
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
const now = new Date().toISOString();
for (const [id, name] of [[244, "GOLF MK7 GTI"], [262, "HILUX REVO"]]) {
  const r = await db.execute({
    sql: `UPDATE vanta_products SET is_published = 1, stock_quantity = 1, initial_stock = 1, availability_state = 'available', updated_at = ? WHERE id = ?`,
    args: [now, id],
  });
  console.log(`${id} ${name}: published=1 stock=1 (affected=${r.affectedRowCount ?? "?"})`);
}
// inventory rows: available=1, reserved=0
for (const id of [244, 262]) {
  const exists = await db.execute({ sql: `SELECT product_id FROM vanta_inventory WHERE product_id = ?`, args: [id] });
  if (exists.rows.length === 0) {
    await db.execute({ sql: `INSERT INTO vanta_inventory (product_id, stock_quantity, reserved_quantity, version, updated_at) VALUES (?, 1, 0, 1, ?)`, args: [id, now] });
    console.log(`${id}: inventory row created (available=1)`);
  } else {
    await db.execute({ sql: `UPDATE vanta_inventory SET stock_quantity = 1, reserved_quantity = 0, version = version + 1, updated_at = ? WHERE product_id = ?`, args: [now, id] });
    console.log(`${id}: inventory reset (available=1)`);
  }
}
const p = await db.execute({ sql: `SELECT id, name, is_published, stock_quantity FROM vanta_products ORDER BY id`, args: [] });
console.log("NOW:", p.rows.map(r => `${r.id}:${r.name}:pub=${r.is_published}:stock=${r.stock_quantity}`).join(" | "));
