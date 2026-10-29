import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-trade-"));
process.env.CPM2_DB_PATH = path.join(tmp, "fleet.db");
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");

const { carValueRands, cashValueRands, tradeVerdict, matchCarName } = await import(
  "../src/lib/trade.ts"
);
const {
  getTradeRates,
  setTradeRates,
  listTradePrices,
  setTradePrice,
  deleteTradePrice,
} = await import("../src/lib/trade-store.ts");
const { carsForGame } = await import("../src/lib/car-catalog.ts");
const { ApiError } = await import("../src/lib/api.ts");
const { closeDb } = await import("../src/lib/db.ts");

after(() => {
  closeDb();
});

describe("car valuation", () => {
  const rates = { randPerCoin: 0.03, randPerCash: 0.0000025 };

  it("values a paid car at its Rand price", () => {
    assert.equal(carValueRands("paid", 299.99, rates), 299.99);
  });

  it("values a coin car through the coins rate", () => {
    assert.equal(carValueRands("coin", 1000, rates), 30);
  });

  it("values a cash car through the cash rate", () => {
    // Float-tolerant: 25M × 0.0000025 lands a hair off 62.5 in IEEE doubles.
    assert.ok(Math.abs(carValueRands("cash", 25_000_000, rates) - 62.5) < 1e-9);
  });

  it("never returns a negative value", () => {
    assert.equal(carValueRands("paid", -5, rates), 0);
    assert.equal(carValueRands("coin", -100, rates), 0);
    assert.equal(cashValueRands(-1000, rates), 0);
  });

  it("values trade sweetener cash through the cash rate", () => {
    assert.equal(cashValueRands(4_000_000, rates), 10);
  });
});

describe("trade verdict", () => {
  it("calls a deal inside the 3% band fair", () => {
    assert.equal(tradeVerdict(1000, 980).status, "fair");
    assert.equal(tradeVerdict(0, 0).status, "fair");
  });

  it("calls getting more than you give a gain — the F90/2.5k bug", () => {
    // Give the 5k-coin car (≈R164.50), receive the 2.5k-coin one (≈R82.25):
    // that must be a LOSS, never "worth it in your favour".
    const robbed = tradeVerdict(164.5, 82.25);
    assert.equal(robbed.status, "loss");
    assert.ok(Math.abs(robbed.delta - -82.25) < 1e-9);

    // The mirror: receive more than you give → gain.
    const winning = tradeVerdict(900, 1100);
    assert.equal(winning.status, "gain");
    assert.equal(winning.delta, 200);
  });

  it("calls a deal beyond the band a loss, with the shortfall", () => {
    const verdict = tradeVerdict(1100, 900);
    assert.equal(verdict.status, "loss");
    assert.equal(verdict.delta, -200);
  });
});

describe("fuzzy car matcher", () => {
  it("scores an exact catalog name at the top", () => {
    const car = carsForGame("cpm2")[0]!;
    const matches = matchCarName(car.name, "cpm2", 5);
    assert.ok(matches.length > 0);
    assert.equal(matches[0]!.code, car.code);
    assert.ok(matches[0]!.score > 0.9);
  });

  it("matches a partial name by containment", () => {
    const car = carsForGame("cpm2").find((entry) => entry.name.trim().split(/\s+/).length >= 3);
    assert.ok(car, "expected a multi-word CPM2 car name");
    const words = car.name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/);
    const partial = words.slice(0, 2).join(" ");
    const matches = matchCarName(partial, "cpm2", 5);
    assert.ok(matches.some((match) => match.code === car.code));
  });

  it("never leaks another game's car for the same code", () => {
    // Code 13 is a Honda Civic in CPM2 and a Peugeot in CPM1 — a CPM2 query
    // scoped to CPM1 must not return the Civic.
    const civic = carsForGame("cpm2").find((entry) => entry.code === 13);
    if (civic && /CIVIC/i.test(civic.name)) {
      const matches = matchCarName(civic.name, "cpm1", 6);
      assert.ok(!matches.some((match) => match.code === 13));
    }
  });

  it("returns nothing for an empty or gibberish query", () => {
    assert.deepEqual(matchCarName("", "cpm2", 5), []);
    assert.deepEqual(matchCarName("zzzz qqqv xxxv", "cpm2", 5), []);
  });

  it("does not offer the wrong Golf generation for a Golf R screenshot", () => {
    // Gemini read "Volkswagen Golf R" (the CPM2 MK7 Golf R). The catalog has
    // no Golf MK7 / Golf R, so the closest entries (Golf MK2 GTI #157, Golf
    // MK6 GTI #113, Scirocco III #2) share only a prefix and must NOT be
    // offered — confirming them would price the wrong car.
    const matches = matchCarName("Volkswagen Golf R", "cpm2", 6);
    const codes = new Set(matches.map((match) => match.code));
    assert.ok(!codes.has(157), "Golf MK2 GTI must not be offered for a Golf R");
    assert.ok(!codes.has(113), "Golf MK6 GTI must not be offered for a Golf R");
    assert.ok(!codes.has(2), "Scirocco III must not be offered for a Golf R");
    // With no genuine match in the catalog, the list should be empty.
    assert.deepEqual(matches, []);
  });
});

describe("trade store", () => {
  it("round-trips the conversion rates", () => {
    assert.deepEqual(getTradeRates(), { randPerCoin: 0, randPerCash: 0 });
    setTradeRates({ randPerCoin: 0.0306, randPerCash: 0.0000025 });
    assert.deepEqual(getTradeRates(), { randPerCoin: 0.0306, randPerCash: 0.0000025 });
  });

  it("round-trips a price entry", () => {
    const car = carsForGame("cpm2")[0]!;
    const saved = setTradePrice("cpm2", car.code, "coin", 950);
    assert.equal(saved.carName, car.name);
    const listed = listTradePrices("cpm2");
    const entry = listed.find((price) => price.code === car.code);
    assert.ok(entry);
    assert.equal(entry!.kind, "coin");
    assert.equal(entry!.price, 950);
  });

  it("updates an existing entry in place", () => {
    const car = carsForGame("cpm2")[0]!;
    setTradePrice("cpm2", car.code, "paid", 149.99);
    const listed = listTradePrices("cpm2").filter((price) => price.code === car.code);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.kind, "paid");
    assert.equal(listed[0]!.price, 149.99);
  });

  it("rejects a code that is not a car in that game", () => {
    assert.throws(() => setTradePrice("cpm2", 99999, "paid", 10), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal((err as { code: string }).code, "TRADE_UNKNOWN_CAR");
      return true;
    });
  });

  it("deletes an entry", () => {
    const car = carsForGame("cpm2")[0]!;
    setTradePrice("cpm2", car.code, "paid", 10);
    assert.equal(deleteTradePrice("cpm2", car.code), true);
    assert.equal(deleteTradePrice("cpm2", car.code), false);
    assert.ok(!listTradePrices("cpm2").some((price) => price.code === car.code));
  });
});
