// Read-only: all media rows for the products that render data: URLs on /store
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

const resp = await fetch(`${url}/v2/pipeline`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    requests: [
      {
        type: "execute",
        stmt: {
          sql: `SELECT id, product_id, provider, sort_order, is_published, length(public_url), substr(public_url, 1, 60) FROM vanta_product_media WHERE public_url LIKE 'data:%' OR length(public_url) > 200 ORDER BY product_id, sort_order`,
          args: [],
        },
      },
      {
        type: "execute",
        stmt: {
          sql: `SELECT id, product_id, provider, sort_order, is_published, length(public_url), substr(public_url, 1, 60) FROM vanta_product_media WHERE product_id = 86 ORDER BY sort_order`,
          args: [],
        },
      },
    ],
  }),
});
const data = await resp.json();
const dataUrls = data.results?.[0]?.response?.result?.rows ?? [];
const p86 = data.results?.[1]?.response?.result?.rows ?? [];
console.log(`data-URL/oversized media rows: ${dataUrls.length}`);
for (const r of dataUrls) console.log("  " + r.map((v) => v?.value).join(" | "));
console.log(`product 86 media rows: ${p86.length}`);
for (const r of p86) console.log("  " + r.map((v) => v?.value).join(" | "));
