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
const u = await db.execute({ sql: `SELECT filename, size_bytes, LENGTH(data_base64) AS b64len, content_type, created_at FROM vanta_uploads`, args: [] });
console.log("UPLOAD ROWS:", u.rows.length);
for (const r of u.rows) console.log(` ${r.filename} | size=${r.size_bytes} | base64=${r.b64len} chars | ${r.content_type} | ${r.created_at}`);
