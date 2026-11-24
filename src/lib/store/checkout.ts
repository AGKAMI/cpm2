/**
 * VANTA GARAGE — checkout service.
 * Creates orders, locks stock for 60 minutes, handles payment state machine.
 */

import { getStoreDb } from "../store-db.ts";
import { reserveStock, releaseStock, confirmStockDeduction, getInventory, createInventory, getProduct } from "./products.ts";
import type { Order, OrderState, PaymentState, DeliveryState } from "../store-types.ts";
import { ApiError } from "../api.ts";

const RESERVATION_MINUTES = 60;

function nowIso(): string {
  return new Date().toISOString();
}

function orderId(): string {
  return `VNT_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type CreateOrderInput = {
  customerId: number;
  productId: number;
  quantity: number;
  amountCents: number;
  currency: string;
  paymentMethod: "payfast" | "eft" | "stars";
  playerId: string;
  inGameName: string;
  idempotencyKey: string;
};

export type CreateOrderResult = {
  order: Order;
  reservedUntil: string;
};

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const db = await getStoreDb();

  // Always fetch the product for exclusivity enforcement and stock seeding
  const product = await getProduct(input.productId);
  if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");

  // One-of-One exclusivity enforcement — Sec 8 / Rule 7: never permit duplicate
  // purchases of exclusive stock.
  if (product.exclusivity === "one_of_one") {
    const existing = await db.execute({
      sql: `SELECT id FROM vanta_orders WHERE product_id = ? AND order_state NOT IN ('cancelled', 'refunded') LIMIT 1`,
      args: [input.productId],
    });
    if (existing.rows.length > 0) {
      throw new ApiError(400, "EXCLUSIVE_STOCK_UNAVAILABLE", "This exclusive vehicle has already been purchased.");
    }
  }

  // Idempotency: if an order with this key already exists, return it instead of duplicating
  const existing = await db.execute({
    sql: `SELECT id FROM vanta_orders WHERE idempotency_key = ? LIMIT 1`,
    args: [input.idempotencyKey],
  });
  if (existing.rows.length > 0) {
    const order = await getOrder(existing.rows[0].id as string);
    if (!order) throw new ApiError(500, "ORDER_NOT_FOUND", "Existing order not found.");
    return { order, reservedUntil: order.reservedUntil ?? "" };
  }

  // Ensure inventory exists for this product (auto-seed from product stock)
  const existingInventory = await getInventory(input.productId);
  if (!existingInventory) {
    await createInventory(input.productId, product.stockQuantity);
  }

  // Atomic stock reservation.
  //
  // NOTE: there is deliberately NO "release and retry" here. reserveStock()
  // failing means the pool is full — most often because OTHER live orders hold
  // that stock. Releasing input.quantity off the shared counter unconditionally
  // would steal those orders' reservations, which is precisely the oversell
  // this fix removes. A reservation genuinely leaked by a failed order insert
  // is reclaimed by the expiry sweep (listExpiredReservations -> 
  // expireReservation), which is the only component that can tell a leaked
  // hold from a legitimate one.
  if (!(await reserveStock(input.productId, input.quantity))) {
    throw new ApiError(400, "INSUFFICIENT_STOCK", "Insufficient stock available.");
  }

  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();
  const id = orderId();
  const now = nowIso();

  await db.execute({
  sql: `INSERT INTO vanta_orders (id, customer_id, product_id, quantity, order_state, payment_state, delivery_state, amount_cents, currency, exchange_rate, reserved_until, payment_method, player_id, in_game_name, idempotency_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'awaiting_payment', 'pending', 'unscheduled', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    id,
    input.customerId,
    input.productId,
    input.quantity,
    input.amountCents,
    input.currency,
    reservedUntil,
    input.paymentMethod,
    input.playerId,
    input.inGameName,
    input.idempotencyKey,
    now,
    now,
  ],
  });

  const order = await getOrder(id);
  if (!order) throw new ApiError(500, "ORDER_INSERT_FAILED", "Order insert returned no row.");
  return { order, reservedUntil };
}

export async function getOrder(id: string): Promise<Order | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_orders WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToOrder(result.rows[0]);
}

export async function getOrderByIdempotencyKey(key: string): Promise<Order | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_orders WHERE idempotency_key = ? LIMIT 1`,
    args: [key],
  });
  if (result.rows.length === 0) return null;
  return rowToOrder(result.rows[0]);
}

export async function listOrders(
  { customerId, playerId }: { customerId?: number; playerId?: string } = {},
): Promise<Order[]> {
  const db = await getStoreDb();
  let sql = `SELECT * FROM vanta_orders WHERE 1=1`;
  const args: unknown[] = [];
  if (customerId !== undefined) {
    sql += ` AND customer_id = ?`;
    args.push(customerId);
  }
  if (playerId !== undefined) {
    sql += ` AND player_id = ?`;
    args.push(playerId);
  }
  sql += ` ORDER BY created_at DESC`;
  const result = await db.execute({ sql, args });
  return result.rows.map(rowToOrder);
}

export async function updatePaymentState(orderId: string, paymentState: PaymentState): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_orders SET payment_state = ?, updated_at = ? WHERE id = ?`,
    args: [paymentState, nowIso(), orderId],
  });
}

export async function updateOrderState(orderId: string, orderState: OrderState): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_orders SET order_state = ?, updated_at = ? WHERE id = ?`,
    args: [orderState, nowIso(), orderId],
  });
}

export async function confirmPayment(orderId: string): Promise<void> {
  /**
   * Payment verified server-side. Move reserved stock to confirmed deduction,
   * advance order state to payment_confirmed.
   */
  const db = await getStoreDb();
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (order.paymentState === "verified") return; // idempotent (fast path)

  // ONE-SHOT + RACE-FREE: only the caller that flips payment_state performs the
  // deduction. PayFast retries the ITN and the admin can double-click Verify —
  // either way the second caller finds the flip already done and returns. The
  // previous read-then-deduct pattern let two callers that both read 'pending'
  // each run confirmStockDeduction, selling the same units twice.
  const flipped = await db.execute({
    sql: `UPDATE vanta_orders
          SET payment_state = 'verified', updated_at = ?
          WHERE id = ?
            AND payment_state NOT IN ('verified', 'rejected', 'expired')`,
    args: [nowIso(), orderId],
  });
  if (flipped.affectedRowCount === 0) {
    // Lost the race or already terminal — re-read to decide which.
    const fresh = await getOrder(orderId);
    if (fresh?.paymentState === "verified") return; // idempotent success
    throw new Error("Payment was rejected or expired; reinstate the order before verifying");
  }

  const inventory = await getInventory(order.productId);
  if (inventory) {
    const deducted = await confirmStockDeduction(order.productId, order.quantity);
    // confirmStockDeduction now refuses rather than clamping when the counters
    // cannot cover the deduction. Reaching that state means inventory no longer
    // reflects reality, so verifying the order would hand over stock that was
    // never subtracted — surface it instead of marking a paid order complete.
    if (!deducted) {
      throw new Error(
        `Inventory could not cover the deduction for product ${order.productId} (qty ${order.quantity}) — the order was left unverified for manual review.`
      );
    }
  }

  await updateOrderState(orderId, "payment_confirmed");
}

export async function expireReservation(orderId: string): Promise<void> {
  /**
   * Reservation expired without payment. Release stock, mark order cancelled.
   */
  const db = await getStoreDb();
  const order = await getOrder(orderId);
  if (!order) return;
  if (order.paymentState === "verified") return; // paid — don't release
  // Same one-release-per-order rule as rejectPayment: an order that already
  // reached a terminal state has had its stock returned, so releasing again
  // would take units from OTHER orders. The expiry sweep must be safe to
  // re-run over the same row.
  if (
    order.paymentState === "rejected" ||
    order.paymentState === "expired" ||
    order.orderState === "cancelled"
  ) {
    return;
  }

  // RACE-FREE: conditional flip — only the caller that moves the row releases.
  const flipped = await db.execute({
    sql: `UPDATE vanta_orders
          SET payment_state = 'expired', order_state = 'cancelled', updated_at = ?
          WHERE id = ?
            AND payment_state = 'pending'`,
    args: [nowIso(), orderId],
  });
  if (flipped.affectedRowCount === 0) return; // lost the race or already terminal

  const inventory = await getInventory(order.productId);
  if (inventory) {
    await releaseStock(order.productId, order.quantity);
  }
}

export async function listExpiredReservations(): Promise<Order[]> {
  /***
   * Orders still in awaiting_payment whose reserved_until has passed.
   * For the recovery job to process.
   */
  const result = await (await getStoreDb()).execute({
    sql: `SELECT * FROM vanta_orders
          WHERE order_state = 'awaiting_payment'
            AND payment_state = 'pending'
            AND reserved_until < ?`,
    args: [nowIso()],
  });
  return result.rows.map(rowToOrder);
}

export async function listAllOrders(): Promise<Order[]> {
  /***
   * Admin view: list every order regardless of customer scope.
   */
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_orders ORDER BY created_at DESC`,
    args: [],
  });
  return result.rows.map(rowToOrder);
}

export async function rejectPayment(orderId: string): Promise<void> {
  /***
   * Admin rejects an EFT payment (proof invalid / not received).
   * Release reserved stock, mark payment rejected, order cancelled.
   *
   * Idempotent: a second reject finds the stock ALREADY back in the pool and
   * must not release it a second time. releaseStock() subtracts from one
   * shared aggregate, so a blind second release steals units that belong to
   * other live orders — reproduced live (reserved 3 -> 1 after a double
   * reject, then an order for 5 was committed against only 5 real units:
   * an oversell by 3). Terminal-state check rather than a throw so a
   * double-clicked Reject in the admin UI returns success, not an error.
   */
  const db = await getStoreDb();
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (order.paymentState === "verified") throw new Error("Payment already verified");
  if (
    order.paymentState === "rejected" ||
    order.paymentState === "expired" ||
    order.orderState === "cancelled"
  ) {
    return;
  }

  // RACE-FREE: the flip itself is conditional, so only the caller that actually
  // moves the row performs releaseStock. The guard above covers a sequential
  // double-click; this covers two rejects that BOTH read 'pending' — without
  // it, both pass the guard and both release.
  const flipped = await db.execute({
    sql: `UPDATE vanta_orders
          SET payment_state = 'rejected', order_state = 'cancelled', updated_at = ?
          WHERE id = ?
            AND payment_state NOT IN ('rejected', 'expired')
            AND order_state NOT IN ('cancelled', 'refunded')`,
    args: [nowIso(), orderId],
  });
  if (flipped.affectedRowCount === 0) return; // lost the race — the winner releases

  const inventory = await getInventory(order.productId);
  if (inventory) {
    await releaseStock(order.productId, order.quantity);
  }
}

export async function setDeliveryEvidence(orderId: string, evidenceUrl: string): Promise<void> {
  /***
   * Admin uploads delivery evidence (photo/screenshot URL) for an order.
   * Creates or updates an appointment record with the evidence link.
   */
  const db = await getStoreDb();
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");
  // Same class of guard as confirmPayment and rejectPayment: delivery is only
  // ever scheduled for a PAID order. Without this, evidence could be attached
  // to an order the admin already REJECTED (stock released, orderState
  // cancelled), flipping it to delivery_scheduled and handing over stock that
  // was never paid for.
  if (order.paymentState !== "verified") {
    throw new Error("Payment must be verified before scheduling delivery");
  }

  const now = nowIso();
  const appointmentId = order.appointmentId ?? `APT_${Date.now().toString(36)}`;

  // Ensure an appointment row exists
  const existing = await db.execute({
    sql: `SELECT id FROM vanta_appointments WHERE order_id = ? LIMIT 1`,
    args: [orderId],
  });

  if (existing.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO vanta_appointments (id, order_id, scheduled_at, admin_platform, admin_user_id, status, delivery_evidence, customer_confirmed, missed_count, created_at)
            VALUES (?, ?, ?, 'whatsapp', 'admin', 'scheduled', ?, 0, 0, ?)`,
      args: [appointmentId, orderId, now, evidenceUrl, now],
    });
    await db.execute({
      sql: `UPDATE vanta_orders SET appointment_id = ?, updated_at = ? WHERE id = ?`,
      args: [appointmentId, now, orderId],
    });
  } else {
    await db.execute({
      sql: `UPDATE vanta_appointments SET delivery_evidence = ?, updated_at = ? WHERE order_id = ?`,
      args: [evidenceUrl, now, orderId],
    });
  }

  await updateOrderState(orderId, "delivery_scheduled");
}

function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id: String(row.id ?? ""),
    customerId: Number(row.customer_id),
    productId: Number(row.product_id),
    quantity: Number(row.quantity ?? 1),
    orderState: (row.order_state ?? "awaiting_payment") as OrderState,
    paymentState: (row.payment_state ?? "pending") as PaymentState,
    deliveryState: (row.delivery_state ?? "unscheduled") as DeliveryState,
    amountCents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "ZAR"),
    exchangeRate: row.exchange_rate === null ? null : Number(row.exchange_rate),
    reservedUntil: row.reserved_until === null ? null : String(row.reserved_until),
    paymentMethod: (row.payment_method ?? "eft") as "payfast" | "eft" | "stars",
    playerId: String(row.player_id ?? ""),
    inGameName: String(row.in_game_name ?? ""),
    appointmentId: row.appointment_id === null ? null : String(row.appointment_id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
