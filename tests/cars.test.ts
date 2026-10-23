import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-cars-"));
process.env.CPM2_DB_PATH = path.join(tmp, "fleet.db");
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");

const { CAR_CATALOG, carByCode, searchCars } = await import("../src/lib/car-catalog.ts");
const {
  createAccount,
  archiveAccount,
  listGarage,
  fleetGarages,
  addGarageCar,
  removeGarageCar,
  listEvents,
} = await import("../src/lib/service.ts");
const { closeDb, createDatabase } = await import("../src/lib/db.ts");
const { ApiError } = await import("../src/lib/api.ts");
const { carCapacity } = await import("../src/lib/constants.ts");

after(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeAccount(email: string, baseSlots = 2, slots = 0) {
  return createAccount({ email, password: "pw", cash: 0, coins: 0, cars: 0, baseSlots, slots });
}

function hasCode(fn: () => unknown, code: string) {
  assert.throws(fn, (err: unknown) => err instanceof ApiError && err.code === code);
}

describe("car catalog", () => {
  it("holds 208 catalog entries with unique ascending codes", () => {
    assert.equal(CAR_CATALOG.length, 208);
    const codes = CAR_CATALOG.map((entry) => entry.code);
    assert.equal(new Set(codes).size, codes.length);
    assert.deepEqual(codes, [...codes].sort((a, b) => a - b));
  });

  it("looks cars up by code", () => {
    assert.equal(carByCode(49)?.name, "TOYOTA SUPRA A80 (MK4)");
    assert.equal(carByCode(0)?.name, "BMW 3 SERIES (E36)");
    assert.equal(carByCode(11)?.name, "NISSAN SKYLINE GT-R (R34)");
    assert.equal(carByCode(17)?.name, "MERCEDES-BENZ C-CLASS (W204)");
    assert.equal(carByCode(104)?.name, "BMW M5 (F90)");
    assert.equal(carByCode(9999), undefined);
  });

  it("searchCars matches code prefixes for numeric queries", () => {
    const exact = searchCars("49");
    assert.equal(exact[0]?.code, 49);
    assert.equal(exact[0]?.name, "TOYOTA SUPRA A80 (MK4)");

    const prefix = searchCars("4");
    assert.ok(prefix.length > 5);
    for (const entry of prefix) {
      assert.ok(String(entry.code).startsWith("4"), `#${entry.code} does not start with 4`);
    }
  });

  it("searchCars matches names case-insensitively", () => {
    const hits = searchCars("supra");
    assert.ok(hits.length > 0);
    for (const entry of hits) {
      assert.match(entry.name, /SUPRA/);
    }
    assert.deepEqual(searchCars("SUPRA"), hits);
    assert.deepEqual(searchCars("  supra  "), hits);
  });

  it("searchCars returns the catalog slice for empty queries and respects the limit", () => {
    assert.deepEqual(
      searchCars("", 5),
      CAR_CATALOG.slice(0, 5),
    );
    assert.equal(searchCars("", CAR_CATALOG.length).length, CAR_CATALOG.length);
    assert.equal(searchCars("gt", 3).length, 3);
    assert.deepEqual(searchCars("no-such-car"), []);
  });
});

describe("garage inventory", () => {
  it("starts empty with capacity from base slots plus purchased slots", () => {
    const account = makeAccount("garage-empty@cpm2.gg", 3, 2);
    const garage = listGarage(account.id);
    assert.equal(garage.count, 0);
    assert.equal(garage.capacity, carCapacity(3, 2));
    assert.deepEqual(garage.cars, []);
    assert.equal(garage.email, "garage-empty@cpm2.gg");
  });

  it("parks catalog cars and lists newest first", () => {
    const account = makeAccount("garage-add@cpm2.gg", 5, 0);
    const supra = addGarageCar(account.id, { carCode: 49, notes: "weekend car" });
    assert.equal(supra.carCode, 49);
    assert.equal(supra.carName, "TOYOTA SUPRA A80 (MK4)");
    assert.equal(supra.notes, "weekend car");

    addGarageCar(account.id, { carCode: 40 });

    const garage = listGarage(account.id);
    assert.equal(garage.count, 2);
    assert.deepEqual(
      garage.cars.map((car) => car.carCode),
      [40, 49],
    );
    assert.equal(garage.cars[1]?.notes, "weekend car");
  });

  it("allows the same model more than once and rejects unknown codes", () => {
    const account = makeAccount("garage-dupes@cpm2.gg", 5, 0);
    const first = addGarageCar(account.id, { carCode: 49, notes: "track" });
    const second = addGarageCar(account.id, { carCode: 49, notes: "street" });
    assert.notEqual(first.id, second.id);

    const garage = listGarage(account.id);
    assert.equal(garage.count, 2);
    assert.deepEqual(
      garage.cars.map((car) => car.carCode),
      [49, 49],
    );

    hasCode(() => addGarageCar(account.id, { carCode: 9999 }), "car_unknown");
    assert.equal(listGarage(account.id).count, 2);
  });

  it("removes duplicate models one at a time", () => {
    const account = makeAccount("garage-dupe-remove@cpm2.gg", 3, 0);
    const first = addGarageCar(account.id, { carCode: 49, notes: "first" });
    const second = addGarageCar(account.id, { carCode: 49, notes: "second" });

    removeGarageCar(account.id, first.id);
    const left = listGarage(account.id);
    assert.equal(left.count, 1);
    assert.equal(left.cars[0]?.id, second.id);
    assert.equal(left.cars[0]?.notes, "second");
  });

  it("rejects a car when the garage is full", () => {
    const account = makeAccount("garage-full@cpm2.gg", 2, 0);
    addGarageCar(account.id, { carCode: 0 });
    addGarageCar(account.id, { carCode: 1 });

    hasCode(() => addGarageCar(account.id, { carCode: 2 }), "garage_full");
    assert.equal(listGarage(account.id).count, 2);
  });

  it("removes a car, logs the event, and frees the slot", () => {
    const account = makeAccount("garage-remove@cpm2.gg", 1, 0);
    const car = addGarageCar(account.id, { carCode: 49 });

    const result = removeGarageCar(account.id, car.id);
    assert.equal(result.removed, car.id);
    assert.equal(result.carName, "TOYOTA SUPRA A80 (MK4)");
    assert.equal(listGarage(account.id).count, 0);

    const event = listEvents(10).find(
      (entry) => entry.accountId === account.id && entry.type === "car_removed",
    );
    assert.ok(event);
    assert.match(event.summary, /TOYOTA SUPRA A80/);

    assert.doesNotThrow(() => addGarageCar(account.id, { carCode: 49 }));
    hasCode(() => removeGarageCar(account.id, 999999), "car_not_found");
  });

  it("aggregates every garage for the overview", () => {
    const account = makeAccount("garage-fleet@cpm2.gg", 3, 0);
    addGarageCar(account.id, { carCode: 7 });

    const garages = fleetGarages();
    const match = garages.find((garage) => garage.accountId === account.id);
    assert.ok(match);
    assert.equal(match.count, 1);
    assert.equal(match.cars[0]?.carName, "LEXUS LFA");
  });

  it("keeps archived garages readable but frozen", () => {
    const account = makeAccount("garage-archived@cpm2.gg", 3, 0);
    addGarageCar(account.id, { carCode: 13 });
    archiveAccount(account.id);

    const garage = listGarage(account.id);
    assert.equal(garage.count, 1);
    assert.equal(garage.cars[0]?.carCode, 13);

    hasCode(() => addGarageCar(account.id, { carCode: 14 }), "NOT_FOUND");
  });
});

describe("garage schema migration", () => {
  it("drops the legacy one-per-code UNIQUE constraint and keeps rows", () => {
    const legacyPath = path.join(tmp, "legacy-garage.db");
    const legacy = new Database(legacyPath);
    legacy.exec(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        password_enc TEXT NOT NULL,
        cash INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 0,
        cars INTEGER NOT NULL DEFAULT 0,
        slots INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO accounts (id, email, password_enc, created_at, updated_at)
      VALUES (1, 'legacy@cpm2.gg', 'x', 'now', 'now');

      CREATE TABLE account_cars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        car_code INTEGER NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (account_id, car_code),
        CHECK (car_code >= 0 AND car_code <= 9999)
      );
      INSERT INTO account_cars (account_id, car_code, notes, created_at)
      VALUES (1, 49, 'legacy', 'now');
    `);
    legacy.close();

    const db = createDatabase(legacyPath);
    try {
      const schema = db
        .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'account_cars'`)
        .get() as { sql: string };
      assert.equal(/UNIQUE/i.test(schema.sql), false);

      db.prepare(
        `INSERT INTO account_cars (account_id, car_code, notes, created_at)
         VALUES (1, 49, 'second', 'now')`,
      ).run();

      const rows = db
        .prepare(`SELECT car_code, notes FROM account_cars ORDER BY id`)
        .all() as { car_code: number; notes: string }[];
      assert.deepEqual(rows, [
        { car_code: 49, notes: "legacy" },
        { car_code: 49, notes: "second" },
      ]);
    } finally {
      db.close();
    }
  });
});
