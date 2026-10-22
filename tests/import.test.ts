import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-import-test-"));
process.env.CPM2_DB_PATH = path.join(tmp, "fleet.db");
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");

const { importAccounts, createAccount, archiveAccount, listAccounts, revealPassword, fleetStats } = await import(
  "../src/lib/service.ts"
);
const { ApiError } = await import("../src/lib/api.ts");
const { closeDb } = await import("../src/lib/db.ts");

after(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const goodRow = {
  email: "batch1@cpm2.gg",
  password: "pw-batch-1",
  cash: 1_000,
  coins: 500,
  cars: 3,
  slots: 0,
  notes: "imported",
};

describe("bulk import (json)", () => {
  it("creates every valid row and returns a per-row report", () => {
    const report = importAccounts(
      { accounts: [goodRow, { ...goodRow, email: "batch2@cpm2.gg", coins: 0 }] },
      "json",
    );
    assert.equal(report.total, 2);
    assert.equal(report.created, 2);
    assert.equal(report.skipped, 0);
    assert.equal(report.failed, 0);
    assert.deepEqual(
      report.results.map((row) => row.status),
      ["created", "created"],
    );
    // passwords are encrypted at rest and decryptable — import uses the same path as create
    const fleet = listAccounts();
    const first = fleet.find((account) => account.email === "batch1@cpm2.gg");
    assert.ok(first, "imported account is in the fleet");
  });

  it("accepts the fleet JSON export shape verbatim (exportedAt/count/accounts)", () => {
    const exported = {
      exportedAt: new Date().toISOString(),
      count: 1,
      accounts: [{ email: "roundtrip@cpm2.gg", password: "rt-secret", cash: 5, coins: 5, cars: 1, slots: 0, notes: "" }],
    };
    const report = importAccounts(exported, "json");
    assert.equal(report.created, 1);
    const imported = listAccounts().find((account) => account.email === "roundtrip@cpm2.gg");
    assert.ok(imported, "roundtrip account exists");
    assert.equal(revealPassword(imported.id).password, "rt-secret");
  });

  it("skips duplicate emails without poisoning the batch", () => {
    const report = importAccounts(
      { accounts: [{ email: "batch1@cpm2.gg", password: "x" }] },
      "json",
    );
    assert.equal(report.created, 0);
    assert.equal(report.skipped, 1);
    assert.equal(report.results[0]!.code, "EMAIL_TAKEN");
  });

  it("reports per-row validation failures and keeps creating the good rows", () => {
    const report = importAccounts(
      {
        accounts: [
          { email: "badcoins@cpm2.gg", password: "x", coins: 99_999 },
          { email: "good@cpm2.gg", password: "x" },
        ],
      },
      "json",
    );
    assert.equal(report.failed, 1);
    assert.equal(report.created, 1);
    const failedRow = report.results.find((row) => row.status === "failed");
    assert.equal(failedRow!.code, "VALIDATION_FAILED");
    assert.ok(failedRow!.fields?.coins);
  });

  it("rejects cars beyond the purchased-slot capacity of the row itself", () => {
    const report = importAccounts(
      { accounts: [{ email: "toomany@cpm2.gg", password: "x", cars: 25, slots: 0 }] },
      "json",
    );
    assert.equal(report.created, 0);
    assert.equal(report.failed, 1);
    assert.ok(report.results[0]!.fields?.cars?.includes("Cars cannot exceed"));
  });

  it("rejects a batch over MAX_IMPORT_ROWS", async () => {
    const { LIMITS } = await import("../src/lib/constants.ts");
    const tooMany = Array.from({ length: LIMITS.MAX_IMPORT_ROWS + 1 }, (_, index) => ({
      email: `overflow${index}@cpm2.gg`,
      password: "x",
    }));
    assert.throws(() => importAccounts({ accounts: tooMany }, "json"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "IMPORT_TOO_LARGE");
      return true;
    });
  });

  it("rejects a payload with no accounts array", () => {
    assert.throws(() => importAccounts({ nope: true }, "json"), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, "IMPORT_PAYLOAD_INVALID");
      return true;
    });
  });

  it("does not count imported slots as paid slots (import is a ledger restore, not a purchase)", () => {
    // importing an account that already owns slots must NOT charge coins —
    // a restore replays history, it does not re-buy it
    const before = fleetStats().coinsLockedInSlots;
    const report = importAccounts(
      { accounts: [{ email: "slotted@cpm2.gg", password: "x", coins: 1_000, slots: 3 }] },
      "json",
    );
    assert.equal(report.created, 1);
    assert.equal(fleetStats().coinsLockedInSlots, before + 300);
    const imported = listAccounts().find((a) => a.email === "slotted@cpm2.gg");
    assert.equal(imported!.coins, 1_000, "coins untouched by import");
  });
});

describe("bulk import (csv)", () => {
  it("imports the base_slots column from a CSV export", () => {
    const csv = [
      "id,email,password,cash,coins,cars,base_slots,slots,capacity,notes,created_at,updated_at",
      ',"roomy-csv@cpm2.gg","p",0,0,40,50,0,50,,',
    ].join("\n");
    const report = importAccounts(csv, "csv");
    assert.equal(report.created, 1);
    const imported = listAccounts().find((account) => account.email === "roomy-csv@cpm2.gg");
    assert.equal(imported?.baseSlots, 50);
    assert.equal(imported?.capacity, 50);
  });

  it("parses a raw CSV body with quoted notes", () => {
    const csv = [
      "id,email,password,cash,coins,cars,slots,capacity,notes,created_at,updated_at",
      ',"csv1@cpm2.gg","csvpass",100,50,2,0,20,"hello, world",,',
    ].join("\n");
    const report = importAccounts(csv, "csv");
    assert.equal(report.created, 1);
    const imported = listAccounts().find((a) => a.email === "csv1@cpm2.gg");
    assert.equal(imported!.cars, 2);
  });

  it("rejects a CSV row with an invalid value and keeps the rest", () => {
    const csv = [
      "id,email,password,cash,coins,cars,slots,capacity,notes,created_at,updated_at",
      ',"csvok@cpm2.gg","p",0,0,0,0,20,,',
      ',"csvbad@cpm2.gg","p",-50,0,0,0,20,,',
    ].join("\n");
    const report = importAccounts(csv, "csv");
    assert.equal(report.created, 1);
    assert.equal(report.failed, 1);
  });
});

describe("bulk import (archived duplicates)", () => {
  it("flags an archived duplicate as skipped instead of creating a ghost copy", async () => {
    await createAccount({ email: "archived@cpm2.gg", password: "x" });
    await archiveAccount(listAccounts().find((a) => a.email === "archived@cpm2.gg")!.id);
    const report = importAccounts({ accounts: [{ email: "archived@cpm2.gg", password: "y" }] }, "json");
    assert.equal(report.created, 0);
    assert.equal(report.skipped, 1);
    const firstRow = report.results[0];
    assert.ok(firstRow?.message?.includes("archived"));
  });
});
