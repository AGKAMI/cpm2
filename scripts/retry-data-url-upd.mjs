// Retry: update the 2 legacy data-URL media rows to local file paths
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

const updates = [["/store-covers/cover-p28.jpg", 13], ["/store-covers/cover-p29.jpg", 14]];
const resp = await fetch(`${url}/v2/pipeline`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    requests: updates.map(([path, id]) => ({
      type: "execute",
      stmt: {
        sql: `UPDATE vanta_product_media SET public_url = ?, original_ref = '', file_type = 'image' WHERE id = ?`,
        args: [{ type: "text", value: path }, { type: "integer", value: String(id) }],
      },
    })),
  }),
});
const text = await resp.text();
console.log(`status ${resp.status}`);
console.log(text.slice(0, 800));
