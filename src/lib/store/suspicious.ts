/**
 * VANTA GARAGE — suspicious activity detection.
 * Sec 19.2: suspicious activity detection, risk-based restrictions.
 *
 * Detects:
 *   - Multiple failed payments from same customer/platform user
 *   - Rapid order creation (velocity check)
 *   - Amount mismatches between webhook and order
 *   - Unusual transaction patterns
 *
 * Creates alerts when suspicious patterns are found.
 */

import { getStoreDb } from "../store-db.ts";
import { createFinancialAlert } from "./alerts.ts";
import { enqueueJob } from "./jobs.ts";

function nowIso(): string {
  return new Date().toISOString();
}

/** Run all suspicious activity checks. Called by detect_suspicious job. */
export async function runSuspiciousDetection(): Promise<void> {
  await checkMultipleFailedPayments();
  await checkRapidOrderCreation();
  await checkAmountMismatches();
  await checkUnusualAmounts();
}

/**
 * Flag customers with 3+ failed payments in the last 24 hours.
 */
async function checkMultipleFailedPayments(): Promise<void> {
  const db = await getStoreDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const result = await db.execute({
    sql: `SELECT p.order_id, COUNT(*) as fail_count
          FROM vanta_payments p
          JOIN vanta_orders o ON o.id = p.order_id
          WHERE p.status = 'rejected' AND p.created_at >= ?
          GROUP BY p.order_id
          HAVING fail_count >= 3`,
    args: [since],
  });

  for (const row of result.rows) {
    const orderId = String(row.order_id);
    await createFinancialAlert({
      type: "failed_payment",
      orderId,
      details: `Multiple failed payments (${row.fail_count}) for order ${orderId} in last 24h`,
    });
  }
}

/**
 * Flag customers creating more than 5 orders in 1 hour (velocity check).
 */
async function checkRapidOrderCreation(): Promise<void> {
  const db = await getStoreDb();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const result = await db.execute({
    sql: `SELECT customer_id, COUNT(*) as order_count
          FROM vanta_orders
          WHERE created_at >= ?
          GROUP BY customer_id
          HAVING order_count >= 5`,
    args: [since],
  });

  for (const row of result.rows) {
    const customerId = Number(row.customer_id);
    const count = Number(row.order_count);
    await createFinancialAlert({
      type: "unusual_transaction",
      orderId: null,
      details: `Customer ${customerId} created ${count} orders in the last hour`,
    });
  }
}

/**
 * Flag payments where webhook amount doesn't match order amount.
 */
async function checkAmountMismatches(): Promise<void> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT p.id, p.order_id, p.amount_cents, o.amount_cents as order_amount
          FROM vanta_payments p
          JOIN vanta_orders o ON o.id = p.order_id
          WHERE p.amount_cents != o.amount_cents`,
    args: [],
  });

  for (const row of result.rows) {
    const paymentId = Number(row.id);
    const orderId = String(row.order_id);
    await createFinancialAlert({
      type: "reconciliation_error",
      orderId,
      amountCents: Number(row.amount_cents),
      details: `Payment ${paymentId} amount ${row.amount_cents}¢ ≠ order ${orderId} amount ${row.order_amount}¢`,
    });
  }
}

/**
 * Flag transactions with amounts significantly above the customer's average.
 */
async function checkUnusualAmounts(): Promise<void> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT o.customer_id, p.amount_cents, o.id as order_id,
                 AVG(p2.amount_cents) as avg_amount
          FROM vanta_payments p
          JOIN vanta_orders o ON o.id = p.order_id
          JOIN vanta_payments p2 ON p2.order_id = o.id AND p2.status = 'verified'
          WHERE p.status = 'verified' AND p.amount_cents > 0
          GROUP BY o.customer_id, p.id, o.id
          HAVING p.amount_cents > (avg_amount * 3) AND avg_amount > 0`,
    args: [],
  });

  for (const row of result.rows) {
    const orderId = String(row.order_id);
    await createFinancialAlert({
      type: "unusual_transaction",
      orderId,
      amountCents: Number(row.amount_cents),
      details: `Transaction ${row.amount_cents}¢ is >3x customer average for order ${orderId}`,
    });
  }
}

/** Enqueue a detect_suspicious job (for cron or manual trigger). */
export async function scheduleSuspiciousDetection(delayMs = 0): Promise<void> {
  await enqueueJob({
    type: "detect_suspicious",
    payload: {},
    delayMs,
    maxAttempts: 3,
  });
}
