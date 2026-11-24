/**
 * Seed the CPM1 catalogue from KAMI-Bot's catalog.json into the app.
 *
 * Idempotent by design: categories are keyed by slug, products by
 * (category_id, name) — re-running is a no-op, never a duplicate. Images map
 * by exact public URL (already app-hosted after the conversion); entries whose
 * image no longer exists anywhere are seeded clean and text-only, never guessed.
 *
 * Account-kind products are seeded UNPUBLISHED (KAMI: hold) — selling an
 * account with no credentials behind it is the one edge case that costs money.
 *
 * Usage:  node --experimental-strip-types scripts/seed-cpm1-catalogue.mts --dry
 *         node --experimental-strip-types scripts/seed-cpm1-catalogue.mts --live
 */
import fs from "fs";

for (const raw of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[k] = v;
}

const { getStoreDb } = await import("../src/lib/store-db.ts");
const P = await import("../src/lib/store/products.ts");

const MODE = process.argv.includes("--live") ? "live" : "dry";
const APP_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://cpm2-bay.vercel.app").replace(/\/$/, "");
const CATALOG = "C:/Users/ojuni/Downloads/KAMI-Bot-main/catalog.json";
const SKIP_CATEGORIES = new Set(["landingPage"]); // not a category

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const db = await getStoreDb();

const report = {
  categories: { created: 0, existing: 0 },
  products: { created: 0, existing: 0, held: 0 },
  media: { linked: 0, noImage: 0, failed: [] as string[] },
  priceParseFail: [] as string[],
};

function priceToCents(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw * 100);
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  return Number(digits) * (String(raw ?? "").includes(".") ? 1 : 100);
}

function imageToRelative(image: unknown): string | null {
  const s = String(image ?? "").trim();
  if (!s || s.startsWith("assets/")) return null; // missing file or empty
  const i = s.indexOf("/api/store/admin/uploads/");
  if (i < 0) return null; // not an app-hosted URL — never fabricate
  return s.slice(i);
}

async function upsertCategory(name: string, slug: string, sortOrder: number): Promise<number> {
  const existing = await db.execute({
    sql: "SELECT id FROM vanta_categories WHERE slug = ? AND game = 'cpm1' LIMIT 1",
    args: [slug],
  });
  if (existing.rows.length > 0) {
    report.categories.existing++;
    return Number(existing.rows[0].id);
  }
  if (MODE === "dry") return -1; // placeholder id for the report
  const cat = await P.createCategory({ name, slug, description: `${name} — CPM1 catalogue`, sortOrder, game: "cpm1" });
  report.categories.created++;
  return cat.id;
}

async function productExists(categoryId: number, name: string): Promise<boolean> {
  if (categoryId < 0) return false; // dry-run placeholder — assume absent, report it
  const r = await db.execute({
    sql: "SELECT id FROM vanta_products WHERE category_id = ? AND name = ? AND game = 'cpm1' LIMIT 1",
    args: [categoryId, name],
  });
  return r.rows.length > 0;
}

const catNames: Record<string, string> = {
  flags: "Flags",
  security: "Security",
  police: "Police",
  premium: "Premium",
  mods: "Mods",
  accounts: "Accounts",
};

let sortOrder = 1;
for (const [key, group] of Object.entries(catalog)) {
  if (SKIP_CATEGORIES.has(key) || !group || typeof group !== "object") continue;
  const name = catNames[key] ?? key;
  const categoryId = await upsertCategory(name, key, sortOrder++);
  const items = Object.values(group as Record<string, Record<string, unknown>>);
  let catCreated = 0, catHeld = 0, catMedia = 0, catNoImg = 0;

  for (const item of items) {
    if (!item || typeof item !== "object" || !item.name) continue;
    const cents = priceToCents(item.price);
    if (cents === null) {
      report.priceParseFail.push(`${key}/${String(item.name)}: price=${JSON.stringify(item.price)}`);
      continue;
    }
    const isAccount = key === "accounts";
    if (await productExists(categoryId, String(item.name))) {
      report.products.existing++;
      continue;
    }
    if (MODE === "dry") {
      if (isAccount) report.products.held++; else report.products.created++;
      if (imageToRelative(item.image)) catMedia++; else catNoImg++;
      continue;
    }

    const product = await P.createProduct({
      categoryId,
      name: String(item.name),
      description: String(item.desc ?? ""),
      basePriceCents: cents,
      currency: "ZAR",
      stockQuantity: 1,
      kind: isAccount ? "account" : "car",
      game: "cpm1",
      // accounts held dark (KAMI): no credentials behind them yet
      isPublished: !isAccount,
    });
    if (isAccount) report.products.held++; else report.products.created++;

    const rel = imageToRelative(item.image);
    if (rel) {
      try {
        await P.createMedia({
          productId: product.id,
          publicUrl: rel,
          fileType: "image",
          sortOrder: 0,
        });
        catMedia++;
        report.media.linked++;
      } catch (e) {
        report.media.failed.push(`${String(item.name)}: ${(e as Error).message.slice(0, 80)}`);
      }
    } else catNoImg++;
  }
  console.log(`CAT ${name.padEnd(10)} | ${items.length} items | media=${catMedia} no-image=${catNoImg}`);
}

console.log(`SEED [${MODE}]`, JSON.stringify(report));
if (report.priceParseFail.length) console.log("PRICE FAILURES:", report.priceParseFail.join(" | "));
if (report.media.failed.length) console.log("MEDIA FAILURES:", report.media.failed.join(" | "));
