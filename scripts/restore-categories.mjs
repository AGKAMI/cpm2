// Restore categories to the Turso database.
// Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env.local.

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}

const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();

if (!url || !token) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.local");
  process.exit(1);
}

async function execute(sql, args = []) {
  const resp = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql, args } }] }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

const categories = [
  { name: "Hatchback", slug: "hatchback", description: "Compact hatchbacks", sortOrder: 1 },
  { name: "Coupes", slug: "coupes", description: "Two-door coupes", sortOrder: 2 },
  { name: "Sedans", slug: "sedans", description: "Four-door sedans", sortOrder: 3 },
  { name: "4x4", slug: "4x4", description: "Four-wheel drive", sortOrder: 4 },
  { name: "SUV", slug: "suv", description: "Sport utility vehicles", sortOrder: 5 },
  { name: "Offroad", slug: "offroad", description: "Off-road vehicles", sortOrder: 6 },
];

async function main() {
  // Count before
  const before = await execute("SELECT COUNT(*) AS c FROM vanta_categories");
  const beforeCount = before.results[0].response.result.rows[0][0].value;
  console.log(`Categories before: ${beforeCount}`);

  // Insert each category
  for (const cat of categories) {
    await execute(
      `INSERT INTO vanta_categories (name, slug, description, sort_order, is_active) VALUES (?, ?, ?, ?, 1)`,
      [cat.name, cat.slug, cat.description ?? null, cat.sortOrder]
    );
    console.log(`Created category: ${cat.name}`);
  }

  // Count after
  const after = await execute("SELECT COUNT(*) AS c FROM vanta_categories");
  const afterCount = after.results[0].response.result.rows[0][0].value;
  console.log(`Categories after: ${afterCount}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
