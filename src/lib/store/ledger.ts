/**
 * VANTA GARAGE — financial ledger.
 * Complete auditable record of every money movement: payments, refunds,
 * fees, adjustments, chargebacks. Historical transactions keep their
 * original transaction currency and exchange rate — never recalculated.
 */

import { getStoreDb } from "../store-db.ts";
import type { FinancialLedgerEntry } from "../store-types.ts";

function rowToLedgerEntry(row: Record<string, unknown>): FinancialLedgerEntry {
  return {
    id: Number(row.id),
    orderId: row.order_id === null ? null : String(row.order_id),
    type: (row.type ?? "adjustment") as FinancialLedgerEntry["type"],
    amountCents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "ZAR"),
    exchangeRate: row.exchange_rate === null ? null : Number(row.exchange_rate),
    relatedPaymentId: row.related_payment_id === null ? null : String(row.related_payment_id),
    recordedAt: String(row.recorded_at ?? ""),
  };
}

export async function ledgerEntry(input: {
  orderId: string | null;
  type: FinancialLedgerEntry["type"];
  amountCents: number;
  currency: string;
  exchangeRate?: number | null;
  relatedPaymentId: string | null;
}): Promise<FinancialLedgerEntry> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_financial_ledger (order_id, type, amount_cents, currency, exchange_rate, related_payment_id, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.orderId,
      input.type,
      input.amountCents,
      input.currency,
      input.exchangeRate ?? null,
      input.relatedPaymentId,
      now,
    ],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Ledger insert returned no id");
  return rowToLedgerEntry({
    id,
    order_id: input.orderId,
    type: input.type,
    amount_cents: input.amountCents,
    currency: input.currency,
    exchange_rate: input.exchangeRate ?? null,
    related_payment_id: input.relatedPaymentId,
    recorded_at: now,
  });
}

export async function listLedgerEntries({ orderId }: { orderId?: string } = {}): Promise<FinancialLedgerEntry[]> {
  const db = await getStoreDb();
  let sql = `SELECT * FROM vanta_financial_ledger WHERE 1=1`;
  const args: unknown[] = [];
  if (orderId !== undefined) {
    sql += ` AND order_id = ?`;
    args.push(orderId);
  }
  sql += ` ORDER BY recorded_at DESC`;
  const result = await db.execute({ sql, args });
  return result.rows.map(rowToLedgerEntry);
}

export async function ledgerTotals({ currency }: { currency?: string } = {}): Promise<{
  payments: number;
  refunds: number;
  fees: number;
  net: number;
}> {
  const db = await getStoreDb();
  let sql = `SELECT type, SUM(amount_cents) as total FROM vanta_financial_ledger WHERE 1=1`;
  const args: unknown[] = [];
  if (currency !== undefined) {
    sql += ` AND currency = ?`;
    args.push(currency);
  }
  sql += ` GROUP BY type`;
  const result = await db.execute({ sql, args });
  const totals = { payments: 0, refunds: 0, fees: 0, net: 0 };
  for (const row of result.rows) {
    const type = String(row.type);
    const total = Number(row.total ?? 0);
    if (type === "payment") totals.payments = total;
    if (type === "refund") totals.refunds = total;
    if (type === "fee") totals.fees = total;
  }
  totals.net = totals.payments - totals.refunds - totals.fees;
  return totals;
}
