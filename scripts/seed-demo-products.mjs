/**
 * VANTA GARAGE demo seed — fills an EMPTY store with a handful of design
 * products so the storefront can be seen working without typing them in via
 * the admin. The owner edits/unpublishes these through /store/admin.
 *
 * Guard: exits without touching anything if the catalogue already has rows.
 * Idempotent — safe to run repeatedly.
 *
 * Uses the same Turso HTTP pipeline as scripts/load-trade-prices.mjs.
 * Every product links a REAL CPM2 catalog car by code (car codes are
 * identity — never guessed), and the new design columns carry the yes/no
 * options: air_suspension / unlocked_bodykits.
 */
import { readFileSync } from "node:fs";

// --- Turso connection (the live database) ---
function tursoCreds() {
  const env = {};
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
  const token = (env.TURSO_AUTH_TOKEN || "").trim();
  if (!url || !token) {
    throw new Error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing from .env.local");
  }
  return { url, token };
}

const { url, token } = tursoCreds();

const hranaText = (v) => ({ type: "text", value: String(v) });
const hranaNum = (v) =>
  Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v };

async function pipeline(requests) {
  const resp = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!resp.ok) throw new Error(`Turso HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const bad = data.results?.find((r) => r.type !== "ok");
  if (bad) throw new Error(`Turso error: ${JSON.stringify(bad)}`);
  return data.results;
}

const unsplash = (id) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

// [cpm2CarCode, name, description, priceCents, stock, airSusp, bodykits, featured, unsplashId]
const DEMO = [
  [
    409,
    "FERRARI F40 - Midnight Chrome",
    "One-of-one F40 finish in deep midnight chrome. Unlocked bodykits for the widest stance the game allows.",
    41099, 1, false, true, true,
    "1552519507-da3b142c6e3d",
  ],
  [
    214,
    "TOYOTA CHASER JZX100 - Street Legend",
    "Slammed street-legend look with a full air suspension install. Bodykits unlocked, ready for a shakotan build.",
    25000, 3, true, true, true,
    "1494976388531-d1058494cdd8",
  ],
  [
    113,
    "VOLKSWAGEN GOLF MK6 GTI - Clubsport",
    "Clubsport-style livery and splitter. Clean, sharp, chassis-hugging kit.",
    18000, 5, false, true, true,
    "1502877338535-766e1452684a",
  ],
  [
    142,
    "MERCEDES-AMG GT 63 S 4-DOOR - Showroom Gloss",
    "Showroom-gloss finish with air suspension install. Rides like it belongs on a plinth.",
    32000, 2, true, false, false,
    "1580273916550-e323be2ae537",
  ],
  [
    5,
    "CHEVROLET CAMARO - Drag Strip",
    "Drag-strip stance: air suspension drop and unlocked bodykits for the fat rubber look.",
    21000, 4, true, true, false,
    "1568605117036-5fe5e7bab0b7",
  ],
  [
    89,
    "OPEL OMEGA B - Grand Tourer",
    "Understated grand-tourer design. No extras — a classic shapes-only finish.",
    15000, 6, false, false, false,
    null, // deliberate placeholder card — shows the no-image state too
  ],
];

const now = new Date().toISOString();

// Default categories for product filtering
const DEFAULT_CATEGORIES = [
  { name: "Sedan", slug: "sedan", description: "Four-door passenger cars" },
  { name: "Supercar", slug: "supercar", description: "High-performance exotics" },
  { name: "Hypercar", slug: "hypercar", description: "Top-tier performance machines" },
  { name: "SUV", slug: "suv", description: "Sport utility vehicles" },
  { name: "Coupe", slug: "coupe", description: "Two-door sports cars" },
  { name: "4x4", slug: "4x4", description: "Off-road capable vehicles" },
];

async function main() {
  const reset = process.argv.includes("--reset");
  if (reset) {
    // Remove rows seeded by this script (matched by cpm2 car code — stable
    // across em-dash/hyphen name variants). Also clears media.
    const codes = DEMO.map(([code]) => code);
    const placeholders = codes.map(() => "?").join(",");
    await pipeline([
      { type: "execute", stmt: { sql: `DELETE FROM vanta_product_media WHERE product_id IN (SELECT id FROM vanta_products WHERE cpm2_car_code IN (${placeholders}))`, args: codes.map(hranaNum) } },
      { type: "execute", stmt: { sql: `DELETE FROM vanta_products WHERE cpm2_car_code IN (${placeholders})`, args: codes.map(hranaNum) } },
    ]);
    // Also clear categories on reset
    await pipeline([
      { type: "execute", stmt: { sql: "DELETE FROM vanta_categories WHERE slug IN ('sedan','supercar','hypercar','suv','coupe','4x4')", args: [] } },
    ]);
  }

  // Seed default categories if none exist
  const catCheck = await pipeline([
    { type: "execute", stmt: { sql: "SELECT COUNT(*) AS n FROM vanta_categories", args: [] } },
  ]);
  const catCountRows = catCheck[0]?.response?.result?.rows ?? [];
  const catCount = Number(catCountRows[0]?.[0]?.value ?? 0);
  if (catCount === 0) {
    const catRequests = DEFAULT_CATEGORIES.map((cat, i) => ({
      type: "execute",
      stmt: {
        sql: `INSERT INTO vanta_categories (name, slug, description, sort_order, is_active, created_at)
              VALUES ('${cat.name}', '${cat.slug}', '${cat.description}', ${i + 1}, 1, '${now}')`,
        args: [],
      },
    }));
    await pipeline(catRequests);
    console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories.`);
  }

  // Guard: only seed an empty catalogue.
  const check = await pipeline([
    { type: "execute", stmt: { sql: "SELECT COUNT(*) AS n FROM vanta_products", args: [] } },
  ]);
  // Turso Hrana returns rows as ARRAYS of {type, value}.
  const countRows = check[0]?.response?.result?.rows ?? [];
  const count = Number(countRows[0]?.[0]?.value ?? 0);
  if (count > 0) {
    console.log(`Catalogue already has ${count} product(s) — nothing seeded.`);
    return;
  }

  const requests = DEMO.map(([code, name, description, priceCents, stock, air, kits, featured]) => ({
    type: "execute",
    stmt: {
      sql: `INSERT INTO vanta_products
            (category_id, cpm2_car_code, name, description, base_price_cents, currency,
             stock_quantity, availability_state, exclusivity, is_featured, is_published,
             air_suspension, unlocked_bodykits, version, created_at, updated_at)
            VALUES (NULL, ${code}, '${name.replace(/'/g, "''")}', '${description.replace(/'/g, "''")}',
                    ${priceCents}, 'ZAR', ${stock}, 'available', 'standard', ${featured ? 1 : 0}, 1,
                    ${air ? 1 : 0}, ${kits ? 1 : 0}, 1, '${now}', '${now}')`,
      args: [],
    },
  }));
  await pipeline(requests);

  // Attach the product images — ids come back in the same order as DEMO.
  const list = await pipeline([
    { type: "execute", stmt: { sql: "SELECT id FROM vanta_products ORDER BY id", args: [] } },
  ]);
  const idRows = list[0]?.response?.result?.rows ?? [];
  const ids = idRows.map((r) => Number(r[0]?.value));
  const byIndex = DEMO.map((d, i) => ({ name: d[1], imgId: d[8], productId: ids[i] }));

  const media = byIndex
    .filter((m) => m.imgId && m.productId)
    .map(({ name, imgId, productId }) => ({
      type: "execute",
      stmt: {
        sql: `INSERT INTO vanta_product_media
              (product_id, provider, provider_id, public_url, file_type, sort_order, version, is_published, uploaded_at)
              VALUES (${productId}, 'local', '', '${unsplash(imgId)}', 'image', 0, 1, 1, '${now}')`,
        args: [],
      },
    }));
  if (media.length) await pipeline(media);

  console.log(
    `Seeded ${DEMO.length} demo products (+${media.length} images) into an empty catalogue.`,
    `Got ids: ${ids.join(",")}`,
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
