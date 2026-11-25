/**
 * Seed CPM2 catalogue products from vanta_cpm2_cars.
 *
 * vanta_cpm2_cars holds 211 rows of {code, name} ONLY -- no price, stock,
 * image or published flag. It is the car-name list the admin's "pick from
 * catalogue" dropdown reads, not sellable stock, which is why every storefront
 * (web, app, bot) sees just the 2 published CPM2 products.
 *
 * This turns catalogue rows into real products. NOTHING is published: the run
 * stages them unpublished so KAMI reviews the count before anything goes live.
 *
 * Usage:
 *   node --experimental-strip-types cache/scratch/seed-cpm2.mts           (dry run)
 *   node --experimental-strip-types cache/scratch/seed-cpm2.mts --apply   (write)
 */

import { createClient } from "@libsql/client";
import { createProduct, listProducts } from "../src/lib/store/products.ts";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const q = async (sql: string) => (await db.execute({ sql, args: [] })).rows;

// Match the four existing CPM2 products: R30.00, stock 1. Unpublished.
const PRICE_CENTS = 3000;
const STOCK = 1;

const catalog = await q("SELECT code, name FROM vanta_cpm2_cars ORDER BY code");
console.log(`catalog rows: ${catalog.length}`);

const existingRows = await q(
  "SELECT cpm2_car_code FROM vanta_products WHERE game = 'cpm2' AND cpm2_car_code IS NOT NULL",
);
const existing = new Set(existingRows.map((r) => Number(r.cpm2_car_code)));
console.log(`catalog cars already having a product: ${existing.size} (${[...existing].join(", ")})`);

const todo = catalog.filter((r) => !existing.has(Number(r.code)));
console.log(`to stage: ${todo.length}`);
if (todo.length === 0) {
  console.log("nothing to do");
  process.exit(0);
}

const apply = process.argv.includes("--apply");
console.log(apply ? "MODE: APPLY (writing)" : "MODE: DRY RUN (no writes)");

let created = 0;
let failed = 0;
const failures: string[] = [];

for (const row of todo) {
  const code = Number(row.code);
  const name = String(row.name).trim();
  if (!name) {
    failures.push(`code ${code}: empty name, skipped`);
    continue;
  }
  try {
    if (apply) {
      await createProduct({
        game: "cpm2",
        kind: "car",
        cpm2CarCode: code,
        name,
        description: "",
        basePriceCents: PRICE_CENTS,
        currency: "ZAR",
        stockQuantity: STOCK,
        // staged, never published by this script
        isPublished: false,
        isFeatured: false,
        isNew: false,
        isSale: false,
      });
    }
    created++;
  } catch (err) {
    failed++;
    failures.push(`code ${code} (${name}): ${(err as Error).message}`);
  }
}

console.log(`\nstaged: ${created}  failed: ${failed}`);
if (failures.length) {
  console.log("failures (first 10):");
  for (const f of failures.slice(0, 10)) console.log(`  ${f}`);
}

if (apply) {
  const after = await q(
    "SELECT is_published, COUNT(*) c FROM vanta_products WHERE game='cpm2' GROUP BY is_published",
  );
  console.log("\nCPM2 products after run:");
  for (const r of after) console.log(`  published=${r.is_published}: ${r.c}`);
  const pub = await listProducts({ onlyPublished: true });
  console.log(`published CPM2 (what the bot sees): ${pub.filter((p) => p.game === "cpm2").length}`);
}