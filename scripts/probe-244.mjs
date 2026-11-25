// One-off: recover what product 244 was, from anything still linked to it
import { getStoreDb } from "../src/lib/store-db.ts";
const db = await getStoreDb();
const tables = ["vanta_uploads", "vanta_media", "vanta_product_media", "vanta_account_units", "vanta_stock"];
for (const t of tables) {
  try {
    const r = await db.execute({ sql: `SELECT * FROM ${t} WHERE product_id = 244 LIMIT 5`, args: [] });
    console.log(t, "->", JSON.stringify(r.rows).slice(0, 300));
  } catch (e) { console.log(t, "-> n/a"); }
}
