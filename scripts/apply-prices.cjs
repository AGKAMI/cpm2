// Apply three trade-desk prices (KAMI, coin currency) to the CPM2 price book.
// Uses the store's own upsert SQL verbatim so the app sees an identical shape.
const Database = require("better-sqlite3");
const fs = require("fs");

const DB = "C:/Users/ojuni/Documents/GAMES/cpm2/data/cpm2.db";
const CATALOG = "C:/Users/ojuni/Documents/GAMES/cpm2/src/lib/car-catalog.ts";

const WANTED = [
  { code: 172, price: 5000 },
  { code: 253, price: 5000 },
  { code: 165, price: 15000 },
];
const GAME = "cpm2";
const KIND = "coin"; // KAMI said "5000 coins" -> kind 'coin', not 'paid'/'cash'

// --- resolve car names from the static catalog (same source the app reads) ---
const src = fs.readFileSync(CATALOG, "utf8");
function carName(code) {
  const re = new RegExp(
    `code:\\s*${code},\\s*name:\\s*"([^"]+)",\\s*game:\\s*"${GAME}"`,
  );
  const m = src.match(re);
  return m ? m[1] : null;
}

const db = new Database(DB);

// This is setTradePrice()'s upsert, unchanged.
const upsert = db.prepare(`
  INSERT INTO trade_prices (game, code, kind, price, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(game, code) DO UPDATE SET
    kind = excluded.kind,
    price = excluded.price,
    updated_at = excluded.updated_at
`);

const stamp = new Date().toISOString();
const written = [];

for (const { code, price } of WANTED) {
  const name = carName(code);
  if (!name) {
    console.log(`SKIP ${code}: not found in ${GAME} catalog — refusing to write a price for a nonexistent car`);
    continue;
  }
  const before = db
    .prepare("SELECT kind, price FROM trade_prices WHERE game = ? AND code = ?")
    .get(GAME, code);
  upsert.run(GAME, code, KIND, price, stamp);
  written.push({ code, name, price, kind: KIND, was: before || null });
}

db.close();

// --- verify by reading back through a fresh connection ---
const verify = new Database(DB, { readonly: true });
for (const w of written) {
  const row = verify
    .prepare("SELECT kind, price, updated_at FROM trade_prices WHERE game = ? AND code = ?")
    .get(GAME, w.code);
  const ok = row && row.kind === KIND && row.price === w.price;
  console.log(
    `${ok ? "OK " : "FAIL"} ${String(w.code).padStart(4)} ${w.name.padEnd(38)} ` +
      `${String(w.price).padStart(6)} coins  (was: ${w.was ? w.was.price + " " + w.was.kind : "none"})`
  );
}
const total = verify
  .prepare("SELECT COUNT(*) n FROM trade_prices WHERE game = ?")
  .get(GAME).n;
console.log(`\nprice book rows for ${GAME}: ${total}`);
verify.close();
