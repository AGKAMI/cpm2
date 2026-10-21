import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-trophies-"));
process.env.CPM2_DB_PATH = path.join(tmp, "fleet.db");
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");

const {
  createAccount,
  listTrophies,
  setTrophies,
  trophySummary,
  fleetTrophySummary,
  listEvents,
} = await import("../src/lib/service.ts");
const { closeDb } = await import("../src/lib/db.ts");
const { TROPHY_CLASSES } = await import("../src/lib/constants.ts");

after(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeAccount(email: string) {
  return createAccount({ email, password: "pw", cash: 0, coins: 0, cars: 0, slots: 0 });
}

describe("trophies · drag race classes", () => {
  it("lists every class for a fresh account, all at zero", () => {
    const account = makeAccount("fresh@cpm2.gg");
    const rows = listTrophies(account.id);
    assert.equal(rows.length, TROPHY_CLASSES.length);
    assert.deepEqual(
      rows.map((row) => row.class),
      [...TROPHY_CLASSES],
    );
    for (const row of rows) {
      assert.equal(row.gold, 0);
      assert.equal(row.silver, 0);
      assert.equal(row.bronze, 0);
      assert.equal(row.total, 0);
    }
  });

  it("stores gold, silver and bronze counts per class", () => {
    const account = makeAccount("winner@cpm2.gg");
    const record = setTrophies(account.id, { class: "S10", gold: 2, silver: 1, bronze: 0 });
    assert.equal(record.class, "S10");
    assert.equal(record.gold, 2);
    assert.equal(record.silver, 1);
    assert.equal(record.total, 3);

    const rows = listTrophies(account.id);
    const s10 = rows.find((row) => row.class === "S10");
    assert.equal(s10?.gold, 2);
    assert.equal(s10?.silver, 1);
    assert.equal(s10?.bronze, 0);
    // untouched classes stay empty
    assert.equal(rows.find((row) => row.class === "U")?.total, 0);
  });

  it("overwrites a class instead of duplicating it", () => {
    const account = makeAccount("twice@cpm2.gg");
    setTrophies(account.id, { class: "U", gold: 1, silver: 0, bronze: 0 });
    setTrophies(account.id, { class: "U", gold: 4, silver: 2, bronze: 1 });
    const rows = listTrophies(account.id);
    const unlimited = rows.filter((row) => row.class === "U");
    assert.equal(unlimited.length, 1);
    assert.equal(unlimited[0]?.gold, 4);
    assert.equal(unlimited[0]?.total, 7);
  });

  it("summarises an account and the whole fleet", () => {
    const account = makeAccount("cabinet@cpm2.gg");
    setTrophies(account.id, { class: "U", gold: 1, silver: 2, bronze: 3 });
    setTrophies(account.id, { class: "S13", gold: 1, silver: 0, bronze: 0 });

    const summary = trophySummary(account.id);
    assert.equal(summary.gold, 2);
    assert.equal(summary.silver, 2);
    assert.equal(summary.bronze, 3);
    assert.equal(summary.total, 7);
    assert.equal(summary.byClass.length, TROPHY_CLASSES.length);

    const fleet = fleetTrophySummary();
    const mine = fleet.find((item) => item.accountId === account.id);
    assert.equal(mine?.total, 7);
  });

  it("writes an audit event only when the counts actually change", () => {
    const account = makeAccount("log@cpm2.gg");
    const before = listEvents().length;
    setTrophies(account.id, { class: "S11", gold: 1, silver: 0, bronze: 0 });
    const after = listEvents().length;
    assert.equal(after, before + 1);

    const event = listEvents()[0];
    assert.equal(event.type, "trophies_updated");
    assert.equal(event.accountId, account.id);
    assert.deepEqual(event.changes.gold, { from: 0, to: 1 });

    // same numbers again -> no new event
    setTrophies(account.id, { class: "S11", gold: 1, silver: 0, bronze: 0 });
    assert.equal(listEvents().length, after);
  });

  it("rejects an unknown class, negative counts and fractions", () => {
    const account = makeAccount("bad@cpm2.gg");
    assert.throws(() => setTrophies(account.id, { class: "S7", gold: 1, silver: 0, bronze: 0 }));
    assert.throws(() => setTrophies(account.id, { class: "U", gold: -1, silver: 0, bronze: 0 }));
    assert.throws(() => setTrophies(account.id, { class: "U", gold: 1.5, silver: 0, bronze: 0 }));
  });

  it("refuses to touch an archived account", async () => {
    const account = makeAccount("archived@cpm2.gg");
    const { archiveAccount } = await import("../src/lib/service.ts");
    archiveAccount(account.id);
    assert.throws(() => setTrophies(account.id, { class: "U", gold: 1, silver: 0, bronze: 0 }));
    // reading is still allowed
    assert.equal(listTrophies(account.id).length, TROPHY_CLASSES.length);
  });
});
