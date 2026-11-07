/**
 * VANTA GARAGE — checkout service.
 * Creates orders, locks stock for 60 minutes, handles payment state machine.
 */

import { getStoreDb } from "../store-db.ts";
import { reserveStock, releaseStock, confirmStockDeduction, getInventory } from "./products.ts";
import type { Order, OrderState, PaymentState, DeliveryState } from "../store-types.ts";

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
  paymentMethod: "payfast" | "eft";
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

  // Idempotency: if an order with this key already exists, return it instead of duplicating
  const existing = await db.execute({
    sql: `SELECT id FROM vanta_orders WHERE idempotency_key = ? LIMIT 1`,
    args: [input.idempotencyKey],
  });
  if (existing.rows.length > 0) {
    const order = await getOrder(existing.rows[0].id as string);
    if (!order) throw new Error("Existing order not found");
    return { order, reservedUntil: order.reservedUntil ?? "" };
  }

  // Atomic stock reservation
  const reserved = await reserveStock(input.productId, input.quantity);
  if (!reserved) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();
  const id = orderId();
  const now = nowIso();

  await db.execute({
    sql: `INSERT INTO vanta_orders (id, customer_id, product_id, order_state, payment_state, delivery_state, amount_cents, currency, exchange_rate, reserved_until, payment_method, player_id, in_game_name, idempotency_key, created_at, updated_at)
          VALUES (?, ?, ?, 'awaiting_payment', 'pending', 'unscheduled', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.customerId,
      input.productId,
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
  if (!order) throw new Error("Order insert returned no row");
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

export async function listOrders({ customerId }: { customerId?: number } = {}): Promise<Order[]> {
  const db = await getStoreDb();
  let sql = `SELECT * FROM vanta_orders WHERE 1=1`;
  const args: unknown[] = [];
  if (customerId !== undefined) {
    sql += ` AND customer_id = ?`;
    args.push(customerId);
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
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");
  if (order.paymentState === "verified") return; // idempotent

  const inventory = await getInventory(order.productId);
  if (inventory) {
    await confirmStockDeduction(order.productId, 1); // quantity handled per-order item; default 1
  }

  await updatePaymentState(orderId, "verified");
  await updateOrderState(orderId, "payment_confirmed");
}

export async function expireReservation(orderId: string): Promise<void> {
  /**
   * Reservation expired without payment. Release stock, mark order cancelled.
   */
  const order = await getOrder(orderId);
  if (!order) return;
  if (order.paymentState === "verified") return; // paid — don't release

  const inventory = await getInventory(order.productId);
  if (inventory) {
    await releaseStock(order.productId, 1);
  }

  await updatePaymentState(orderId, "expired");
  await updateOrderState(orderId, "cancelled");
}

export async function listExpiredReservations(): Promise<Order[]> {
  /**
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

function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id: String(row.id ?? ""),
    customerId: Number(row.customer_id),
    productId: Number(row.product_id),
    orderState: (row.order_state ?? "awaiting_payment") as OrderState,
    paymentState: (row.payment_state ?? "pending") as PaymentState,
    deliveryState: (row.delivery_state ?? "unscheduled") as DeliveryState,
    amountCents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "ZAR"),
    exchangeRate: row.exchange_rate === null ? null : Number(row.exchange_rate),
    reservedUntil: row.reserved_until === null ? null : String(row.reserved_until),
    paymentMethod: (row.payment_method ?? "eft") as "payfast" | "eft",
    playerId: String(row.player_id ?? ""),
    inGameName: String(row.in_game_name ?? ""),
    appointmentId: row.appointment_id === null ? null : String(row.appointment_id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
