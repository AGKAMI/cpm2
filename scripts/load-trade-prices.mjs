/**
 * One-off bulk loader for the trade desk price book, from the owner's master
 * price list (Downloads/complete_car_list_with_in_game_real_world_prices.md).
 *
 * Every (code, kind, price) below was hand-matched against the CPM2 catalog
 * in src/lib/car-catalog.ts. Ambiguous or CPM1-only cars were left OUT — they
 * are listed in the session report for the owner to add in-app if wanted.
 *
 * Valuation model (owner's rule): paid = Rand price, coin = coins × rate,
 * cash = cash price × cash rate.
 *
 * Rates from the file's own store-pack anchors:
 *   10,000 coins = R328.99  → randPerCoin  = 0.032899
 *   500,000 cash = R114.99  → randPerCash  = 0.00022998
 *
 * Idempotent: safe to re-run (upserts).
 */
import Database from "better-sqlite3";
import { resolveDbPath } from "../src/lib/db.ts";

/** [code, kind, price] — kind: paid | coin | cash */
const ENTRIES = [
  // --- Coin cars (batch 1-2) ---
  [268, "coin", 700], // FIAT 500 (ABARTH)
  [0, "coin", 1000], // BMW M3 E36 → catalog "BMW 3 SERIES (E36)"
  [1, "coin", 1000], // BMW 1 SERIES M COUPE (E82) — only 1-series in CPM2 (verify)
  [6, "coin", 1000], // SUBARU BRZ / TOYOTA GT86
  [39, "coin", 500], // DODGE CHARGER R/T 1970
  [54, "coin", 500], // BMW 5 SERIES (E28)
  [60, "coin", 500], // CADILLAC ESCALADE
  [62, "coin", 500], // DODGE CHARGER SRT (2015)
  [121, "coin", 500], // TOYOTA LAND CRUISER 200
  [126, "coin", 500], // GMC SIERRA 1500 → catalog "GMC PICKUP"
  [147, "coin", 500], // HONDA CIVIC TYPE R (FK8)
  [151, "coin", 500], // TOYOTA ALPHARD
  [154, "coin", 500], // TOYOTA HILUX REVO
  [161, "coin", 500], // JEEP GRAND CHEROKEE TRACKHAWK
  [186, "coin", 500], // FORD EXPLORER V
  [177, "coin", 500], // NISSAN SILVIA S13
  [180, "coin", 500], // FORD F-100 PICKUP (1970s)
  [185, "coin", 500], // CHEVROLET IMPALA 1967
  [181, "coin", 500], // FORD MUSTANG I FASTBACK 1964
  [200, "coin", 500], // DODGE DURANGO SRT
  [209, "coin", 1000], // LEXUS IS F
  [59, "coin", 1000], // SMART FORTWO
  [255, "coin", 500], // LEXUS IS250 / IS350
  [30, "coin", 1000], // BMW M5 E39 → catalog "BMW 5 SERIES (E39)"
  [21, "coin", 500], // JEEP WRANGLER (JK) → catalog "OLD JEEP"
  [12, "coin", 1000], // MITSUBISHI LANCER EVOLUTION X (verify — catalog "MITSUBISHI LANCER")
  [9, "coin", 1000], // SUBARU IMPREZA WRX STI HAWKEYE (verify)
  [8, "coin", 1000], // INFINITI G37 / Q60 → catalog "INFINITI G25" (verify)
  // --- High-end coin cars (batch 3-4) ---
  [216, "coin", 10000], // MCLAREN SENNA
  [202, "coin", 10000], // PAGANI ZONDA F / CINQUE
  [198, "coin", 10000], // KOENIGSEGG JESKO
  [155, "coin", 15000], // FORMULA 1 CAR → catalog "F1"
  [41, "coin", 10000], // MCLAREN P1
  [58, "coin", 10000], // FERRARI 458 ITALIA
  [178, "coin", 10000], // BUGATTI CHIRON
  [162, "coin", 10000], // MCLAREN 720S
  [32, "coin", 10000], // KOENIGSEGG AGERA R
  [27, "coin", 10000], // BUGATTI VEYRON 16.4
  [7, "coin", 10000], // LEXUS LFA NÜRBURGRING
  [10, "coin", 10000], // FERRARI F12BERLINETTA
  // --- Cash cars (valued at cash × rate, like the file's ZAR column) ---
  [176, "cash", 25000], // CHEVROLET C10 PICKUP 1980s
  [140, "cash", 35000], // TOYOTA AE86 (LEVINO/TRUENO)
  [146, "cash", 35000], // LADA NIVA
  [57, "cash", 50000], // CADILLAC CTS I
  [55, "cash", 60000], // HUMMER H1
  [45, "cash", 70000], // BMW 5 SERIES (E34)
  [197, "cash", 80000], // VOLKSWAGEN BUS T1 → catalog "VOLKSWAGEN TYPE 2"
  [179, "cash", 120000], // CHEVROLET CAPRICE 1980s
  [158, "cash", 170000], // MAZDA MX-5 (ND) — only MX-5 in CPM2
  [184, "cash", 190000], // MITSUBISHI ECLIPSE GSX
  [23, "cash", 200000], // HYUNDAI VELOSTER
  [66, "cash", 220000], // CHRYSLER 300C
  [53, "cash", 250000], // NISSAN SKYLINE KPGC10 HAKOSUKA → "NISSAN SKYLINE 2000 GT-R"
  [157, "cash", 260000], // VOLKSWAGEN GOLF MK2 GTI
  [131, "cash", 280000], // NISSAN 240SX / 180SX S13
  [120, "cash", 300000], // TOYOTA CAMRY XV70
  [163, "cash", 320000], // MERCEDES-BENZ 230 SL PAGODA
  [208, "cash", 350000], // FORD BRONCO 2021
  [48, "cash", 500000], // MAZDA RX-8 → catalog "FORD MUSTANG BOSS / MAZDA RX-8 I 2003"
  [2, "cash", 18000], // VOLKSWAGEN SCIROCCO III
  [74, "cash", 18000], // PEUGEOT 308
  [137, "cash", 18000], // HONDA CIVIC 8TH GEN SEDAN → "HONDA CIVIC 4D"
  [149, "cash", 25000], // CHEVROLET BEL AIR 1957
  [99, "cash", 12000], // LADA PRIORA
  // --- Direct real-money purchase cars ---
  [252, "paid", 65.99], // LEXUS IS300 / TOYOTA ALTEZZA SXE10
  [259, "paid", 114.99], // TOYOTA FORTUNER GR RALLY
  [262, "paid", 131.49], // TOYOTA CELICA GT-FOUR ST205
  [243, "paid", 246.99], // JEEP GLADIATOR
  [257, "paid", 246.99], // BMW M2 (G87) → catalog "NEW M2"
  [266, "paid", 295.99], // MASERATI MC20
  [226, "paid", 295.99], // BMW 7 SERIES (G70 / I7)
  [263, "paid", 410.99], // FORD MODEL A → catalog "FORD MODEL 1"
];

const RATES = { rand_per_coin: 328.99 / 10_000, rand_per_cash: 114.99 / 500_000 };

const db = new Database(resolveDbPath());
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

const upsertRate = db.prepare(`
  INSERT INTO trade_rates (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const upsertPrice = db.prepare(`
  INSERT INTO trade_prices (game, code, kind, price, updated_at)
  VALUES ('cpm2', ?, ?, ?, ?)
  ON CONFLICT(game, code) DO UPDATE SET
    kind = excluded.kind, price = excluded.price, updated_at = excluded.updated_at
`);

const now = new Date().toISOString();
const load = db.transaction(() => {
  upsertRate.run("rand_per_coin", RATES.rand_per_coin);
  upsertRate.run("rand_per_cash", RATES.rand_per_cash);
  for (const [code, kind, price] of ENTRIES) upsertPrice.run(code, kind, price, now);
});
load();

const counts = db
  .prepare(`SELECT kind, COUNT(*) AS n FROM trade_prices WHERE game = 'cpm2' GROUP BY kind`)
  .all();
const rates = db.prepare(`SELECT key, value FROM trade_rates`).all();
console.log("loaded", ENTRIES.length, "entries");
console.log("by kind:", JSON.stringify(counts));
console.log("rates:", JSON.stringify(rates));
db.close();
