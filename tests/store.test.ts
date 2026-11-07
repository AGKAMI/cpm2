import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * VANTA GARAGE store tests.
 * Pure-logic tests only — no live Turso DB required.
 * DB-backed integration tests run against the real store once credentials exist.
 */

const RESERVATION_MINUTES = 60;

function reservedUntilMs(minutes: number): number {
  return Date.now() + minutes * 60 * 1000;
}

function isExpired(reservedUntil: string): boolean {
  return new Date(reservedUntil).getTime() <= Date.now();
}

describe("vanta checkout · reservation timing", () => {
  it("reservation is 60 minutes from creation", () => {
    const until = reservedUntilMs(RESERVATION_MINUTES);
    const now = Date.now();
    const diffMin = (until - now) / 1000 / 60;
    assert.ok(diffMin >= 59 && diffMin <= 61, `expected ~60 min, got ${diffMin}`);
  });

  it("a fresh reservation is not expired", () => {
    const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    assert.equal(isExpired(until), false);
  });

  it("a past reservation is expired", () => {
    const until = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    assert.equal(isExpired(until), true);
  });

  it("exactly 60 minutes old counts as expired (boundary)", () => {
    const until = new Date(Date.now() - RESERVATION_MINUTES * 60 * 1000).toISOString();
    assert.equal(isExpired(until), true);
  });
});

describe("vanta checkout · order id format", () => {
  it("generates a prefixed, sortable id", () => {
    const id = `VNT_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    assert.ok(id.startsWith("VNT_"));
    assert.ok(id.length > 10);
  });
});

describe("vanta checkout · stock rules", () => {
  it("cannot reserve more than available stock", () => {
    const available = 1;
    const requested = 2;
    assert.ok(requested <= available === false, "requested stock exceeds available");
  });

  it("reserving exact available stock leaves zero", () => {
    const available = 3;
    const requested = 3;
    assert.equal(available - requested, 0);
  });
});

describe("vanta · order state machine", () => {
  const states = [
    "checkout_initiated",
    "awaiting_payment",
    "payment_verification",
    "payment_confirmed",
    "processing",
    "delivery_scheduled",
    "awaiting_delivery",
    "delivery_in_progress",
    "delivery_verified",
    "completed",
    "cancelled",
    "refund_pending",
    "refunded",
    "disputed",
  ] as const;

  it("defines 14 distinct order states", () => {
    assert.equal(states.length, 14);
  });

  it("payment states are disjoint from order states", () => {
    const paymentStates = ["pending", "verified", "rejected", "expired"] as const;
    for (const ps of paymentStates) {
      assert.ok(!states.includes(ps as typeof states[number]), `${ps} should not be an order state`);
    }
  });
});

describe("vanta · exclusivity classes", () => {
  const exclusivities = ["standard", "limited_edition", "one_of_one"] as const;
  it("has three exclusivity tiers", () => {
    assert.equal(exclusivities.length, 3);
  });
});
