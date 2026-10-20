import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-review-"));
process.env.CPM2_DB_PATH = path.join(tmp, "fleet.db");
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");

const {
  createAccount,
  updateAccount,
  archiveAccount,
  restoreAccount,
  purchaseSlots,
  listAccounts,
  listEvents,
  revealPassword,
  exportFleet,
  importAccounts,
} = await import("../src/lib/service.ts");
const { ApiError } = await import("../src/lib/api.ts");
const { closeDb } = await import("../src/lib/db.ts");
const { readJson, parseId } = await import("../src/lib/http.ts");

after(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function isApiError(err: unknown, code: string, status: number): boolean {
  assert.ok(err instanceof ApiError, `expected an ApiError, got ${String(err)}`);
  assert.equal(err.code, code);
  assert.equal(err.status, status);
  return true;
}

describe("review 1 · PATCH slot-economy bypass", () => {
  it("rejects the exact repro: PATCH {slots:15,cars:35} on an account with 0 coins", () => {
    const account = createAccount({
      email: "bypass@cpm2.gg",
      password: "pw",
      cash: 0,
      coins: 0,
      cars: 20,
      slots: 0,
    });

    assert.throws(
      () => updateAccount(account.id, { slots: 15, cars: 35 }),
      (err: unknown) => isApiError(err, "SLOTS_PURCHASE_ONLY", 422),
    );

    const stored = listAccounts().find((item) => item.id === account.id);
    assert.equal(stored?.slots, 0);
    assert.equal(stored?.cars, 20);
    assert.equal(stored?.coins, 0);
    assert.equal(stored?.capacity, 20);
  });

  it("rejects any slot increase through PATCH, even when the account can afford it", () => {
    const account = createAccount({
      email: "rich@cpm2.gg",
      password: "pw",
      coins: 30_000,
      cars: 20,
      slots: 0,
    });

    assert.throws(
      () => updateAccount(account.id, { slots: 1 }),
      (err: unknown) => isApiError(err, "SLOTS_PURCHASE_ONLY", 422),
    );
    assert.equal(listAccounts().find((item) => item.id === account.id)?.slots, 0);
  });

  it("allows a slot decrease and logs slots_removed without refunding coins", () => {
    const account = createAccount({
      email: "shrink@cpm2.gg",
      password: "pw",
      coins: 5_000,
      cars: 21,
      slots: 3,
    });

    const updated = updateAccount(account.id, { slots: 1 });
    assert.equal(updated.slots, 1);
    assert.equal(updated.coins, 5_000, "the game does not refund slot coins");
    assert.equal(updated.capacity, 21);

    const event = listEvents(80).find(
      (item) => item.email === "shrink@cpm2.gg" && item.type === "slots_removed",
    );
    assert.ok(event, "expected a slots_removed event");
    assert.deepEqual(event.changes.slots, { from: 3, to: 1 });
  });

  it("refuses a slot decrease that would not fit the cars", () => {
    const account = createAccount({
      email: "overfull@cpm2.gg",
      password: "pw",
      cars: 22,
      slots: 2,
    });

    assert.throws(
      () => updateAccount(account.id, { slots: 1 }),
      (err: unknown) => isApiError(err, "CAR_CAPACITY_EXCEEDED", 422),
    );
    assert.equal(listAccounts().find((item) => item.id === account.id)?.slots, 2);
  });

  it("still sells slots through the purchase endpoint", () => {
    const account = createAccount({
      email: "buyer@cpm2.gg",
      password: "pw",
      coins: 1_000,
      cars: 20,
      slots: 0,
    });

    const updated = purchaseSlots(account.id, { count: 2 });
    assert.equal(updated.slots, 2);
    assert.equal(updated.coins, 800);
    assert.equal(updated.capacity, 22);
  });

  it("rejects a purchase the account cannot afford (INSUFFICIENT_COINS)", () => {
    const account = createAccount({
      email: "broke@cpm2.gg",
      password: "pw",
      coins: 0,
      cars: 20,
      slots: 0,
    });

    assert.throws(
      () => purchaseSlots(account.id, { count: 1 }),
      (err: unknown) => isApiError(err, "INSUFFICIENT_COINS", 422),
    );
    assert.equal(listAccounts().find((item) => item.id === account.id)?.slots, 0);
  });
});

describe("review 2 · data/ is never committable", () => {
  it("gitignores the database and the encryption key", () => {
    const ignore = fs.readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");
    assert.match(ignore, /^\/data\s*$/m);
    assert.match(ignore, /secret-key|\/data/);
  });
});

describe("review 3 · export + reveal are gated and audited", () => {
  it("refuses to export without an explicit confirmation", () => {
    assert.throws(
      () => exportFleet("csv"),
      (err: unknown) => isApiError(err, "EXPORT_CONFIRMATION_REQUIRED", 400),
    );
    assert.equal(
      listEvents(200).some((event) => event.type === "export_performed"),
      false,
      "a refused export must not write an audit event",
    );
  });

  it("exports with confirmation and records an export_performed event", () => {
    createAccount({ email: "exported@cpm2.gg", password: "pw", cash: 10 });
    const result = exportFleet("csv", { confirmed: true });
    assert.match(result.body, /exported@cpm2\.gg/);
    assert.match(result.body, /password/);

    const event = listEvents(200).find((item) => item.type === "export_performed");
    assert.ok(event, "expected an export_performed event");
    assert.match(event.summary, /CSV/);
  });

  it("records a password_revealed event", () => {
    const account = createAccount({ email: "peeked@cpm2.gg", password: "secret" });
    revealPassword(account.id);
    const event = listEvents(200).find(
      (item) => item.type === "password_revealed" && item.email === "peeked@cpm2.gg",
    );
    assert.ok(event, "expected a password_revealed event");
  });
});

describe("review 4 · soft delete and bulk import", () => {
  it("archives instead of destroying an account", () => {
    const account = createAccount({
      email: "archivable@cpm2.gg",
      password: "pw",
      cash: 500_000,
      cars: 12,
    });

    archiveAccount(account.id);

    assert.equal(listAccounts().some((item) => item.id === account.id), false);
    assert.equal(
      listAccounts({ archived: "include" }).some((item) => item.id === account.id),
      true,
    );
    assert.equal(
      listAccounts({ archived: "only" }).some((item) => item.id === account.id),
      true,
      "the archived view only lists archived accounts",
    );
    assert.throws(
      () => updateAccount(account.id, { cash: 1 }),
      (err: unknown) => isApiError(err, "NOT_FOUND", 404),
    );
    assert.ok(
      listEvents(200).some((event) => event.type === "archived" && event.email === "archivable@cpm2.gg"),
    );
  });

  it("restores an archived account with its balances intact", () => {
    const account = createAccount({
      email: "returner@cpm2.gg",
      password: "pw",
      cash: 750_000,
      coins: 900,
      cars: 9,
    });
    archiveAccount(account.id);
    const restored = restoreAccount(account.id);

    assert.equal(restored.archived, false);
    assert.equal(restored.cash, 750_000);
    assert.equal(restored.cars, 9);
    assert.equal(listAccounts().some((item) => item.id === account.id), true);
  });

  it("imports JSON rows with the same validation as a manual create", () => {
    const report = importAccounts(
      [
        { email: "imp1@cpm2.gg", password: "pw", cash: 1000, coins: 100, cars: 2 },
        { email: "imp2@cpm2.gg", password: "pw", cash: 99_999_999 },
        { email: "not-an-email", password: "pw" },
        { email: "imp1@cpm2.gg", password: "pw" },
      ],
      "json",
    );

    assert.equal(report.total, 4);
    assert.equal(report.created, 1);
    assert.equal(report.failed, 2);
    assert.equal(report.skipped, 1);
    assert.equal(report.results[0].status, "created");
    assert.equal(report.results[1].code, "VALIDATION_FAILED");
    assert.equal(report.results[1].fields?.cash, "Cash cannot exceed 50,000,000.");
    assert.equal(report.results[2].fields?.email, "Enter a valid email address.");
    assert.equal(report.results[3].code, "EMAIL_TAKEN");
    assert.equal(listAccounts().some((item) => item.email === "imp1@cpm2.gg"), true);
  });

  it("imports a CSV payload through the same validation", () => {
    const csv = [
      "email,password,cash,coins,cars,slots",
      "csv1@cpm2.gg,secret,250000,500,10,1",
      "csv2@cpm2.gg,secret,99999999,0,0,0",
    ].join("\n");

    const report = importAccounts(csv, "csv");
    assert.equal(report.total, 2);
    assert.equal(report.created, 1);
    assert.equal(report.failed, 1);

    const account = listAccounts().find((item) => item.email === "csv1@cpm2.gg");
    assert.equal(account?.cash, 250_000);
    assert.equal(account?.coins, 500);
    assert.equal(account?.slots, 1);
  });

  it("rejects an import payload it cannot understand", () => {
    assert.throws(
      () => importAccounts("not-a-list", "json"),
      (err: unknown) => isApiError(err, "IMPORT_PAYLOAD_INVALID", 400),
    );
  });
});

describe("review · request hardening", () => {
  it("rejects a malformed JSON body with INVALID_JSON", async () => {
    const request = new Request("http://localhost/api/accounts", {
      method: "POST",
      body: "{not json",
    });
    await assert.rejects(readJson(request), (err: unknown) =>
      isApiError(err, "INVALID_JSON", 400),
    );
  });

  it("rejects a non-numeric account id", () => {
    assert.throws(() => parseId("abc"), (err: unknown) => isApiError(err, "INVALID_ID", 400));
    assert.throws(() => parseId("-1"), (err: unknown) => isApiError(err, "INVALID_ID", 400));
  });

  it("binds the dev and start servers to 127.0.0.1", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.match(pkg.scripts.dev, /-H\s+127\.0\.0\.1/);
    assert.match(pkg.scripts.start, /-H\s+127\.0\.0\.1/);
  });
});
