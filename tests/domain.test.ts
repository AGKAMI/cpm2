import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-test-"));
process.env.CPM2_DB_PATH = path.join(tmp, "fleet.db");
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");

const { createAccount, updateAccount, archiveAccount, purchaseSlots, listAccounts, listEvents, revealPassword, fleetStats, exportFleet } = await import(
  "../src/lib/service.ts"
);
const { ApiError } = await import("../src/lib/api.ts");
const { encryptSecret, decryptSecret, resetKeyCache } = await import("../src/lib/crypto.ts");
const { closeDb, createDatabase } = await import("../src/lib/db.ts");

const valid = {
  email: "alpha@cpm2.gg",
  password: "sup3rSecret!",
  cash: 1_000_000,
  coins: 5_000,
  cars: 12,
  slots: 1,
  notes: "main",
};

after(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("limits", () => {
  it("rejects cash above 50,000,000", () => {
    assert.throws(() => createAccount({ ...valid, email: "cash@cpm2.gg", cash: 50_000_001 }), /Cash cannot exceed/);
  });

  it("accepts cash exactly at the cap", () => {
    const account = createAccount({ ...valid, email: "cashmax@cpm2.gg", cash: 50_000_000 });
    assert.equal(account.cash, 50_000_000);
  });

  it("rejects coins above 30,000", () => {
    assert.throws(() => createAccount({ ...valid, email: "coins@cpm2.gg", coins: 30_001 }), /Coins cannot exceed/);
  });

  it("accepts coins exactly at the cap", () => {
    const account = createAccount({ ...valid, email: "coinmax@cpm2.gg", coins: 30_000 });
    assert.equal(account.coins, 30_000);
  });

  it("rejects more than one coin-bought slot", () => {
    assert.throws(() => createAccount({ ...valid, email: "slots@cpm2.gg", slots: 2 }), /Extra slots cannot exceed/);
  });

  it("rejects cars above the garage ceiling", () => {
    assert.throws(
      () => createAccount({ ...valid, email: "cars@cpm2.gg", cars: 37, slots: 1, newGarage: true }),
      /Cars cannot exceed 36/,
    );
  });

  it("rejects negative values", () => {
    assert.throws(() => createAccount({ ...valid, email: "neg@cpm2.gg", cash: -1 }), /Cash cannot be negative/);
  });

  it("rejects cars that do not fit in the garage", () => {
    assert.throws(
      () => createAccount({ ...valid, email: "nofit@cpm2.gg", cars: 21, slots: 0 }),
      /Cars cannot exceed 20/,
    );
  });

  it("allows 20 base cars plus one slot", () => {
    const account = createAccount({ ...valid, email: "fits@cpm2.gg", cars: 21, slots: 1 });
    assert.equal(account.capacity, 21);
  });

  it("adds the new garage's 15 slots", () => {
    const account = createAccount({
      ...valid,
      email: "garage-buy@cpm2.gg",
      cars: 0,
      slots: 1,
      newGarage: true,
    });
    assert.equal(account.newGarage, true);
    assert.equal(account.capacity, 36);
  });
});

describe("accounts", () => {
  it("creates an account and logs the event", () => {
    const account = createAccount(valid);
    assert.equal(account.email, "alpha@cpm2.gg");
    assert.equal(account.capacity, 21);
    const events = listEvents(20);
    assert.ok(events.some((event) => event.type === "created" && event.email === "alpha@cpm2.gg"));
  });

  it("blocks duplicate emails regardless of case", () => {
    assert.throws(() => createAccount({ ...valid, email: "ALPHA@cpm2.gg" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 409);
      assert.equal(err.code, "EMAIL_TAKEN");
      return true;
    });
  });

  it("rejects a malformed email", () => {
    assert.throws(() => createAccount({ ...valid, email: "not-an-email" }), /valid email/);
  });

  it("rejects a blank password", () => {
    assert.throws(() => createAccount({ ...valid, email: "blank@cpm2.gg", password: "   " }), /Password cannot be blank/);
  });

  it("keeps passwords exactly as typed", () => {
    const account = createAccount({ ...valid, email: "spaces@cpm2.gg", password: "  pad ded  " });
    assert.equal(revealPassword(account.id).password, "  pad ded  ");
  });

  it("updates balances and records the diff", () => {
    const account = createAccount({ ...valid, email: "upd@cpm2.gg" });
    const updated = updateAccount(account.id, { cash: 2_000_000, coins: 4_000 });
    assert.equal(updated.cash, 2_000_000);
    assert.equal(updated.coins, 4_000);

    const event = listEvents(50).find((item) => item.email === "upd@cpm2.gg" && item.type === "updated");
    assert.ok(event);
    assert.deepEqual(event.changes.cash, { from: 1_000_000, to: 2_000_000 });
  });

  it("refuses to update cars beyond the current capacity", () => {
    const account = createAccount({ ...valid, email: "cap@cpm2.gg", cars: 20, slots: 0 });
    assert.throws(() => updateAccount(account.id, { cars: 21 }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "CAR_CAPACITY_EXCEEDED");
      return true;
    });
  });

  it("refuses to update into an email that already exists", () => {
    const first = createAccount({ ...valid, email: "one@cpm2.gg" });
    createAccount({ ...valid, email: "two@cpm2.gg" });
    assert.throws(() => updateAccount(first.id, { email: "two@cpm2.gg" }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 409);
      return true;
    });
  });

  it("archives an account and keeps the audit trail", () => {
    const account = createAccount({ ...valid, email: "gone@cpm2.gg" });
    archiveAccount(account.id);
    assert.equal(listAccounts().some((item) => item.id === account.id), false);
    assert.ok(listEvents(50).some((event) => event.type === "archived" && event.email === "gone@cpm2.gg"));
  });

  it("404s on unknown accounts", () => {
    assert.throws(() => updateAccount(9999, { cash: 1 }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 404);
      return true;
    });
  });
});

describe("car slots", () => {
  it("spends 100 coins for the 21st slot and grows the garage", () => {
    const account = createAccount({ ...valid, email: "buy@cpm2.gg", coins: 1_000, slots: 0, cars: 20 });
    const updated = purchaseSlots(account.id, { count: 1 });
    assert.equal(updated.slots, 1);
    assert.equal(updated.coins, 900);
    assert.equal(updated.capacity, 21);
  });

  it("refuses when the balance is too low", () => {
    const account = createAccount({ ...valid, email: "poor@cpm2.gg", coins: 99, slots: 0 });
    assert.throws(() => purchaseSlots(account.id, { count: 1 }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "INSUFFICIENT_COINS");
      return true;
    });
  });

  it("refuses when the slot ceiling would be passed", () => {
    const account = createAccount({ ...valid, email: "maxed@cpm2.gg", coins: 30_000, slots: 1 });
    assert.throws(() => purchaseSlots(account.id, { count: 1 }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "SLOT_LIMIT_REACHED");
      return true;
    });
  });

  it("sells exactly one coin slot — the 21st", () => {
    const account = createAccount({ ...valid, email: "toomany@cpm2.gg", coins: 30_000, slots: 0 });
    const updated = purchaseSlots(account.id, { count: 1 });
    assert.equal(updated.slots, 1);
    assert.equal(updated.capacity, 21);
  });

  it("never lets the stored balance go negative", () => {
    const account = createAccount({ ...valid, email: "atomic@cpm2.gg", coins: 100, slots: 0 });
    purchaseSlots(account.id, { count: 1 });
    const after = listAccounts().find((item) => item.id === account.id);
    assert.equal(after?.coins, 0);
  });

  it("refuses to sell a slot to a CPM1 account", () => {
    const account = createAccount({
      ...valid,
      email: "cpm1-slot@cpm2.gg",
      game: "cpm1",
      cars: 0,
      slots: 0,
    });
    assert.throws(() => purchaseSlots(account.id, { count: 1 }), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "CPM1_HAS_NO_SLOTS");
      return true;
    });
  });
});

describe("custom garage size", () => {
  it("stores a per-account base garage size and derives capacity", () => {
    const account = createAccount({
      ...valid,
      email: "garage@cpm2.gg",
      cars: 120,
      baseSlots: 120,
      slots: 0,
    });
    assert.equal(account.baseSlots, 120);
    assert.equal(account.capacity, 120);
  });

  it("adds purchased slots on top of the custom base", () => {
    const account = createAccount({
      ...valid,
      email: "garage-plus@cpm2.gg",
      cars: 0,
      baseSlots: 120,
      slots: 1,
    });
    assert.equal(account.capacity, 121);
  });

  it("rejects a base garage above the sanity cap", () => {
    assert.throws(
      () => createAccount({ ...valid, email: "garage-max@cpm2.gg", baseSlots: 1000 }),
      /Base slots cannot exceed 999/,
    );
  });

  it("rejects shrinking the base below the stored cars", () => {
    const account = createAccount({
      ...valid,
      email: "garage-shrink@cpm2.gg",
      cars: 40,
      baseSlots: 50,
      slots: 0,
    });
    assert.throws(
      () => updateAccount(account.id, { baseSlots: 39 }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.code, "CAR_CAPACITY_EXCEEDED");
        return true;
      },
    );
  });

  it("tracks the base garage change in the event log", () => {
    const account = createAccount({ ...valid, email: "garage-log@cpm2.gg", cars: 10 });
    updateAccount(account.id, { baseSlots: 40 });
    const event = listEvents(50).find(
      (item) => item.email === "garage-log@cpm2.gg" && item.type === "updated",
    );
    assert.ok(event);
    assert.deepEqual(event.changes.baseSlots, { from: 20, to: 40 });
  });
});

describe("schema migration", () => {
  it("rebuilds the legacy 20+slots CHECK and keeps every row", () => {
    const legacyPath = path.join(tmp, "legacy.db");
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
        archived INTEGER NOT NULL DEFAULT 0,
        coins_spent_on_cars INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (cars >= 0 AND cars <= 20 + slots),
        CHECK (slots >= 0 AND slots <= 15)
      );
      INSERT INTO accounts (email, password_enc, cash, coins, cars, slots, created_at, updated_at)
      VALUES ('legacy@cpm2.gg', 'x', 10, 20, 3, 1, 'now', 'now');
    `);
    legacy.close();

    const db = createDatabase(legacyPath);
    try {
      const columns = db.prepare(`PRAGMA table_info(accounts)`).all() as { name: string }[];
      assert.equal(columns.some((column) => column.name === "base_slots"), true);
      assert.equal(columns.some((column) => column.name === "new_garage"), true);

      const row = db
        .prepare(`SELECT email, cars, slots, base_slots, new_garage FROM accounts WHERE email = 'legacy@cpm2.gg'`)
        .get() as { email: string; cars: number; slots: number; base_slots: number; new_garage: number };
      assert.deepEqual(
        { ...row },
        { email: "legacy@cpm2.gg", cars: 3, slots: 1, base_slots: 20, new_garage: 0 },
      );

      db.prepare(
        `INSERT INTO accounts (email, password_enc, cars, base_slots, slots, created_at, updated_at)
         VALUES ('roomy@cpm2.gg', 'x', 40, 50, 0, 'now', 'now')`,
      ).run();
      const roomy = db
        .prepare(`SELECT cars, base_slots FROM accounts WHERE email = 'roomy@cpm2.gg'`)
        .get() as { cars: number; base_slots: number };
      assert.deepEqual(roomy, { cars: 40, base_slots: 50 });
    } finally {
      db.close();
    }
  });

  it("drops the slots a legacy CPM1 row carried — CPM1 has no slots", () => {
    const legacyPath = path.join(tmp, "legacy-cpm1.db");
    const legacy = new Database(legacyPath);
    legacy.exec(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        password_enc TEXT NOT NULL,
        cash INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 0,
        cars INTEGER NOT NULL DEFAULT 0,
        base_slots INTEGER NOT NULL DEFAULT 20,
        slots INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0,
        coins_spent_on_cars INTEGER NOT NULL DEFAULT 0,
        game TEXT NOT NULL DEFAULT 'cpm2',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (cars >= 0 AND cars <= base_slots + slots)
      );
      INSERT INTO accounts (email, password_enc, game, cars, base_slots, slots, created_at, updated_at)
      VALUES ('old-cpm1@cpm2.gg', 'x', 'cpm1', 0, 20, 1, 'now', 'now');
    `);
    legacy.close();

    const db = createDatabase(legacyPath);
    try {
      const row = db
        .prepare(`SELECT base_slots, slots FROM accounts WHERE email = 'old-cpm1@cpm2.gg'`)
        .get() as { base_slots: number; slots: number };
      assert.deepEqual(row, { base_slots: 0, slots: 0 });
    } finally {
      db.close();
    }
  });

  it("keeps the garage rows and their foreign key through the rebuild", () => {
    const legacyPath = path.join(tmp, "legacy-fk.db");
    const legacy = new Database(legacyPath);
    legacy.exec(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        password_enc TEXT NOT NULL,
        cash INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 0,
        cars INTEGER NOT NULL DEFAULT 0,
        base_slots INTEGER NOT NULL DEFAULT 20,
        slots INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0,
        coins_spent_on_cars INTEGER NOT NULL DEFAULT 0,
        game TEXT NOT NULL DEFAULT 'cpm2',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (cars >= 0 AND cars <= base_slots + slots)
      );
      INSERT INTO accounts (email, password_enc, cars, base_slots, slots, created_at, updated_at)
      VALUES ('with-cars@cpm2.gg', 'x', 2, 20, 0, 'now', 'now');

      CREATE TABLE account_cars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        car_code INTEGER NOT NULL,
        game TEXT NOT NULL DEFAULT 'cpm2',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      INSERT INTO account_cars (account_id, car_code, game, notes, created_at)
      VALUES (1, 49, 'cpm2', 'weekend', 'now');
    `);
    legacy.close();

    const db = createDatabase(legacyPath);
    try {
      const garageSql = db
        .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'account_cars'`)
        .get() as { sql: string };
      assert.match(
        garageSql.sql,
        /REFERENCES\s+accounts\(id\)/i,
        "the garage must still point at the accounts table after the rebuild",
      );

      const cars = db.prepare(`SELECT car_code, notes FROM account_cars`).all() as {
        car_code: number;
        notes: string;
      }[];
      assert.deepEqual(cars, [{ car_code: 49, notes: "weekend" }]);
    } finally {
      db.close();
    }
  });
});

describe("encryption", () => {
  it("never stores the password in plain text", () => {
    const account = createAccount({ ...valid, email: "secret@cpm2.gg", password: "hunter2" });
    const raw = fs.readFileSync(process.env.CPM2_DB_PATH as string, "utf8");
    assert.equal(raw.includes("hunter2"), false);
    assert.equal(revealPassword(account.id).password, "hunter2");
  });

  it("fails loudly when the key changes", () => {
    const payload = encryptSecret("hunter2");
    assert.equal(decryptSecret(payload), "hunter2");
    resetKeyCache();
    process.env.CPM2_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    assert.throws(() => decryptSecret(payload), /could not be decrypted/);
    delete process.env.CPM2_ENCRYPTION_KEY;
    resetKeyCache();
  });
});

describe("stats + export", () => {
  it("aggregates the fleet", () => {
    const stats = fleetStats();
    assert.ok(stats.accounts > 0);
    assert.ok(stats.totalCash > 0);
    assert.equal(stats.totalSlots, listAccounts().reduce((sum, item) => sum + item.slots, 0));
  });

  it("exports csv with decrypted passwords", () => {
    const csv = exportFleet("csv", { confirmed: true });
    assert.equal(csv.contentType.includes("text/csv"), true);
    assert.equal(csv.body.split("\n")[0].includes("password"), true);
    assert.equal(csv.body.split("\n")[0].includes("base_slots"), true);
  });

  it("exports json", () => {
    const json = exportFleet("json", { confirmed: true });
    const parsed = JSON.parse(json.body);
    assert.equal(parsed.count, listAccounts().length);
    assert.ok(Array.isArray(parsed.accounts));
  });
});
