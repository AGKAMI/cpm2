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
const m = await db.execute({ sql: `SELECT * FROM vanta_product_media`, args: [] });
console.log("MEDIA ROWS:", m.rows.length);
for (const r of m.rows) console.log(`product=${r.product_id} pub=${r.is_published} type=${r.file_type} provider=${r.provider} sort=${r.sort_order}\n  url=${r.public_url}`);
