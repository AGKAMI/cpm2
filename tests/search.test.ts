import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { searchCars, carsForGame } = await import("../src/lib/car-catalog.ts");

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

  it("finds the Defender in CPM2 (added 2026-10, code 230)", () => {
    const hits = searchCars("def", 30, "cpm2");
    assert.ok(hits.some((car) => car.code === 230 && car.name.includes("DEFENDER")));
  });

  it("never leaks a car from the other game", () => {
    // The Land Cruiser 80 is CPM1-only: a CPM2 search must not return it,
    // however flexible the matching gets.
    assert.ok(!searchCars("land cruiser 80", 30, "cpm2").some((car) => car.name.includes("80")));
    assert.ok(!carsForGame("cpm2").some((car) => car.name.includes("LAND CRUISER 80")));
  });
});
