import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { searchCars, carsForGame, carByCode } = await import("../src/lib/car-catalog.ts");

describe("flexible catalog search", () => {
  it("matches an abbreviation of any word in the name", () => {
    // "def" must surface the Defender — the complaint that started this.
    const hits = searchCars("def", 30, "cpm1");
    assert.ok(hits.some((car) => car.name === "LAND ROVER DEFENDER"));
  });

  it("matches several abbreviations at once", () => {
    const hits = searchCars("must i", 30, "cpm2");
    assert.ok(hits.some((car) => car.code === 181 && car.name === "FORD MUSTANG I FASTBACK (1964)"));
  });

  it("survives a typo via near-match", () => {
    const hits = searchCars("defemder", 30, "cpm1");
    assert.ok(hits.some((car) => car.name === "LAND ROVER DEFENDER"));
  });

  it("keeps plain substring and code-prefix behaviour", () => {
    assert.ok(searchCars("land cruiser", 30, "cpm2").some((car) => car.code === 121));
    assert.ok(searchCars("12", 30, "cpm2").some((car) => car.code === 121));
    const exact = searchCars("HONDA CIVIC", 30, "cpm2");
    assert.ok(exact.some((car) => car.code === 13));
    // Exact substring hits rank above looser token matches.
    assert.equal(exact[0]!.code, 13);
  });

  it("never leaks a car from the other game", () => {
    // The Land Cruiser 80 is CPM1-only: a CPM2 search must not return it,
    // however flexible the matching gets.
    assert.ok(!searchCars("land cruiser 80", 30, "cpm2").some((car) => car.name.includes("80")));
    assert.ok(!carsForGame("cpm2").some((car) => car.name.includes("LAND CRUISER 80")));
  });
});

describe("car catalog · carByCode", () => {
  it("resolves a CPM2 car by code", () => {
    const car = carByCode(49, "cpm2");
    assert.equal(car?.code, 49);
    assert.equal(car?.game, "cpm2");
    assert.ok(car?.name.includes("SUPRA"));
  });

  it("resolves a CPM1 car by code", () => {
    const car = carByCode(1, "cpm1");
    assert.equal(car?.code, 1);
    assert.equal(car?.game, "cpm1");
    assert.equal(car?.name, "HONDA CIVIC EK9");
  });

  it("returns undefined for a missing code", () => {
    assert.equal(carByCode(99999, "cpm2"), undefined);
    assert.equal(carByCode(99999, "cpm1"), undefined);
  });

  it("codes are not unique across games — same code resolves differently", () => {
    // #13 is a 2007 PEUGEOT 308 in CPM1 and a HONDA CIVIC in CPM2.
    const cpm1 = carByCode(13, "cpm1");
    const cpm2 = carByCode(13, "cpm2");
    assert.ok(cpm1 && cpm2);
    assert.notEqual(cpm1.name, cpm2.name);
    assert.equal(cpm1.game, "cpm1");
    assert.equal(cpm2.game, "cpm2");
  });

  it("uses the game discriminator — same code is a different car per game", () => {
    // #49 is TOYOTA SUPRA A80 (MK4) in CPM2 but 2001 BMW M3 GTR E46 in CPM1.
    const cpm1 = carByCode(49, "cpm1");
    const cpm2 = carByCode(49, "cpm2");
    assert.ok(cpm1 && cpm2);
    assert.notEqual(cpm1.name, cpm2.name);
    assert.equal(cpm1.game, "cpm1");
    assert.equal(cpm2.game, "cpm2");
    assert.ok(cpm1.name.includes("BMW M3"));
    assert.ok(cpm2.name.includes("SUPRA"));
  });
});
