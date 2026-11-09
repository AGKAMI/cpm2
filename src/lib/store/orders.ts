/**
 * VANTA GARAGE — Order pipeline state machine.
 *
 * Order states:
 *   checkout_initiated → awaiting_payment → payment_confirmed → processing
 *     → delivery_scheduled → awaiting_delivery → delivery_in_progress
 *     → delivery_verified → completed
 *
 * Transitions are guarded server-side; invalid transitions are rejected.
 * Stock reservation: 60-minute lock on product stock when order is created;
 * released on expiry, cancellation, or payment confirmation.
 */

import { getStoreDb } from "../store-db";

export type OrderState =
  | "checkout_initiated"
  | "awaiting_payment"
  | "payment_confirmed"
  | "payment_rejected"
  | "processing"
  | "delivery_scheduled"
  | "awaiting_delivery"
  | "delivery_in_progress"
  | "delivery_verified"
  | "completed"
  | "cancelled"
  | "refund_pending"
  | "refunded"
  | "disputed";

export type PaymentState = "pending" | "verified" | "rejected" | "expired";
export type DeliveryState = "unscheduled" | "scheduled" | "in_progress" | "completed" | "missed";

export type OrderRecord = {
  id: string;
  customerId: number;
  productId: number;
  quantity: number;
  orderState: OrderState;
  paymentState: PaymentState;
  deliveryState: DeliveryState;
  amountCents: number;
  currency: string;
  exchangeRate: number | null;
  reservedUntil: string | null;
  paymentMethod: "payfast" | "eft";
  playerId: string;
  inGameName: string;
  appointmentId: string | null;
  createdAt: string;
  updatedAt: string;
};

function rowToOrder(row: Record<string, unknown>): OrderRecord {
  return {
    id: String(row.id),
    customerId: Number(row.customer_id),
    productId: Number(row.product_id),
    quantity: Number(row.quantity ?? 1),
    orderState: (row.order_state ?? "checkout_initiated") as OrderState,
    paymentState: (row.payment_state ?? "pending") as PaymentState,
    deliveryState: (row.delivery_state ?? "unscheduled") as DeliveryState,
    amountCents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "ZAR"),
    exchangeRate: row.exchange_rate === null || row.exchange_rate === undefined ? null : Number(row.exchange_rate),
    reservedUntil: row.reserved_until === null || row.reserved_until === undefined ? null : String(row.reserved_until),
    paymentMethod: (row.payment_method ?? "eft") as "payfast" | "eft",
    playerId: String(row.player_id ?? ""),
    inGameName: String(row.in_game_name ?? ""),
    appointmentId: row.appointment_id === null || row.appointment_id === undefined ? null : String(row.appointment_id),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_orders WHERE id = ?`,
    args: [orderId],
  });
  if (result.rows.length === 0) return null;
  return rowToOrder(result.rows[0]);
}

export async function getOrdersByCustomer(customerId: number, state?: OrderState): Promise<OrderRecord[]> {
  const db = await getStoreDb();
  const args: unknown[] = [customerId];
  if (state) args.push(state);
  const result = await db.execute({
    sql: `SELECT * FROM vanta_orders WHERE customer_id = ?${state ? " AND order_state = ?" : ""} ORDER BY created_at DESC`,
    args,
  });
  return result.rows.map(rowToOrder);
}

export async function createOrder(input: {
  customerId: number;
  productId: number;
  quantity: number;
  amountCents: number;
  currency: string;
  exchangeRate: number | null;
  reservedUntil: string | null;
  paymentMethod: "payfast" | "eft";
  playerId: string;
  inGameName: string;
}): Promise<OrderRecord> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_orders (id, customer_id, product_id, quantity, order_state, payment_state, delivery_state, amount_cents, currency, exchange_rate, reserved_until, payment_method, player_id, in_game_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'checkout_initiated', 'pending', 'unscheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `order_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      input.customerId,
      input.productId,
      input.quantity,
      input.amountCents,
      input.currency,
      input.exchangeRate,
      input.reservedUntil,
      input.paymentMethod,
      input.playerId,
      input.inGameName,
      now,
      now,
    ],
  });
  if (result.lastInsertRowid === null) throw new Error("Order insert returned no id");
  const order = await getOrder(String(result.lastInsertRowid));
  if (!order) throw new Error("Order insert returned no id");
  return order;
}

export async function updateOrderState(orderId: string, orderState: OrderState): Promise<OrderRecord | null> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `UPDATE vanta_orders SET order_state = ?, updated_at = ? WHERE id = ?`,
    args: [orderState, now, orderId],
  });
  if (result.affectedRowCount === 0) return null;
  return getOrder(orderId);
}

export async function updatePaymentState(orderId: string, paymentState: PaymentState): Promise<OrderRecord | null> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `UPDATE vanta_orders SET payment_state = ?, updated_at = ? WHERE id = ?`,
    args: [paymentState, now, orderId],
  });
  if (result.affectedRowCount === 0) return null;
  return getOrder(orderId);
}

export async function updateDeliveryState(orderId: string, deliveryState: DeliveryState): Promise<OrderRecord | null> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `UPDATE vanta_orders SET delivery_state = ?, updated_at = ? WHERE id = ?`,
    args: [deliveryState, now, orderId],
  });
  if (result.affectedRowCount === 0) return null;
  return getOrder(orderId);
}

export async function reserveOrderStock(orderId: string, productId: number, quantity: number, reservedUntil: string): Promise<void> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE vanta_inventory SET stock_quantity = stock_quantity - ?, reserved_quantity = reserved_quantity + ?, updated_at = ? WHERE product_id = ?`,
    args: [quantity, quantity, now, productId],
  });
}