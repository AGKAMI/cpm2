import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { garageCapacity, hasCarSlots, allowsDuplicateModels } = await import(
  "../src/lib/garage.ts"
);

describe("garage · capacity", () => {
  it("CPM1 capacity equals the full catalog size (no slots)", () => {
    const cap = garageCapacity("cpm1", { baseSlots: 0, slots: 0, newGarage: false });
    assert.equal(cap, 207);
  });

  it("CPM2 default capacity is 20 base slots", () => {
    const cap = garageCapacity("cpm2", { baseSlots: 20, slots: 0, newGarage: false });
    assert.equal(cap, 20);
  });

  it("CPM2 with coin slot adds 1 (21 total)", () => {
    const cap = garageCapacity("cpm2", { baseSlots: 20, slots: 1, newGarage: false });
    assert.equal(cap, 21);
  });

  it("CPM2 with new garage adds 15 more (36 total)", () => {
    const cap = garageCapacity("cpm2", { baseSlots: 20, slots: 1, newGarage: true });
    assert.equal(cap, 36);
  });

  it("CPM2 with base slots only, no coin slot, no new garage", () => {
    const cap = garageCapacity("cpm2", { baseSlots: 15, slots: 0, newGarage: false });
    assert.equal(cap, 15);
  });

  it("negative slots clamp to zero", () => {
    const cap = garageCapacity("cpm2", { baseSlots: -5, slots: -1, newGarage: false });
    assert.equal(cap, 0);
  });
});

describe("garage · rules", () => {
  it("CPM1 has no car slots", () => {
    assert.equal(hasCarSlots("cpm1"), false);
  });

  it("CPM2 has car slots", () => {
    assert.equal(hasCarSlots("cpm2"), true);
  });

  it("CPM1 does not allow duplicate models", () => {
    assert.equal(allowsDuplicateModels("cpm1"), false);
  });

  it("CPM2 allows duplicate models", () => {
    assert.equal(allowsDuplicateModels("cpm2"), true);
  });
});
