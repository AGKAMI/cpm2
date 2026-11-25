// CPM1 seeding (live) — bot catalog.json into the app. Run: npx tsx scripts/seed-cpm1-live.mjs
import fs from "fs";
console.log("MARKER: live seed starting");
for (const raw of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim(); const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[line.slice(0, i).trim()] = v;
}
const { getStoreDb } = await import("../src/lib/store-db.ts");
const { createProduct } = await import("../src/lib/store/products.ts");
const { createMedia } = await import("../src/lib/store/media-service.ts");
const db = await getStoreDb();
const cat = JSON.parse(fs.readFileSync("C:/Users/ojuni/Downloads/KAMI-Bot-main/catalog.json", "utf8"));
const have = new Set((await db.execute({ sql: `SELECT filename FROM vanta_uploads`, args: [] })).rows.map(r => String(r.filename)));
const existing = new Set((await db.execute({ sql: `SELECT name FROM vanta_products`, args: [] })).rows.map(r => String(r.name)));
const SECTIONS = {
  flags:    { kind: "car",     stock: 1,   display: "Flags" },
  security: { kind: "car",     stock: 1,   display: "Security" },
  police:   { kind: "car",     stock: 1,   display: "Police" },
  premium:  { kind: "car",     stock: 1,   display: "Premium Cars" },
  mods:     { kind: "service", stock: 999, display: "Mods" },
  accounts: { kind: "account", stock: 1,   display: "Accounts" },
};
const catIds = {};
for (const [sec, cfg] of Object.entries(SECTIONS)) {
  const found = await db.execute({ sql: `SELECT id FROM vanta_categories WHERE name = ? AND game = 'cpm1'`, args: [cfg.display] });
  if (found.rows.length > 0) { catIds[sec] = Number(found.rows[0].id); continue; }
  const slug = cfg.display.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const ins = await db.execute({ sql: `INSERT INTO vanta_categories (name, slug, description, sort_order, image_url, is_active, game, created_at) VALUES (?, ?, ?, ?, '', 1, 'cpm1', ?)`, args: [cfg.display, slug, `${cfg.display} — CPM1`, Object.keys(SECTIONS).indexOf(sec), new Date().toISOString()] });
  catIds[sec] = Number(ins.lastInsertRowid);
}
console.log("categories:", JSON.stringify(catIds));
let seeded = 0, withMedia = 0, noMedia = 0, skipped = 0;
for (const [sec, items] of Object.entries(cat)) {
  const cfg = SECTIONS[sec];
  if (!cfg || typeof items !== "object") continue;
  for (const [key, it] of Object.entries(items)) {
    if (existing.has(it.name)) { skipped++; continue; }
    const m = /^R\s*([\d.,]+)$/.exec(String(it.price ?? "").trim());
    const cents = m ? Math.round(parseFloat(m[1].replace(",", ".")) * 100) : 0;
    const product = await createProduct({ categoryId: catIds[sec], kind: cfg.kind, game: "cpm1", name: it.name, description: it.desc ?? "", basePriceCents: cents, currency: "ZAR", stockQuantity: cfg.stock, stockInitial: cfg.stock, isPublished: true, availabilityState: "available" });
    seeded++;
    const img = it.image || ""; const fn = img ? img.split("/").pop() : "";
    if (fn && have.has(fn)) { await createMedia(product.id, "local", "", `/api/store/admin/uploads/${fn}`, "", "image", null, null, null); withMedia++; }
    else noMedia++;
    console.log(`  ${sec}/${key} -> ${product.id} | ${it.name} | R${cents / 100} | ${cfg.kind} | ${fn && have.has(fn) ? "IMG" : "NO-IMG"}`);
  }
}
console.log(`SEEDED=${seeded} withMedia=${withMedia} noMedia=${noMedia} skippedExisting=${skipped}`);
const counts = await db.execute({ sql: `SELECT game, kind, COUNT(*) c FROM vanta_products GROUP BY game, kind`, args: [] });
console.log("NOW:", counts.rows.map(r => `${r.game}/${r.kind}=${r.c}`).join(" | "));
