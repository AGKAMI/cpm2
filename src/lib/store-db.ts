/**
 * VANTA GARAGE store database client.
 * Shares the existing Turso connection (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN)
 * but uses isolated `vanta_` tables — logical separation from the CPM2 fleet schema.
 */

import type { TursoHttpClient } from "./db-turso.ts";
import { VANTA_SCHEMA } from "./store-schema.ts";

// globalThis caches survive across route bundles within one server process
// (module-level singletons do not in this Next version — each bundle re-ran
// the schema batch + migrations ≈ 8s of sequential Turso round-trips).
const g = globalThis as typeof globalThis & {
  __vantaStoreDb?: TursoHttpClient;
  __vantaStoreBoot?: Promise<TursoHttpClient>;
  __vantaStoreMigrated?: boolean;
};

export async function getStoreDb(): Promise<TursoHttpClient> {
  if (g.__vantaStoreDb) return g.__vantaStoreDb;

  // Share ONE boot promise process-wide: concurrent first-queries (a page
  // render fires products + categories + promotions in parallel) must not
  // each run the schema batch + migrations.
  if (!g.__vantaStoreBoot) {
    g.__vantaStoreBoot = (async () => {
      const { createTursoClient } = await import("./db-turso.ts");
      const store = await createTursoClient();

      // Apply the VANTA schema idempotently — CREATE TABLE IF NOT EXISTS
      // is a no-op when tables already exist.
      const statements = VANTA_SCHEMA.trim()
        .split(";")
        .filter((s) => s.trim())
        .map((s) => s.trim() + ";");
      await store.batch(statements);

      g.__vantaStoreDb = store;

      // Idempotent migrations ONCE per process (they were previously re-run
      // for every route bundle's first cold hit — ~15 sequential round-trips).
      if (!g.__vantaStoreMigrated) {
        await runStoreMigrations(store);
        g.__vantaStoreMigrated = true;
      }

      return store;
    })();
    g.__vantaStoreBoot.catch(() => {
      // Allow a retry after a failed boot instead of caching the rejection.
      g.__vantaStoreBoot = undefined;
    });
  }
  return g.__vantaStoreBoot;
}

/** Run one-time schema migrations. Call once at deploy time, NOT on every cold start.
 *  Vercel serverless will hammer Turso if ALTER TABLE runs on every function invocation.
 */
export async function runStoreMigrations(storeArg?: TursoHttpClient): Promise<void> {
  const store = storeArg ?? (await getStoreDb());

  // Migration: add cpm2_car_code to existing vanta_products tables
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_products ADD COLUMN cpm2_car_code INTEGER`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add design-option columns (yes/no toggles, replace perf specs)
  for (const col of ['air_suspension', 'unlocked_bodykits']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: add spec columns (legacy — kept for old rows, no longer edited)
  for (const col of ['spec_hp', 'spec_top_speed', 'spec_zero_hundred', 'spec_drive']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} ${col === 'spec_zero_hundred' || col === 'spec_drive' ? 'TEXT' : 'INTEGER'}`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: add email column to vanta_customers (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_customers ADD COLUMN email TEXT NOT NULL DEFAULT ''`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add tag columns (is_new, is_sale) for corner badges
  for (const col of ['is_new', 'is_sale']) {
    try {
      await store.execute({
        sql: `ALTER TABLE vanta_products ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`,
        args: [],
      });
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Migration: add quantity column to vanta_orders (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add notifications_enabled column to vanta_customers (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_customers ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add nickname column to vanta_admins (if missing)
  try {
    await store.execute({
      sql: `ALTER TABLE vanta_admins ADD COLUMN nickname TEXT NOT NULL DEFAULT ''`,
      args: [],
    });
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: seed vanta_cpm2_cars with CPM2 catalog names (idempotent — INSERT OR IGNORE)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        (0, 'BMW 3 SERIES SEDAN (E36)'),
        (1, 'BMW 1 SERIES HATCHBACK (F20)'),
        (2, 'VOLKSWAGEN SCIROCCO III'),
        (3, 'BMW 5 SERIES SEDAN (F10)'),
        (4, 'MERCEDES-BENZ G-CLASS (W463 CLASSIC)'),
        (5, 'CHEVROLET CAMARO SS (5TH GEN)'),
        (6, 'SUBARU BRZ / TOYOTA GT86'),
        (7, 'LEXUS LFA'),
        (8, 'INFINITI G37 COUPE'),
        (9, 'SUBARU IMPREZA WRX GE'),
        (10, 'FERRARI F12BERLINETTA'),
        (11, 'NISSAN GT-R (R34 SKYLINE)'),
        (12, 'MITSUBISHI LANCER EVOLUTION X'),
        (13, 'HONDA CIVIC SEDAN (8TH GEN)'),
        (14, 'NISSAN GT-R (R35)'),
        (15, 'AUDI RS4 AVANT (B8)'),
        ),
        (17, 'MERCEDES-BENZ C63 AMG (W204)'),
        (18, 'NISSAN SILVIA S15 / SPEC-R'),
        (19, 'MERCEDES-AMG GT S'),
        (20, 'AUDI TT RS COUPE'),
        (21, 'JEEP WRANGLER RUBICON (JK)'),
        (22, 'BMW M6 GRAN COUPE (F06)'),
        (23, 'HYUNDAI VELOSTER TURBO'),
        (24, 'PORSCHE PANAMERA TURBO'),
        ),
        ),
        (27, 'BUGATTI VEYRON 16.4'),
        (28, 'PORSCHE CAYENNE TURBO'),
        (29, 'HONDA CIVIC TYPE R (FN2 HATCHBACK)'),
        (30, 'BMW 5 SERIES / M5 (E39)'),
        (31, 'BMW 5 SERIES / M5 (E60)'),
        (32, 'KOENIGSEGG AGERA R'),
        ),
        ),
        (35, 'FORD MUSTANG GT (5TH GEN)'),
        ),
        (37, 'FORD TRANSIT VAN'),
        ),
        (39, 'DODGE CHARGER R/T (1970)'),
        (40, 'CHEVROLET CORVETTE C7 STINGRAY'),
        (41, 'MCLAREN P1'),
        (42, 'LAMBORGHINI AVENTADOR LP700-4'),
        (43, 'LEXUS GS 350'),
        (44, 'LAMBORGHINI VENENO'),
        (45, 'BMW 5 SERIES SEDAN (E34)'),
        (47, 'HONDA S2000'),
        (48, 'MAZDA RX-8'),
        (49, 'TOYOTA SUPRA MK4 (A80)'))`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }

  // Seed batch 2 (codes 51-113)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        (51, 'FERRARI 250 GT CALIFORNIA SPIDER'),
        (53, 'NISSAN SKYLINE GT-R (KPGC10 HAKOSUKA)'),
        (54, 'BMW 5 SERIES (E28)'),
        (55, 'HUMMER H1'),
        (56, 'BMW M3 COUPE (E92)'),
        (57, 'CADILLAC CTS-V (1ST GEN)'),
        (58, 'FERRARI 458 ITALIA'),
        (59, 'SMART FORTWO (W451)'),
        (60, 'CADILLAC ESCALADE'),
        (61, 'MERCEDES-BENZ S-CLASS (W221)'),
        (62, 'DODGE CHARGER SRT HELLCAT (2015)'),
        ),
        (65, 'LAMBORGHINI GALLARDO SPYDER'),
        (66, 'CHRYSLER 300C'),
        ),
        ),
        (70, 'SCANIA R-SERIES HEAVY TRUCK'),
        ),
        ),
        ),
        (74, 'PEUGEOT 308'),
        (76, 'BMW Z4 M ROADSTER (E85)'),
        (77, 'MINI COOPER S ROADSTER (R59)'),
        (81, 'SUBARU IMPREZA WRX STI WRC RALLY'),
        (82, 'MITSUBISHI LANCER EVOLUTION IX'),
        ),
        ),
        (85, 'FORD F-150 SVT RAPTOR'),
        (86, 'BMW X5 M (E53)'),
        (87, 'MERCEDES-BENZ CL 65 AMG'),
        (88, 'BMW M3 COUPE (E46)'),
        (89, 'OPEL OMEGA B / VAUXHALL OMEGA'),
        ),
        ),
        ),
        (99, 'LADA PRIORA'),
        (100, 'TOFAS SAHIN / KARTAL SLX'),
        (101, 'FORD F-650 TOW TRUCK'),
        (102, 'LADA 2104 ESTATE'),
        (103, 'BMW M4 COUPE (F82)'),
        (104, 'BMW M5 (F90)'),
        (105, 'DODGE CHALLENGER SRT DEMON'),
        (106, 'MERCEDES-BENZ 190E (W201) / W124'),
        (107, 'AUDI R8 V10 PLUS'),
        (108, 'AUDI SPORT QUATTRO'),
        (109, 'PORSCHE 911 CARRERA S (991)'),
        (110, 'RANGE ROVER SPORT SVR'),
        (111, 'ACURA / HONDA NSX (NC1)'),
        (112, 'MERCEDES-BENZ S-CLASS (W140)'),
        (113, 'VOLKSWAGEN GOLF MK6 GTI')`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }

  // Seed batch 3 (codes 114-166)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        (114, 'MERCEDES-AMG E63 S (W213)'),
        (115, 'AUDI R8 V10 PERFORMANCE'),
        (116, 'FORD MUSTANG GT FASTBACK (2015)'),
        (117, 'AUDI S5 COUPE'),
        (118, 'BMW X6 M (F16)'),
        (119, 'HUMMER H1 CUSTOM OFFROAD BUILD'),
        (120, 'TOYOTA CAMRY (XV70)'),
        (121, 'TOYOTA LAND CRUISER 200'),
        (123, 'MERCEDES-BENZ GLE COUPE AMG'),
        (124, 'ROLLS-ROYCE DAWN CONVERTIBLE'),
        (125, 'LAMBORGHINI URUS'),
        (126, 'GMC SIERRA 1500 PICKUP'),
        (127, 'BMW M2 (G87)'),
        (129, 'MAZDA RX-7 FD3S'),
        (130, 'FORD GT (2ND GEN)'),
        (131, 'NISSAN 240SX / 180SX (S13)'),
        (132, 'ISUZU GIGA HEAVY TRUCK'),
        (133, 'MINI COOPER S (R56 HATCHBACK)'),
        (134, 'TOYOTA MARK II (JZX100)'),
        (135, 'AUDI A7 / RS7 SPORTBACK'),
        (136, 'MERCEDES-MAYBACH S-CLASS (X222)'),
        (137, 'HONDA CIVIC SEDAN (FD2)'),
        (138, 'BMW I8 COUPE'),
        (139, 'FORD CROWN VICTORIA POLICE INTERCEPTOR'),
        (140, 'TOYOTA COROLLA LEVIN / SPRINTER TRUENO (AE86)'),
        (141, 'DODGE VIPER ACR'),
        (142, 'MERCEDES-AMG GT 63 S 4-DOOR COUPE'),
        (143, 'MERCEDES-AMG G63 (W463A)'),
        (144, 'BMW M8 COMPETITION COUPE'),
        (145, 'NISSAN 350Z (Z33)'),
        (146, 'LADA NIVA (VAZ-2121)'),
        (147, 'HONDA CIVIC TYPE R (FK8)'),
        (149, 'CHEVROLET BEL AIR SPORT COUPE (1957)'),
        (150, 'TOYOTA GR SUPRA (A90 / MK5)'),
        (151, 'TOYOTA ALPHARD EXECUTIVE LOUNGE'),
        (152, 'TOFAS KARTAL SLX WAGON'),
        (153, 'BMW M4 COMPETITION (G82)'),
        (154, 'TOYOTA HILUX REVO PICKUP'),
        (155, 'SCUDERIA FERRARI FORMULA 1 CAR'),
        (156, 'NISSAN SKYLINE GT-R (R32)'),
        (157, 'VOLKSWAGEN GOLF MK2 GTI'),
        (158, 'MAZDA MX-5 MIATA (NA)'),
        (159, 'LAMBORGHINI AVENTADOR SVJ'),
        (160, 'DODGE CHALLENGER R/T COUPE (1970)'),
        (161, 'JEEP GRAND CHEROKEE TRACKHAWK'),
        (162, 'MCLAREN 720S'),
        (163, 'MERCEDES-BENZ 230 SL PAGODA (W113)'),
        (164, 'CAN-AM MAVERICK X3 BUGGY'),
        (165, 'FORMULA 2 / OPEN-WHEEL RACE CAR'),
        (166, 'CHEVROLET CORVETTE C8 STINGRAY')`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }

  // Seed batch 4 (codes 167-221)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        (167, 'RAM 1500 TRX PICKUP'),
        (169, 'BENTLEY CONTINENTAL GT'),
        (170, 'KENWORTH T680 USA SEMI-TRUCK'),
        (171, 'SINOTRUK SITRAK C7H COMMERCIAL TRUCK'),
        (172, 'ROLLS-ROYCE CULLINAN'),
        (173, 'MERCEDES-BENZ CLS 63 AMG'),
        (175, 'MERCEDES-BENZ E-CLASS (W210)'),
        (176, 'CHEVROLET C10 PICKUP (1983)'),
        (177, 'NISSAN SILVIA S13'),
        (178, 'BUGATTI CHIRON'),
        (179, 'CHEVROLET CAPRICE CLASSIC (1980S)'),
        (180, 'FORD F-100 PICKUP (1970S)'),
        (181, 'FORD MUSTANG I FASTBACK (1964)'),
        (182, 'FORD F-150 HOONITRUCK (KEN BLOCK)'),
        (183, 'FORD MUSTANG HOONICORN V2 (KEN BLOCK)'),
        (184, 'MITSUBISHI ECLIPSE GSX'),
        (185, 'CHEVROLET IMPALA (1967)'),
        (186, 'FORD EXPLORER V SUV'),
        (188, 'PORSCHE 911 GT3 RS (992)'),
        (189, 'FORD F-150 RAPTOR (2021)'),
        (190, 'PEUGEOT 406 (TAXI MOVIE EDITION)'),
        (191, 'LIAZ 5292 CITY BUS'),
        (192, 'RAM 2500 HEAVY DUTY PICKUP'),
        (193, 'BMW M3 TOURING (G81)'),
        (194, 'MERCEDES-BENZ SLR MCLAREN'),
        (195, 'NEOPLAN / SETRA COMMERCIAL TOUR BUS'),
        (196, 'FORD FALCON XB GT COUPE'),
        (197, 'VOLKSWAGEN TYPE 2 CAMPER VAN (T1)'),
        (198, 'KOENIGSEGG JESKO'),
        (199, 'CHEVROLET CORVETTE C6 Z06'),
        (200, 'DODGE DURANGO SRT'),
        (201, 'MERCEDES-BENZ CLK-GTR'),
        (202, 'PAGANI ZONDA F / CINQUE'),
        (204, 'MERCEDES-BENZ SPRINTER VAN'),
        (205, 'PORSCHE 911 CARRERA (930 TURBO CLASSIC)'),
        (206, 'ALFA ROMEO GIULIA QUADRIFOGLIO'),
        (207, 'PORSCHE 919 HYBRID LMP1'),
        (208, 'FORD BRONCO (2021)'),
        (209, 'LEXUS IS F'),
        (210, 'CHEVROLET CORVETTE C3 STINGRAY'),
        (211, 'AUDI RS7 SPORTBACK (C8)'),
        (212, 'MERCEDES-BENZ G63 AMG 6X6'),
        (213, 'NISSAN SKYLINE GT-R (R33)'),
        (214, 'TOYOTA CHASER TOURER V (JZX100)'),
        (215, 'CHEVROLET TAHOE RST'),
        (216, 'MCLAREN SENNA'),
        (217, 'BMW X7 M50I'),
        (218, 'TOYOTA CROWN ATHLETE'),
        (219, 'VOLKSWAGEN PASSAT B8 SEDAN'),
        (220, 'NISSAN FAIRLADY Z (240Z / S30)')`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }

  // Seed batch 5 (codes 221-281)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        (221, 'HONDA NSX-R (NA1 CLASSIC)'),
        (226, 'BMW 7 SERIES (G70 / I7)'),
        (227, 'MERCEDES-AMG ONE'),
        ),
        (236, 'CLASS A MOTORHOME / RV'),
        (241, 'LAFERRARI'),
        (243, 'JEEP GLADIATOR RUBICON'),
        (252, 'TOYOTA ALTEZZA / LEXUS IS300 (SXE10)'),
        (253, 'FORD F-650 SUPER DUTY'),
        (255, 'LEXUS IS250 / IS350'),
        (256, 'FORD MUSTANG MACH 1 (1969)'),
        (257, 'BMW M2 COUPE (F87)'),
        (258, 'MERCEDES-BENZ W124 AMG HAMMER'),
        (259, 'TOYOTA FORTUNER (GAZOO RACING)'),
        (260, 'NISSAN Z (RZ34 / 400Z)'),
        (261, 'CHEVROLET SILVERADO 1500 TRAIL BOSS'),
        (262, 'TOYOTA CELICA GT-FOUR (ST205)'),
        (263, 'FORD MODEL A COUPE (1930)'),
        (264, 'TOYOTA CAMRY (XV80 / 2025)'),
        ),
        (266, 'MASERATI MC20'),
        (267, 'ALFA ROMEO STELVIO QUADRIFOGLIO'),
        (268, 'FIAT 500 ABARTH'),
        (269, 'MITSUBISHI 3000GT / GTO'),
        (270, 'LOTUS EVORA GT'),
        (271, 'DODGE CHARGER DAYTONA / SRT'),
        (272, 'TOYOTA SUPRA MK4 CUSTOM DRIFT BUILD'),
        (273, 'RAM 1500 TRX OFFROAD EDITION'),
        (274, 'POLARIS RZR PRO XP BUGGY'),
        ),
        ),
        ),
        ),
        ),
        ))`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }

  // Seed batch 6 (codes 282-354)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ))`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }

  // Seed batch 7 (codes 352-409)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ),
        ))`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }
}

export async function closeStoreDb(): Promise<void> {
  const g = globalThis as typeof globalThis & {
    __vantaStoreDb?: TursoHttpClient;
    __vantaStoreBoot?: Promise<TursoHttpClient>;
  };
  g.__vantaStoreDb = undefined;
  g.__vantaStoreBoot = undefined;
}
