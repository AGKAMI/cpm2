import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-ledger-test-"));
process.env.CPM2_DB_PATH = path.join(tmp, "fleet.db");
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");

const { createAccount, updateAccount, listAccounts, importAccounts, fleetStats } = await import(
  "../src/lib/service.ts"
);
const { closeDb } = await import("../src/lib/db.ts");

after(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("car-purchase ledger (coins_spent_on_cars)", () => {
  it("defaults to 0 on create and round-trips through summary", () => {
    const account = createAccount({ email: "ledger1@cpm2.gg", password: "x", coins: 5_000 });
    assert.equal(account.coinsSpentOnCars, 0);
  });

  it("accepts an explicit ledger value on create", () => {
    const account = createAccount({
      email: "ledger2@cpm2.gg",
      password: "x",
      coins: 1_000,
      coinsSpentOnCars: 450,
    });
    assert.equal(account.coinsSpentOnCars, 450);
  });

  it("updates via PATCH and shows in the tracked-changes event", async () => {
    const { listEvents } = await import("../src/lib/service.ts");
    const fleet = listAccounts();
    const target = fleet.find((a) => a.email === "ledger1@cpm2.gg")!;
    const updated = updateAccount(target.id, { coinsSpentOnCars: 1_200 });
    assert.equal(updated.coinsSpentOnCars, 1_200);
    const event = listEvents(10).find((e) => e.accountId === target.id);
    assert.ok(event, "update event logged");
    assert.ok("coinsSpentOnCars" in event.changes, "ledger change is tracked in the event log");
  });

  it("rejects a negative ledger value", async () => {
    const { ApiError } = await import("../src/lib/api.ts");
    assert.throws(
      () => createAccount({ email: "ledger3@cpm2.gg", password: "x", coinsSpentOnCars: -5 }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError || (err as { name?: string }).name === "ZodError");
        return true;
      },
    );
  });

  it("aggregates into fleetStats.totalCoinsSpentOnCars", () => {
    const stats = fleetStats();
    assert.equal(stats.totalCoinsSpentOnCars, 1_200 + 450);
  });

  it("imports the CSV export header coins_spent_on_cars (snake_case alias)", () => {
    const csv = [
      "id,email,password,cash,coins,cars,slots,capacity,coins_spent_on_cars,notes,created_at,updated_at",
      ',"ledger-imp@cpm2.gg","p",100,600,3,0,20,300,,',
    ].join("\n");
    const report = importAccounts(csv, "csv");
    assert.equal(report.created, 1);
    const imported = listAccounts().find((a) => a.email === "ledger-imp@cpm2.gg");
    assert.equal(imported!.coinsSpentOnCars, 300, "snake_case ledger value imported");
  });

  it("imports the JSON export field coinsSpentOnCars (camelCase)", () => {
    const report = importAccounts(
      { accounts: [{ email: "ledger-imp2@cpm2.gg", password: "p", coinsSpentOnCars: 77 }] },
      "json",
    );
    assert.equal(report.created, 1);
    const imported = listAccounts().find((a) => a.email === "ledger-imp2@cpm2.gg");
    assert.equal(imported!.coinsSpentOnCars, 77);
  });
});
