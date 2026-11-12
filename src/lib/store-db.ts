/**
 * VANTA GARAGE store database client.
 * Shares the existing Turso connection (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN)
 * but uses isolated `vanta_` tables — logical separation from the CPM2 fleet schema.
 */

import type { TursoHttpClient } from "./db-turso.ts";
import { VANTA_SCHEMA } from "./store-schema.ts";

let _store: TursoHttpClient | null = null;

export async function getStoreDb(): Promise<TursoHttpClient> {
  if (_store) return _store;

  const { createTursoClient } = await import("./db-turso.ts");
  _store = await createTursoClient();

  // Apply the VANTA schema idempotently on first boot — CREATE TABLE IF NOT EXISTS
  // is safe to run on every cold start (no-op when tables already exist).
  const statements = VANTA_SCHEMA.trim()
    .split(";")
    .filter((s) => s.trim())
    .map((s) => s.trim() + ";");

  await _store.batch(statements);

  // Run idempotent migrations (ALTER TABLE adds columns if missing; try/catch
  // makes this safe to re-run on every cold start — quickly no-ops when columns exist).
  await runStoreMigrations();

  return _store;
}

/** Run one-time schema migrations. Call once at deploy time, NOT on every cold start.
 *  Vercel serverless will hammer Turso if ALTER TABLE runs on every function invocation.
 */
export async function runStoreMigrations(): Promise<void> {
  const store = await getStoreDb();

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
        (16, 'BMW M3 COUPE (E36)'),
        (17, 'MERCEDES-BENZ C63 AMG (W204)'),
        (18, 'NISSAN SILVIA S15 / SPEC-R'),
        (19, 'MERCEDES-AMG GT S'),
        (20, 'AUDI TT RS COUPE'),
        (21, 'JEEP WRANGLER RUBICON (JK)'),
        (22, 'BMW M6 GRAN COUPE (F06)'),
        (23, 'HYUNDAI VELOSTER TURBO'),
        (24, 'PORSCHE PANAMERA TURBO'),
        (25, 'Mercedes-AMG GT R'),
        (26, 'OPEL OMEGA B / VAUXHALL OMEGA'),
        (27, 'BUGATTI VEYRON 16.4'),
        (28, 'PORSCHE CAYENNE TURBO'),
        (29, 'HONDA CIVIC TYPE R (FN2 HATCHBACK)'),
        (30, 'BMW 5 SERIES / M5 (E39)'),
        (31, 'BMW 5 SERIES / M5 (E60)'),
        (32, 'KOENIGSEGG AGERA R'),
        (33, 'MERCEDES-AMG GT 63 S 4-DOOR COUPE'),
        (34, 'BMW M6 F13 Coupe'),
        (35, 'FORD MUSTANG GT (5TH GEN)'),
        (36, 'Porsche Panamera Turbo'),
        (37, 'FORD TRANSIT VAN'),
        (38, 'TOYOTA CHASER TOURER V (JZX100)'),
        (39, 'DODGE CHARGER R/T (1970)'),
        (40, 'CHEVROLET CORVETTE C7 STINGRAY'),
        (41, 'MCLAREN P1'),
        (42, 'LAMBORGHINI AVENTADOR LP700-4'),
        (43, 'LEXUS GS 350'),
        (44, 'LAMBORGHINI VENENO'),
        (45, 'BMW 5 SERIES SEDAN (E34)'),
        (47, 'HONDA S2000'),
        (48, 'MAZDA RX-8'),
        (49, 'TOYOTA SUPRA MK4 (A80)'),
        (50, 'Koenigsegg Agera R')`,
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
        (64, 'Chevrolet 208'),
        (65, 'LAMBORGHINI GALLARDO SPYDER'),
        (66, 'CHRYSLER 300C'),
        (67, 'Lexus GS 350'),
        (69, 'BMW M5 E36'),
        (70, 'SCANIA R-SERIES HEAVY TRUCK'),
        (71, 'Honda S2000'),
        (72, 'Mazda RX-8'),
        (73, 'Toyota Supra A80'),
        (74, 'PEUGEOT 308'),
        (76, 'BMW Z4 M ROADSTER (E85)'),
        (77, 'MINI COOPER S ROADSTER (R59)'),
        (81, 'SUBARU IMPREZA WRX STI WRC RALLY'),
        (82, 'MITSUBISHI LANCER EVOLUTION IX'),
        (83, '1971 Nissan Skyline 2000 GT-R'),
        (84, 'BMW M5 E28'),
        (85, 'FORD F-150 SVT RAPTOR'),
        (86, 'BMW X5 M (E53)'),
        (87, 'MERCEDES-BENZ CL 65 AMG'),
        (88, 'BMW M3 COUPE (E46)'),
        (89, 'OPEL OMEGA B / VAUXHALL OMEGA'),
        (96, 'Cadillac Escalade ESV'),
        (97, 'Mercedes-Benz S65 AMG'),
        (98, 'Dodge Charger R/T'),
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
        (230, 'LAND ROVER DEFENDER 110 (2020+)'),
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
        (265, 'Porsche 997 Carrera S'),
        (266, 'MASERATI MC20'),
        (267, 'ALFA ROMEO STELVIO QUADRIFOGLIO'),
        (268, 'FIAT 500 ABARTH'),
        (269, 'MITSUBISHI 3000GT / GTO'),
        (270, 'LOTUS EVORA GT'),
        (271, 'DODGE CHARGER DAYTONA / SRT'),
        (272, 'TOYOTA SUPRA MK4 CUSTOM DRIFT BUILD'),
        (273, 'RAM 1500 TRX OFFROAD EDITION'),
        (274, 'POLARIS RZR PRO XP BUGGY'),
        (275, 'VW GOLF GTI MK7'),
        (276, 'MERCEDES-AMG E43'),
        (277, 'AUDI R8 V10'),
        (278, 'FORD MUSTANG'),
        (279, 'AUDI A5 SPORTBACK'),
        (280, 'BMW X6 M F16'),
        (281, 'Toyota 86 / Scion FR-S')`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }

  // Seed batch 6 (codes 282-354)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        (282, 'Infiniti G37 Coupe'),
        (283, 'Subaru Impreza WRX GE'),
        (284, 'Ferrari F12 Berlinetta'),
        (285, 'Nissan GT-R R34'),
        (286, 'Mitsubishi Lancer Evolution X'),
        (287, '1997 Honda Civic'),
        (288, 'Nissan GT-R R35'),
        (289, 'Audi RS4 B5 Avant'),
        (290, 'Mercedes-Benz W204 C63 AMG'),
        (291, 'Audi TT 8J'),
        (292, 'Bugatti Veyron Super Sport'),
        (293, 'Porsche 958 Cayenne Turbo S'),
        (294, 'Honda Civic Type R FN2'),
        (295, 'BMW M5 E39'),
        (296, 'BMW M5 E60'),
        (297, 'Ford Mustang Shelby GT500'),
        (298, 'Ford Transit van'),
        (299, '1970 Dodge Charger R/T'),
        (300, 'McLaren P1'),
        (301, 'Hummer H1'),
        (302, 'BMW M3 E92'),
        (303, 'Cadillac CTS-V'),
        (304, 'Ferrari 458 Italia'),
        (305, 'Mercedes-Benz 280 SL'),
        (306, 'Chrysler 300'),
        (307, 'Scania R580 truck'),
        (308, 'Peugeot 308'),
        (309, 'BMW Z4 E89'),
        (310, 'Mini Cooper'),
        (311, 'Bentley EXP 10'),
        (312, 'Subaru Impreza WRX'),
        (313, 'Mitsubishi Lancer Evo'),
        (314, 'Ford F-150 SVT Raptor'),
        (315, 'BMW X5 E70'),
        (316, 'BMW M3 GTR E46'),
        (317, 'Hudson Hornet Club Coupe'),
        (318, 'Lada Priora'),
        (319, 'Lada VAZ 2114'),
        (320, 'BMW M4 F82 (yellow variant)'),
        (321, 'BMW M5 F90'),
        (322, 'Dodge Challenger SRT Demon'),
        (323, 'Mercedes-Benz W201 190D'),
        (324, 'Audi Sport Quattro'),
        (325, 'Range Rover Sport'),
        (326, 'Mercedes-Benz W140'),
        (333, 'Toyota Camry XV70'),
        (334, 'Toyota Land Cruiser VX'),
        (335, 'Mercedes-Benz GLE 350'),
        (336, 'Rolls-Royce Dawn'),
        (337, 'GMC Sierra 3500 HD DRW'),
        (338, 'BMW M2 F87'),
        (339, 'Mazda RX-7'),
        (340, 'Ford GT40'),
        (341, 'Nissan 240SX S13'),
        (342, 'Lada Riva / VAZ 2107'),
        (343, 'Perodua Myvi'),
        (344, 'Toyota Mark II X90'),
        (345, 'Audi RS6 Avant'),
        (346, 'Mercedes-AMG S65'),
        (347, 'Honda Civic Type R FN2 Sedan'),
        (348, 'BMW i8'),
        (349, 'Ford Crown Victoria'),
        (350, 'Toyota Corolla Splinter'),
        (351, 'Dodge Viper SRT')`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }

  // Seed batch 7 (codes 352-409)
  try {
    await store.execute({
      sql: `INSERT OR IGNORE INTO vanta_cpm2_cars (code, name) VALUES
        (352, 'Mercedes-AMG GT63'),
        (353, 'BMW M8 Gran Coupe'),
        (354, 'Nissan 350Z'),
        (355, 'BA32121'),
        (356, 'Honda Civic Type R FK8'),
        (357, '1969 Mustang Boss 302'),
        (358, 'Chevrolet Bel Air'),
        (359, 'Toyota Supra MK5'),
        (360, 'Toyota Vellfire'),
        (361, 'Tofaş Kartal'),
        (362, 'BMW M4 Competition G82'),
        (363, 'Toyota Hilux SR5'),
        (364, 'F1 Car (F1)'),
        (365, 'Nissan GT-R R32'),
        (366, 'VW Golf II GTI'),
        (367, 'Mazda MX-5'),
        (368, 'Dodge Charger R/T'),
        (369, 'Jeep Cherokee'),
        (370, 'McLaren 720S'),
        (371, 'Mercedes-Benz 280 SL'),
        (372, 'Buggy'),
        (373, 'F1 Car (F2)'),
        (374, 'Chevrolet Corvette C8'),
        (375, 'Ford Explorer'),
        (376, 'Kenworth T680 truck'),
        (377, 'DAF XF truck'),
        (378, 'Rolls-Royce Cullinan'),
        (379, 'Mercedes-Benz W210 Classic'),
        (380, 'Chevrolet Cheyenne C10'),
        (381, 'Nissan Silvia S13'),
        (382, 'Bugatti Chiron'),
        (383, 'Dodge Diplomat II'),
        (384, 'Ford F-150'),
        (385, '1966 Ford Mustang'),
        (386, 'Ford F-150 Hoonicorn'),
        (387, 'Mustang Boss 302 Hoonicorn'),
        (388, 'Mitsubishi Eclipse G2'),
        (389, 'Chevrolet Impala'),
        (390, 'Cherry Astro Cargo'),
        (391, 'Mazda MX-5 Miata'),
        (392, 'Porsche 911 GT3'),
        (393, 'Ford Raptor'),
        (400, 'Peugeot 406'),
        (401, 'Mercedes-Benz Citaro G bus'),
        (402, 'Dodge Ram TRX 1500'),
        (403, 'BMW M3 Touring'),
        (404, 'Mercedes-Benz SLR McLaren'),
        (405, 'Neoplan Tourliner bus'),
        (406, 'Ford Falcon XB'),
        (407, 'VW Type 2'),
        (408, 'Koenigsegg Jesko'),
        (409, 'FERRARI F40')`,
      args: [],
    });
  } catch {
    // Seed already applied — safe to ignore
  }
}

export async function closeStoreDb(): Promise<void> {
  _store = null;
}
