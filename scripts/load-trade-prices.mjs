/**
 * Canonical bulk loader for the trade desk price book, from the owner's
 * corrected master table (2026-10-29): code-keyed rows with real vehicle
 * names and in-game / real-money prices. Idempotent — safe to re-run.
 *
 * Valuation model (owner's rule): paid = Rand price, coin = coins × rate,
 * cash = cash price × cash rate.
 *
 * Rates from the store-pack anchors:
 *   10,000 coins = R328.99  → randPerCoin  = 0.032899
 *   500,000 cash = R114.99  → randPerCash = 0.00022998
 *
 * Cars priced here: 208. Outside this table:
 *   - #119 HUMMER H1 CUSTOM OFFROAD BUILD: no currency symbol — assumed cash
 * plus #165/#172/#253/#230, owner-quoted separately and preserved below
 * (#230 LAND ROVER DEFENDER 110 (2020+) = R246.99 paid).
 */
import { readFileSync } from "node:fs";

// --- Turso connection (the live database) ---
// Reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from .env.local. Values are used,
// never printed.
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
const now = new Date().toISOString();
const RATES = { rand_per_coin: 328.99 / 10_000, rand_per_cash: 114.99 / 500_000 };

const HRANA_TRUE = { type: "integer", value: "1" };
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

const UPSERT_RATE = `
  INSERT INTO trade_rates (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`;
const UPSERT_PRICE = `
  INSERT INTO trade_prices (game, code, kind, price, updated_at)
  VALUES ('cpm2', ?, ?, ?, ?)
  ON CONFLICT(game, code) DO UPDATE SET
    kind = excluded.kind, price = excluded.price, updated_at = excluded.updated_at
`;

const rateReq = (key, value) => ({
  type: "execute",
  stmt: { sql: UPSERT_RATE, args: [hranaText(key), hranaNum(value)] },
});
const priceReq = (code, kind, price) => ({
  type: "execute",
  stmt: { sql: UPSERT_PRICE, args: [hranaNum(code), hranaText(kind), hranaNum(price), hranaText(now)] },
});

/** [code, kind, price] — kind: paid | coin | cash. Names in comments. */
const ENTRIES = [
  [0, "coin", 1000], // BMW 3 SERIES SEDAN (E36)
  [1, "cash", 150000], // BMW 1 SERIES HATCHBACK (F20)
  [2, "cash", 18000], // VOLKSWAGEN SCIROCCO III
  [3, "coin", 1000], // BMW 5 SERIES SEDAN (F10)
  [4, "coin", 1000], // MERCEDES-BENZ G-CLASS (W463 CLASSIC)
  [5, "coin", 1500], // CHEVROLET CAMARO SS (5TH GEN)
  [6, "coin", 1000], // SUBARU BRZ / TOYOTA GT86
  [7, "coin", 10000], // LEXUS LFA
  [8, "coin", 1000], // INFINITI G37 / G25 SEDAN
  [9, "coin", 500], // SUBARU IMPREZA WRX STI (HAWKEYE)
  [10, "coin", 10000], // FERRARI F12BERLINETTA
  [11, "coin", 1500], // NISSAN GT-R (R34 SKYLINE)
  [12, "coin", 1000], // MITSUBISHI LANCER EVOLUTION X
  [13, "coin", 500], // HONDA CIVIC EK9
  [14, "coin", 1000], // NISSAN GT-R (R35)
  [15, "coin", 2000], // AUDI RS4 AVANT (B8)
  [16, "coin", 10000], // BMW M3 COUPE (E36)
  [17, "coin", 1500], // MERCEDES-BENZ C63 AMG (W204)
  [18, "coin", 1000], // NISSAN SILVIA S15 / SPEC-R
  [19, "coin", 1500], // MERCEDES-AMG GT S
  [20, "coin", 1500], // AUDI TT RS COUPE
  [21, "coin", 500], // JEEP WRANGLER RUBICON (JK)
  [22, "coin", 2000], // BMW M6 GRAN COUPE (F06)
  [23, "cash", 200000], // HYUNDAI VELOSTER TURBO
  [24, "coin", 2000], // PORSCHE PANAMERA TURBO
  [27, "coin", 10000], // BUGATTI VEYRON 16.4
  [28, "coin", 1500], // PORSCHE CAYENNE TURBO
  [29, "coin", 500], // HONDA CIVIC TYPE R (FN2 HATCHBACK)
  [30, "coin", 1000], // BMW 5 SERIES / M5 (E39)
  [31, "coin", 2000], // BMW 5 SERIES / M5 (E60)
  [32, "coin", 10000], // KOENIGSEGG AGERA R
  [35, "coin", 1500], // FORD MUSTANG GT (5TH GEN)
  [37, "coin", 5000], // FORD TRANSIT VAN
  [39, "coin", 500], // DODGE CHARGER R/T (1970)
  [40, "coin", 2000], // CHEVROLET CORVETTE C7 STINGRAY
  [41, "coin", 10000], // MCLAREN P1
  [42, "coin", 10000], // LAMBORGHINI AVENTADOR LP700-4
  [43, "coin", 1000], // LEXUS GS 350
  [44, "coin", 10000], // LAMBORGHINI VENENO
  [45, "cash", 70000], // BMW 5 SERIES SEDAN (E34)
  [47, "coin", 1500], // HONDA S2000
  [48, "cash", 500000], // MAZDA RX-8
  [49, "coin", 1500], // TOYOTA SUPRA MK4 (A80)
  [51, "coin", 1500], // FERRARI 250 GT CALIFORNIA SPIDER
  [53, "cash", 250000], // NISSAN SKYLINE GT-R (KPGC10 HAKOSUKA)
  [54, "coin", 500], // BMW 5 SERIES (E28)
  [55, "cash", 60000], // HUMMER H1
  [56, "coin", 2500], // BMW M3 COUPE (E92)
  [57, "cash", 50000], // CADILLAC CTS-V (1ST GEN)
  [58, "coin", 10000], // FERRARI 458 ITALIA
  [59, "coin", 1000], // SMART FORTWO (W451)
  [60, "coin", 500], // CADILLAC ESCALADE
  [61, "coin", 2000], // MERCEDES-BENZ S-CLASS (W221)
  [62, "coin", 500], // DODGE CHARGER SRT HELLCAT (2015)
  [65, "coin", 1000], // LAMBORGHINI GALLARDO SPYDER
  [66, "cash", 220000], // CHRYSLER 300C
  [70, "coin", 5000], // SCANIA R-SERIES HEAVY TRUCK
  [74, "cash", 18000], // PEUGEOT 308
  [76, "coin", 1500], // BMW Z4 M ROADSTER (E85)
  [77, "cash", 20000], // MINI COOPER S ROADSTER (R59)
  [81, "coin", 1000], // SUBARU IMPREZA WRX STI WRC RALLY
  [82, "coin", 1000], // MITSUBISHI LANCER EVOLUTION IX
  [85, "coin", 1000], // FORD F-150 SVT RAPTOR
  [86, "coin", 1500], // BMW X5 M (E53)
  [87, "coin", 2000], // MERCEDES-BENZ CL 65 AMG
  [88, "coin", 1500], // BMW M3 COUPE (E46)
  [89, "cash", 45000], // OPEL OMEGA B / VAUXHALL OMEGA
  [99, "cash", 12000], // LADA PRIORA
  [100, "cash", 12000], // TOFAS SAHIN / KARTAL SLX
  [101, "coin", 5000], // FORD F-650 TOW TRUCK
  [102, "cash", 12000], // LADA 2104 ESTATE
  [103, "coin", 2500], // BMW M4 COUPE (F82)
  [104, "coin", 5000], // BMW M5 (F90)
  [105, "coin", 2000], // DODGE CHALLENGER SRT DEMON
  [106, "cash", 150000], // MERCEDES-BENZ 190E (W201) / W124
  [107, "coin", 2500], // AUDI R8 V10 PLUS
  [108, "coin", 1500], // AUDI SPORT QUATTRO
  [109, "coin", 1500], // PORSCHE 911 CARRERA S (991)
  [110, "coin", 1500], // RANGE ROVER SPORT SVR
  [111, "coin", 2000], // ACURA / HONDA NSX (NC1)
  [112, "coin", 1000], // MERCEDES-BENZ S-CLASS (W140)
  [113, "coin", 1000], // VOLKSWAGEN GOLF MK7 GTI
  [114, "coin", 2500], // MERCEDES-AMG E63 S (W213)
  [115, "coin", 2500], // AUDI R8 V10 PERFORMANCE
  [116, "coin", 1500], // FORD MUSTANG GT FASTBACK (2015)
  [117, "coin", 2500], // AUDI S5 COUPE
  [118, "coin", 2000], // BMW X6 M (F16)
  [119, "cash", 60000], // HUMMER H1 CUSTOM OFFROAD BUILD
  [120, "cash", 300000], // TOYOTA CAMRY (XV70)
  [121, "coin", 500], // TOYOTA LAND CRUISER 200
  [123, "coin", 2000], // MERCEDES-BENZ GLE COUPE AMG
  [124, "coin", 2500], // ROLLS-ROYCE DAWN CONVERTIBLE
  [125, "coin", 1000], // LAMBORGHINI URUS
  [126, "coin", 500], // GMC SIERRA 1500 PICKUP
  [127, "paid", 246.99], // BMW M2 (G87)
  [129, "coin", 1500], // MAZDA RX-7 FD3S
  [130, "coin", 5000], // FORD GT (2ND GEN)
  [131, "cash", 280000], // NISSAN 240SX / 180SX (S13)
  [132, "coin", 5000], // ISUZU GIGA HEAVY TRUCK
  [133, "coin", 1000], // MINI COOPER S (R56 HATCHBACK)
  [134, "coin", 1500], // TOYOTA MARK II (JZX100)
  [135, "coin", 2500], // AUDI A7 / RS7 SPORTBACK
  [136, "coin", 5000], // MERCEDES-MAYBACH S-CLASS (X222)
  [137, "cash", 18000], // HONDA CIVIC SEDAN (FD2)
  [138, "coin", 1000], // BMW I8 COUPE
  [139, "cash", 40000], // FORD CROWN VICTORIA POLICE INTERCEPTOR
  [140, "cash", 35000], // TOYOTA COROLLA LEVIN / SPRINTER TRUENO (AE86)
  [141, "coin", 2500], // DODGE VIPER ACR
  [142, "coin", 5000], // MERCEDES-AMG GT 63 S 4-DOOR COUPE
  [143, "coin", 1000], // MERCEDES-AMG G63 (W463A)
  [144, "coin", 2500], // BMW M8 COMPETITION COUPE
  [145, "coin", 1500], // NISSAN 350Z (Z33)
  [146, "cash", 35000], // LADA NIVA (VAZ-2121)
  [147, "coin", 500], // HONDA CIVIC TYPE R (FK8)
  [149, "cash", 25000], // CHEVROLET BEL AIR SPORT COUPE (1957)
  [150, "coin", 1000], // TOYOTA GR SUPRA (A90 / MK5)
  [151, "coin", 500], // TOYOTA ALPHARD EXECUTIVE LOUNGE
  [152, "cash", 12000], // TOFAS KARTAL SLX WAGON
  [153, "coin", 2500], // BMW M4 COMPETITION (G82)
  [154, "coin", 500], // TOYOTA HILUX REVO PICKUP
  [155, "coin", 15000], // SCUDERIA FERRARI FORMULA 1 CAR
  [156, "coin", 1500], // NISSAN SKYLINE GT-R (R32)
  [157, "cash", 260000], // VOLKSWAGEN GOLF MK2 GTI
  [158, "cash", 370000], // MAZDA MX-5 MIATA (NA)
  [159, "coin", 10000], // LAMBORGHINI AVENTADOR SVJ
  [160, "coin", 2000], // DODGE CHALLENGER R/T COUPE (1970)
  [161, "coin", 500], // JEEP GRAND CHEROKEE TRACKHAWK
  [162, "coin", 10000], // MCLAREN 720S
  [163, "cash", 320000], // MERCEDES-BENZ 230 SL PAGODA (W113)
  [164, "paid", 131.49], // CAN-AM MAVERICK X3 BUGGY
  [165, "coin", 15000], // FORMULA 2 / OPEN-WHEEL RACE CAR — owner-quoted
  [166, "coin", 2500], // CHEVROLET CORVETTE C8 STINGRAY
  [167, "coin", 1500], // RAM 1500 TRX PICKUP
  [169, "coin", 2500], // BENTLEY CONTINENTAL GT
  [170, "coin", 5000], // KENWORTH T680 USA SEMI-TRUCK
  [171, "coin", 5000], // SINOTRUK SITRAK C7H COMMERCIAL TRUCK
  [172, "coin", 5000], // ROLLS-ROYCE CULLINAN — owner-quoted
  [173, "coin", 5000], // MERCEDES-BENZ CLS 63 AMG
  [175, "coin", 1000], // MERCEDES-BENZ E-CLASS (W210)
  [176, "cash", 25000], // CHEVROLET C10 PICKUP (1983)
  [177, "coin", 500], // NISSAN SILVIA S13
  [178, "coin", 10000], // BUGATTI CHIRON
  [179, "cash", 120000], // CHEVROLET CAPRICE CLASSIC (1980S)
  [180, "coin", 500], // FORD F-100 PICKUP (1970S)
  [181, "coin", 500], // FORD MUSTANG I FASTBACK (1964)
  [182, "coin", 5000], // FORD F-150 HOONITRUCK (KEN BLOCK)
  [183, "coin", 1000], // FORD MUSTANG HOONICORN V2 (KEN BLOCK)
  [184, "cash", 190000], // MITSUBISHI ECLIPSE GSX
  [185, "coin", 500], // CHEVROLET IMPALA (1967)
  [186, "coin", 500], // FORD EXPLORER V SUV
  [188, "coin", 10000], // PORSCHE 911 GT3 RS (992)
  [189, "coin", 1000], // FORD F-150 RAPTOR (2021)
  [190, "coin", 1000], // PEUGEOT 406 (TAXI MOVIE EDITION)
  [191, "coin", 5000], // LIAZ 5292 CITY BUS
  [192, "coin", 1500], // RAM 2500 HEAVY DUTY PICKUP
  [193, "coin", 2500], // BMW M3 TOURING (G81)
  [194, "coin", 1000], // MERCEDES-BENZ SLR MCLAREN
  [195, "coin", 5000], // NEOPLAN / SETRA COMMERCIAL TOUR BUS
  [196, "coin", 1000], // FORD FALCON XB GT COUPE
  [197, "cash", 80000], // VOLKSWAGEN TYPE 2 CAMPER VAN (T1)
  [198, "coin", 10000], // KOENIGSEGG JESKO
  [199, "coin", 1500], // CHEVROLET CORVETTE C6 Z06
  [200, "coin", 500], // DODGE DURANGO SRT
  [201, "coin", 1000], // MERCEDES-BENZ CLK-GTR
  [202, "coin", 10000], // PAGANI ZONDA F / CINQUE
  [204, "coin", 5000], // MERCEDES-BENZ SPRINTER VAN
  [205, "coin", 1500], // PORSCHE 911 CARRERA (930 TURBO CLASSIC)
  [206, "coin", 500], // ALFA ROMEO GIULIA QUADRIFOGLIO
  [207, "coin", 10000], // PORSCHE 919 HYBRID LMP1
  [208, "cash", 350000], // FORD BRONCO (2021)
  [209, "coin", 500], // LEXUS IS F
  [210, "coin", 1000], // CHEVROLET CORVETTE C3 STINGRAY
  [211, "coin", 2500], // AUDI RS7 SPORTBACK (C8)
  [212, "coin", 5000], // MERCEDES-BENZ G63 AMG 6X6
  [213, "coin", 1500], // NISSAN SKYLINE GT-R (R33)
  [214, "coin", 1500], // TOYOTA CHASER TOURER V (JZX100)
  [215, "coin", 2000], // CHEVROLET TAHOE RST
  [216, "coin", 10000], // MCLAREN SENNA
  [217, "coin", 5000], // BMW X7 M50I
  [218, "coin", 1500], // TOYOTA CROWN ATHLETE
  [219, "coin", 1500], // VOLKSWAGEN PASSAT B8 SEDAN
  [220, "coin", 1000], // NISSAN FAIRLADY Z (240Z / S30)
  [221, "coin", 5000], // HONDA NSX-R (NA1 CLASSIC)
  [226, "paid", 295.99], // BMW 7 SERIES (G70 / I7)
  [227, "coin", 10000], // MERCEDES-AMG ONE
  [236, "coin", 5000], // CLASS A MOTORHOME / RV
  [241, "coin", 10000], // LAFERRARI
  [243, "paid", 246.99], // JEEP GLADIATOR RUBICON
  [252, "paid", 65.99], // TOYOTA ALTEZZA / LEXUS IS300 (SXE10)
  [253, "coin", 5000], // FORD F-650 SUPER DUTY — owner-quoted
  [255, "coin", 1000], // LEXUS IS250 / IS350
  [256, "coin", 1500], // FORD MUSTANG MACH 1 (1969)
  [257, "coin", 2500], // BMW M2 COUPE (F87)
  [258, "coin", 1500], // MERCEDES-BENZ W124 AMG HAMMER
  [259, "paid", 114.99], // TOYOTA FORTUNER (GAZOO RACING)
  [260, "coin", 1500], // NISSAN Z (RZ34 / 400Z)
  [261, "coin", 1500], // CHEVROLET SILVERADO 1500 TRAIL BOSS
  [262, "paid", 131.49], // TOYOTA CELICA GT-FOUR (ST205)
  [263, "paid", 410.99], // FORD MODEL A COUPE (1930)
  [264, "coin", 1500], // TOYOTA CAMRY (XV80 / 2025)
  [266, "paid", 295.99], // MASERATI MC20
  [267, "coin", 1200], // ALFA ROMEO STELVIO QUADRIFOGLIO
  [268, "coin", 700], // FIAT 500 ABARTH
  [269, "coin", 1500], // MITSUBISHI 3000GT / GTO
  [270, "coin", 1500], // LOTUS EVORA GT
  [271, "coin", 2000], // DODGE CHARGER DAYTONA / SRT
  [272, "coin", 1500], // TOYOTA SUPRA MK4 CUSTOM DRIFT BUILD
  [273, "coin", 1500], // RAM 1500 TRX OFFROAD EDITION
  [274, "paid", 164.49], // POLARIS RZR PRO XP BUGGY
  // Owner-verified separately (landed after the master table was compiled):
  [230, "paid", 246.99], // LAND ROVER DEFENDER 110 (2020+)
];
// Upsert in chunks — the pipeline endpoint dislikes very large bodies.
const CHUNK = 50;
await pipeline([rateReq("rand_per_coin", RATES.rand_per_coin), rateReq("rand_per_cash", RATES.rand_per_cash)]);
for (let i = 0; i < ENTRIES.length; i += CHUNK) {
  await pipeline(ENTRIES.slice(i, i + CHUNK).map(([code, kind, price]) => priceReq(code, kind, price)));
}

// Report what actually landed.
const countResults = await pipeline([
  {
    type: "execute",
    stmt: {
      sql: "SELECT kind, COUNT(*) AS n FROM trade_prices WHERE game = 'cpm2' GROUP BY kind ORDER BY kind",
      args: [],
    },
  },
  {
    type: "execute",
    stmt: {
      sql: "SELECT COUNT(*) AS n FROM trade_prices WHERE game = 'cpm2'",
      args: [],
    },
  },
  {
    type: "execute",
    stmt: { sql: "SELECT key, value FROM trade_rates", args: [] },
  },
]);
const rowsOf = (r) => r.response?.result?.rows ?? [];
console.log("loaded", ENTRIES.length, "entries");
for (const row of rowsOf(countResults[0])) {
  console.log("cpm2", row[0]?.value, ":", row[1]?.value);
}
const total = rowsOf(countResults[1])[0]?.[0]?.value;
console.log("cpm2 total rows in db:", total);
for (const row of rowsOf(countResults[2])) {
  console.log("rate", row[0]?.value, "=", row[1]?.value);
}
