// One-time: convert legacy data-URL media rows to real files in public/store-covers/
// (same treatment persistDataUrlImage gives admin uploads; these 2 rows predate it)
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

const listResp = await fetch(`${url}/v2/pipeline`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    requests: [{
      type: "execute",
      stmt: {
        sql: `SELECT id, product_id, public_url FROM vanta_product_media WHERE public_url LIKE 'data:%'`,
        args: [],
      },
    }],
  }),
});
const listData = await listResp.json();
const rows = listData.results?.[0]?.response?.result?.rows ?? [];
console.log(`data-URL rows to convert: ${rows.length}`);

const updates = [];
for (const row of rows) {
  const id = row[0].value, productId = row[1].value, dataUrl = row[2].value;
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/s.exec(dataUrl);
  if (!match) { console.log(`  #${id}: unrecognized data URL, skipping`); continue; }
  const buf = Buffer.from(match[2], "base64");
  const filename = `cover-p${productId}.jpg`;
  const out = await sharp(buf).jpeg({ quality: 82 }).toBuffer();
  writeFileSync(new URL(`../public/store-covers/${filename}`, import.meta.url), out);
  console.log(`  media #${id} (product ${productId}): ${match[1]} ${(buf.length / 1024).toFixed(0)}KB -> ${filename} ${(out.length / 1024).toFixed(0)}KB`);
  updates.push([`/store-covers/${filename}`, id]);
}

if (updates.length) {
  const updResp = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: updates.map(([path, id]) => ({
        type: "execute",
        stmt: { sql: `UPDATE vanta_product_media SET public_url = ?, original_ref = '', file_type = 'image' WHERE id = ?`, args: [path, id] },
      })),
    }),
  });
  const updData = await updResp.json();
  console.log(`updated rows: ${updates.length} (status ${updResp.status})`);
  for (const r of updData.results ?? []) {
    if (r.type === "error") console.log("  ERROR:", JSON.stringify(r.error));
  }
}
console.log("done");
