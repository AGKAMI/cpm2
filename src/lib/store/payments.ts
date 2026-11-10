/**
 * VANTA GARAGE — payments service.
 * Records payment transactions (PayFast gateway + EFT manual verification).
 */

import { getStoreDb } from "../store-db.ts";
import type { FinancialLedgerEntry } from "../store-types.ts";

export type PaymentRecord = {
  id: number;
  orderId: string;
  provider: string;
  providerRef: string;
  amountCents: number;
  currency: string;
  status: "pending" | "verified" | "rejected";
  webhookReceived: boolean;
  createdAt: string;
  updatedAt: string;
};

export function rowToPayment(row: Record<string, unknown>): PaymentRecord {
  return {
    id: Number(row.id),
    orderId: String(row.order_id),
    provider: String(row.provider),
    providerRef: String(row.provider_ref),
    amountCents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "ZAR"),
    status: (row.status ?? "pending") as "pending" | "verified" | "rejected",
    webhookReceived: Number(row.webhook_received ?? 0) === 1,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function recordPayment(input: {
  orderId: string;
  provider: string;
  providerRef: string;
  amountCents: number;
  currency: string;
  status: "pending" | "verified" | "rejected";
}): Promise<PaymentRecord> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_payments (order_id, provider, provider_ref, amount_cents, currency, status, webhook_received, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    args: [
      input.orderId,
      input.provider,
      input.providerRef,
      input.amountCents,
      input.currency,
      input.status,
      now,
      now,
    ],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Payment insert returned no id");
  return rowToPayment({ id, order_id: input.orderId, provider: input.provider, provider_ref: input.providerRef, amount_cents: input.amountCents, currency: input.currency, status: input.status, webhook_received: 0, created_at: now, updated_at: now });
}

export async function getPaymentsForOrder(orderId: string): Promise<PaymentRecord[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_payments WHERE order_id = ? ORDER BY created_at DESC`,
    args: [orderId],
  });
  return result.rows.map(rowToPayment);
}

export async function markWebhookReceived(paymentId: number): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_payments SET webhook_received = 1, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), paymentId],
  });
}
