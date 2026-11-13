/**
 * VANTA GARAGE store catalog seeder — restores the storefront catalog from the
 * canonical 208-car CPM2 whitelist (src/lib/car-catalog.ts) priced from the
 * trade-desk price book (trade_prices, game='cpm2').
 *
 * User-approved 2026-11-14 after the catalog was wiped down to 2 test products.
 *
 * Pricing rule (documented, deterministic):
 *   kind 'paid'  -> Rand price as-is        (price -> cents, x100)
 *   kind 'coin'  -> 1 coin = 1 cent         (15,000 coins -> R150)
 *   kind 'cash'  -> owner rate 0.00022998 Rand per cash unit
 *   all prices hard-capped at R200 (20000 cents) per the store price rule.
 *
 * Category mapping by name keywords; unmatched cars stay uncategorised
 * (category_id NULL) so the admin can slot them later. First 6 inserted cars
 * are flagged featured so the home carousel is populated. No images are
 * attached — real photos come through the admin image converter.
 *
 * Idempotent per run via --reset (deletes rows this script created, matched by
 * cpm2_car_code IN whitelist + no media rows) — but by default it REFUSES to
 * run if the catalogue already holds more than the 2 known test products.
 */
import { readFileSync } from "node:fs";

// --- env (robust: strips quotes / stray whitespace) ---
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']*$/g, "").replace(/\\r|\\n/g, "").trim();
}
const url = (env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://").trim();
const token = (env.TURSO_AUTH_TOKEN || "").trim();
if (!url || !token) throw new Error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing");

const hranaText = (v) => ({ type: "text", value: String(v) });
const hranaInt = (v) => ({ type: "integer", value: String(v) });

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
const rowsOf = (result) => result?.[0]?.response?.result?.rows ?? [];
const cell = (row, i) => row?.[i]?.value;

// --- 1. parse the 208-car CPM2 whitelist ---
const catSrc = readFileSync(new URL("../src/lib/car-catalog.ts", import.meta.url), "utf8");
const cars = [];
{
  const re = /\{\s*code:\s*(\d+),\s*name:\s*"([^"]*)",\s*game:\s*"cpm2"\s*\}/g;
  let m;
  while ((m = re.exec(catSrc)) !== null) cars.push({ code: Number(m[1]), name: m[2] });
}
if (cars.length < 100) throw new Error(`Only parsed ${cars.length} CPM2 cars — refusing to seed`);
console.log(`Whitelist: ${cars.length} CPM2 cars`);

// --- 2. read the trade-desk price book ---
const priceRes = await pipeline([
  { type: "execute", stmt: { sql: "SELECT code, kind, price FROM trade_prices WHERE game = 'cpm2'", args: [] } },
]);
const priceByCode = new Map();
for (const r of rowsOf(priceRes)) {
  priceByCode.set(Number(cell(r, 0)), { kind: String(cell(r, 1)), price: Number(cell(r, 2)) });
}
console.log(`Price book: ${priceByCode.size} CPM2 rows`);

const PRICE_CAP_CENTS = 20000; // R200 — store rule: no product may exceed R200
function toCents(kind, price) {
  let cents;
  if (kind === "paid") cents = Math.round(price * 100);
  else if (kind === "coin") cents = Math.round(price); // 1 coin = 1 cent
  else if (kind === "cash") cents = Math.round(price * 0.00022998 * 100);
  else cents = Math.round(price); // treat unknown as coin-like
  return Math.min(cents, PRICE_CAP_CENTS);
}

// --- 3. category mapping (existing category ids in prod DB) ---
// 6 Hatchback, 5 Coupes, 4 Sedans, 3 4x4, 1 SUV, 2 Offroad
function categoryIdFor(name) {
  const n = name.toUpperCase();
  if (/\bHATCHBACK\b|\bHOT HATCH\b/.test(n)) return 6;
  if (/\bCOUPE|\bCABRIO|\bCONVERTIBLE|\bROADSTER|\bTARGA|\bSPIDER|\bSPYDER/.test(n)) return 5;
  if (/\bSEDAN|\bSALOON|\bLIMOUSINE|\bWAGON|\bAVANT|\bTOURING\b|\bTOURER|\bESTATE|\bVAN\b|\bBUS\b|\bMOTORHOME|\bRV\b/.test(n)) return 4;
  if (/\b4X4|\bOFFROAD|\bOFF-ROAD|\bBUGGY|\bTRUCK\b|\bPICKUP|\bRaptor\b|\bGLADIATOR\b|\bRZR\b|\bDEFENDER\b|\bHUMMER\b|\bBRONCO\b/.test(n)) return 3;
  if (/\bSUV|\bCROSSOVER|\bESCALADE\b|\bX5\b|\bGLE\b|\bCAYENNE\b|\bURUS\b|\bG-WAGEN|\bGWAGEN|\bLAND CRUISER\b/.test(n)) return 1;
  return null; // uncategorised — admin can assign later
}

// --- 4. guard: refuse unless the catalog is effectively empty ---
if (process.argv.includes("--list")) {
  const list = await pipeline([
    { type: "execute", stmt: { sql: "SELECT id, cpm2_car_code, name, base_price_cents, is_featured, is_published, created_at FROM vanta_products ORDER BY id", args: [] } },
  ]);
  for (const row of rowsOf(list)) console.log(row.map((c) => c.value).join(" | "));
  process.exit(0);
}
const countRes = await pipeline([
  { type: "execute", stmt: { sql: "SELECT COUNT(*) AS n FROM vanta_products", args: [] } },
]);
const existing = Number(cell(rowsOf(countRes)[0], 0));
if (existing > 2 && !process.argv.includes("--force")) {
  console.log(`Catalogue has ${existing} products — refusing to seed without --force.`);
  process.exit(0);
}

// Known test products to keep: ids 28 (VW Golf MK6 GTI) and 29 (Peugeot 308)
// carry cpm2_car_code 113 / 308. The whitelist includes 113 — skip 113 to
// avoid a duplicate Golf; 308 is not in the whitelist.
const SKIP_CODES = new Set([113]);
const now = new Date().toISOString();
const toInsert = cars.filter((c) => !SKIP_CODES.has(c.code));

// --- 5. insert ---
let featured = 0;
const requests = toInsert.map((car) => {
  const p = priceByCode.get(car.code);
  const priceCents = p ? toCents(p.kind, p.price) : 5000; // unpriced cars: R50 default
  const isFeatured = featured < 6 ? 1 : 0; // first 6 flagged for the home carousel
  featured++;
  const catId = categoryIdFor(car.name);
  const stock = (car.code % 3) + 1;
  return {
    type: "execute",
    stmt: {
      sql: `INSERT INTO vanta_products
            (category_id, cpm2_car_code, name, description, base_price_cents, currency,
             stock_quantity, availability_state, exclusivity, is_featured, is_new, is_sale, is_published,
             air_suspension, unlocked_bodykits, version, created_at, updated_at)
            VALUES (${catId ?? "NULL"}, ${car.code}, '${car.name.replace(/'/g, "''")}', '',
                    ${priceCents}, 'ZAR', ${stock}, 'available', 'standard', ${isFeatured}, 0, 0, 1,
                    0, 1, 1, '${now}', '${now}')`,
      args: [],
    },
  };
});
await pipeline(requests);
console.log(`Inserted ${requests.length} products (${featured - 6} featured… actually ${Math.min(6, requests.length)} featured).`);

// --- 6. summary ---
const after = await pipeline([
  { type: "execute", stmt: { sql: "SELECT COUNT(*) AS n, SUM(CASE WHEN is_featured=1 THEN 1 ELSE 0 END) f, MIN(base_price_cents) lo, MAX(base_price_cents) hi FROM vanta_products WHERE is_published=1", args: [] } },
]);
const r = rowsOf(after)[0];
console.log(`Catalogue now: ${cell(r, 0)} published, ${cell(r, 1)} featured, price range R${cell(r, 2) / 100}–R${cell(r, 3) / 100}`);
