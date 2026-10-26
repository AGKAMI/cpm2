import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-owners-"));
process.env.CPM2_DB_PATH = path.join(tmp, "fleet.db");
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");

const {
  createAccount,
  archiveAccount,
  addGarageCar,
  carOwners,
} = await import("../src/lib/service.ts");
const { closeDb } = await import("../src/lib/db.ts");
const { ApiError } = await import("../src/lib/api.ts");

after(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function hasCode(fn: () => unknown, code: string) {
  assert.throws(fn, (err: unknown) => err instanceof ApiError && err.code === code);
}

/** An account of a given game with room in its garage. */
function account(email: string, game: "cpm1" | "cpm2", baseSlots = 5) {
  return createAccount({ email, password: "pw", game, cash: 0, coins: 0, cars: 0, baseSlots, slots: 0 });
}

/**
 * Every test parks a DIFFERENT code and asserts only on its own account.
 *
 * Tests in this file share one temp database, so an assertion over the whole
 * owner list would break the moment an earlier test parked the same code.
 * Asserting "my account is here with count N" states the same guarantee and
 * stays true no matter what ran before it.
 */
describe("car ownership lookup", () => {
  it("names the account that holds a code, with the code's resolved car name", () => {
    const one = account("owner-1@cpm2.gg", "cpm2");
    addGarageCar(one.id, { carCode: 49 });

    const result = carOwners("cpm2", 49);
    assert.equal(result.carCode, 49);
    assert.equal(result.carName, "TOYOTA SUPRA A80 (MK4)");
    assert.equal(result.game, "cpm2");

    const mine = result.owners.find((owner) => owner.accountId === one.id);
    assert.ok(mine, "the account that parked the car is listed");
    assert.equal(mine.email, "owner-1@cpm2.gg");
    assert.equal(mine.count, 1);
  });

  it("collapses duplicate models into ONE row with a count", () => {
    const one = account("dupes-owner@cpm2.gg", "cpm2");
    addGarageCar(one.id, { carCode: 40, notes: "track" });
    addGarageCar(one.id, { carCode: 40, notes: "street" });

    const result = carOwners("cpm2", 40);
    assert.equal(result.carName, "CHEVROLET CORVETTE (C7)");

    const mine = result.owners.filter((owner) => owner.accountId === one.id);
    assert.equal(mine.length, 1, "one row per account, not one row per car");
    assert.equal(mine[0]?.count, 2);
  });

  it("keeps a colliding code from leaking into the other game's owners", () => {
    // CPM2 #49 is a TOYOTA SUPRA A80; CPM1 #49 is a 2001 BMW M3 GTR.
    const holder = account("supra-holder@cpm2.gg", "cpm2");
    addGarageCar(holder.id, { carCode: 49 });

    const cpm1 = carOwners("cpm1", 49);
    assert.equal(cpm1.carName, "2001 BMW M3 GTR E46");
    assert.ok(
      !cpm1.owners.some((owner) => owner.accountId === holder.id),
      "a CPM2 Supra holder must never appear as a CPM1 owner",
    );

    const cpm2 = carOwners("cpm2", 49);
    assert.ok(
      cpm2.owners.some((owner) => owner.accountId === holder.id),
      "the same account IS a CPM2 owner",
    );
  });

  it("includes archived accounts, because they still own the car", () => {
    const one = account("archived-owner@cpm2.gg", "cpm2");
    addGarageCar(one.id, { carCode: 41 });
    archiveAccount(one.id);

    const result = carOwners("cpm2", 41);
    const mine = result.owners.find((owner) => owner.accountId === one.id);
    assert.ok(mine, "archiving does not hide real ownership");
    assert.equal(mine.email, "archived-owner@cpm2.gg");
  });

  it("resolves CPM2's code 0, a real car that a naive parser would drop", () => {
    const one = account("zero-owner@cpm2.gg", "cpm2");
    addGarageCar(one.id, { carCode: 0 });

    const result = carOwners("cpm2", 0);
    assert.equal(result.carName, "BMW 3 SERIES (E36)");
    assert.ok(result.owners.some((owner) => owner.accountId === one.id));
  });

  it("rejects a code the game does not have", () => {
    hasCode(() => carOwners("cpm2", 9999), "car_unknown");
  });
});
