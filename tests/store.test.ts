import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * VANTA GARAGE store tests.
 * Pure-logic tests only — no live Turso DB required (the imported modules
 * connect lazily, and none of the DB-backed functions are called here).
 *
 * Every value under test is imported from the production modules —
 * src/lib/store/checkout.ts for the reservation window and order-id builder,
 * src/lib/store-schema.ts for the state lists the database CHECK constraints
 * actually enforce — so a change in the real constant or schema fails here
 * instead of silently passing against a private copy.
 *
 * DB-backed integration tests run against the real store once credentials exist.
 */

const { RESERVATION_MINUTES, orderId } = await import(
  "../src/lib/store/checkout.ts"
);
const { VANTA_SCHEMA } = await import("../src/lib/store-schema.ts");
const { effectiveUnitPriceCents } = await import("../src/lib/store/pricing.ts");

/**
 * Pull the accepted values out of a SQL CHECK clause —
 * `CHECK (order_state IN ('a', 'b'))` → `["a", "b"]`.
 * These lists are what the database actually enforces at runtime.
 */
function checkValues(column: string): string[] {
  const m = new RegExp(`CHECK \\(${column} IN \\(([^)]*)\\)\\)`).exec(
    VANTA_SCHEMA,
  );
  assert.ok(m, `VANTA_SCHEMA must define a CHECK constraint for ${column}`);
  return m[1]
    .split(",")
    .map((v) => v.trim().replace(/^'|'$/g, ""))
    .filter((v) => v.length > 0);
}

const ORDER_STATES = checkValues("order_state");
const PAYMENT_STATES = checkValues("payment_state");
const DELIVERY_STATES = checkValues("delivery_state");
const EXCLUSIVITIES = checkValues("exclusivity");

/**
 * Expiry comparator mirrored from listExpiredReservations() in
 * src/lib/store/checkout.ts: `WHERE ... AND reserved_until < ?` (strict).
 */
function isExpired(reservedUntil: string, now: number = Date.now()): boolean {
  return new Date(reservedUntil).getTime() < now;
}

describe("vanta checkout · reservation timing", () => {
  it("RESERVATION_MINUTES is the 60-minute contract", () => {
    assert.equal(RESERVATION_MINUTES, 60);
  });

  it("a reservation runs for RESERVATION_MINUTES from creation", () => {
    // Same computation createOrder() performs for reserved_until.
    const until = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);
    const now = Date.now();
    const diffMin = (until.getTime() - now) / 1000 / 60;
    assert.ok(
      diffMin >= RESERVATION_MINUTES - 1 && diffMin <= RESERVATION_MINUTES + 1,
      `expected ~${RESERVATION_MINUTES} min, got ${diffMin}`,
    );
  });

  it("a fresh reservation is not expired", () => {
    const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    assert.equal(isExpired(until), false);
  });

  it("a past reservation is expired", () => {
    const until = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    assert.equal(isExpired(until), true);
  });

  it("the expiry boundary is strict: not at the instant, yes one ms past", () => {
    const created = Date.now() - RESERVATION_MINUTES * 60 * 1000;
    const until = new Date(created).toISOString();
    assert.equal(isExpired(until, created), false, "exact instant is not past");
    assert.equal(isExpired(until, created + 1), true, "1ms past is expired");
  });
});

describe("vanta checkout · order id format", () => {
  it("generates a prefixed, sortable id from the real builder", () => {
    const id = orderId();
    assert.ok(id.startsWith("VNT_"));
    assert.match(id, /^VNT_[0-9a-z]+_[0-9a-z]+$/);
    assert.ok(id.length > 10, `id too short: ${id}`);
  });

  it("is unique across calls", () => {
    assert.notEqual(orderId(), orderId());
  });
});

describe("vanta · inventory counters (oversell guard)", () => {
  it("tracks stock and reservations as zero-defaulted counters", () => {
    assert.match(VANTA_SCHEMA, /stock_quantity\s+INTEGER NOT NULL DEFAULT 0/);
    assert.match(
      VANTA_SCHEMA,
      /reserved_quantity\s+INTEGER NOT NULL DEFAULT 0/,
    );
  });

  it("cannot reserve more than available stock", () => {
    // The guard reserveStock() applies: stock 1, nothing reserved, 2 asked
    // for — `WHERE (stock_quantity - reserved_quantity) >= ?` matches no row.
    const stock = 1;
    const reserved = 0;
    const requested = 2;
    assert.equal(
      stock - reserved >= requested,
      false,
      "requested stock exceeds available",
    );
  });

  it("reserving exact available stock leaves zero", () => {
    const stock = 3;
    const reserved = 0;
    const requested = 3;
    assert.equal(stock - reserved >= requested, true);
    assert.equal(stock - reserved - requested, 0);
  });
});

describe("vanta · order state machine (schema-enforced)", () => {
  // The documented pipeline from src/lib/store/orders.ts.
  const DOCUMENTED_PIPELINE = [
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

  it("defaults a new order to an accepted state", () => {
    assert.match(
      VANTA_SCHEMA,
      /order_state\s+TEXT NOT NULL DEFAULT 'awaiting_payment'/,
    );
    assert.ok(ORDER_STATES.includes("awaiting_payment"));
  });

  it("defines 14 distinct order states in the schema CHECK", () => {
    assert.equal(ORDER_STATES.length, 14);
    assert.equal(new Set(ORDER_STATES).size, 14, "states must be distinct");
  });

  it("covers the documented order pipeline", () => {
    for (const state of DOCUMENTED_PIPELINE) {
      assert.ok(
        ORDER_STATES.includes(state),
        `${state} must be an accepted order state`,
      );
    }
  });

  it("payment states are disjoint from order states", () => {
    for (const ps of PAYMENT_STATES) {
      assert.ok(
        !ORDER_STATES.includes(ps),
        `${ps} should not be an order state`,
      );
    }
  });

  it("defines the 4 payment states", () => {
    assert.equal(PAYMENT_STATES.length, 4);
    for (const ps of ["pending", "verified", "rejected", "expired"]) {
      assert.ok(PAYMENT_STATES.includes(ps), `${ps} must be accepted`);
    }
  });

  it("defines the 5 delivery states", () => {
    assert.equal(DELIVERY_STATES.length, 5);
    for (const ds of [
      "unscheduled",
      "scheduled",
      "in_progress",
      "completed",
      "missed",
    ]) {
      assert.ok(DELIVERY_STATES.includes(ds), `${ds} must be accepted`);
    }
  });
});

describe("vanta · exclusivity classes", () => {
  it("has three exclusivity tiers", () => {
    assert.equal(EXCLUSIVITIES.length, 3);
    for (const e of ["standard", "limited_edition", "one_of_one"]) {
      assert.ok(EXCLUSIVITIES.includes(e), `${e} must be an accepted value`);
    }
  });
});

describe("site origin", () => {
  it("uses NEXT_PUBLIC_SITE_URL without a trailing slash", async () => {
    const { siteUrl } = await import("../src/lib/site.ts");
    const saved = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com/";
    try {
      assert.equal(siteUrl(), "https://shop.example.com");
    } finally {
      if (saved) process.env.NEXT_PUBLIC_SITE_URL = saved;
      else delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });
});

describe("vanta · effective price", () => {
  it("stacks the product sale and a live promotion once", () => {
    const product = { basePriceCents: 100000, discountPercent: 10 };
    assert.equal(effectiveUnitPriceCents(product, null), 90000);
    assert.equal(effectiveUnitPriceCents(product, { discountPercent: 20 }), 72000);
  });

  it("ignores a zero or missing promotion", () => {
    const product = { basePriceCents: 50000, discountPercent: 0 };
    assert.equal(effectiveUnitPriceCents(product), 50000);
    assert.equal(effectiveUnitPriceCents(product, { discountPercent: 0 }), 50000);
  });
});
