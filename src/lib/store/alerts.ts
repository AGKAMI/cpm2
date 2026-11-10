/**
 * VANTA GARAGE — automated alerts.
 * Sec 17.6: financial alert coverage.
 * Sec 20.1: automated alerts.
 *
 * Alert types:
 *   - failed_payment: payment was rejected/failed
 *   - chargeback: chargeback received
 *   - reconciliation_error: ledger doesn't match gateway
 *   - unusual_transaction: amount deviates from norm
 *   - revenue_anomaly: revenue spike/drop vs baseline
 *   - low_stock: product stock below threshold
 *   - expired_reservation: reservation expired without payment
 *   - missed_delivery: delivery not confirmed by deadline
 */

import { getStoreDb } from "../store-db.ts";

export type AlertType =
  | "failed_payment"
  | "chargeback"
  | "reconciliation_error"
  | "unusual_transaction"
  | "revenue_anomaly"
  | "low_stock"
  | "expired_reservation"
  | "missed_delivery";

export type Alert = {
  id: number;
  type: AlertType;
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  entityType: string;
  entityId: string | null;
  relatedOrderId: string | null;
  isRead: boolean;
  createdAt: string;
};

function rowToAlert(row: Record<string, unknown>): Alert {
  return {
    id: Number(row.id),
    type: (row.type ?? "failed_payment") as AlertType,
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    severity: (row.severity ?? "medium") as Alert["severity"],
    entityType: String(row.entity_type ?? ""),
    entityId: row.entity_id === null || row.entity_id === undefined ? null : String(row.entity_id),
    relatedOrderId: row.related_order_id === null || row.related_order_id === undefined ? null : String(row.related_order_id),
    isRead: Number(row.is_read ?? 0) === 1,
    createdAt: String(row.created_at ?? ""),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Create a new alert. */
export async function createAlert(input: {
  type: AlertType;
  title: string;
  message: string;
  severity?: Alert["severity"];
  entityType?: string;
  entityId?: string | null;
  relatedOrderId?: string | null;
}): Promise<number> {
  const db = await getStoreDb();
  const now = nowIso();
  const result = await db.execute({
    sql: `INSERT INTO vanta_alerts (type, title, message, severity, entity_type, entity_id, related_order_id, is_read, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    args: [
      input.type,
      input.title,
      input.message,
      input.severity ?? "medium",
      input.entityType ?? "",
      input.entityId ?? null,
      input.relatedOrderId ?? null,
      now,
      now,
    ],
  });
  const id = Number(result.lastInsertRowid);
  if (!id) throw new Error("Alert insert returned no id");
  return id;
}

/** List all alerts, newest first. */
export async function listAlerts(limit = 100): Promise<Alert[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_alerts ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map(rowToAlert);
}

/** Mark an alert as read. */
export async function markAlertRead(alertId: number): Promise<void> {
  const db = await getStoreDb();
  const now = nowIso();
  await db.execute({
    sql: `UPDATE vanta_alerts SET is_read = 1, updated_at = ? WHERE id = ?`,
    args: [now, alertId],
  });
}

/** Create a financial alert (failed payment, chargeback, reconciliation error). */
export async function createFinancialAlert(input: {
  type: "failed_payment" | "chargeback" | "reconciliation_error" | "unusual_transaction" | "revenue_anomaly";
  orderId?: string | null;
  amountCents?: number;
  currency?: string;
  details?: string;
}): Promise<void> {
  const titleMap: Record<string, string> = {
    failed_payment: "Payment failed",
    chargeback: "Chargeback received",
    reconciliation_error: "Reconciliation error",
    unusual_transaction: "Unusual transaction detected",
    revenue_anomaly: "Revenue anomaly detected",
  };
  const severityMap: Record<string, Alert["severity"]> = {
    failed_payment: "high",
    chargeback: "critical",
    reconciliation_error: "high",
    unusual_transaction: "medium",
    revenue_anomaly: "high",
  };
  await createAlert({
    type: input.type,
    title: titleMap[input.type],
    message: input.details ?? `Financial alert: ${titleMap[input.type]}`,
    severity: severityMap[input.type],
    entityType: "order",
    entityId: input.orderId ?? null,
    relatedOrderId: input.orderId ?? null,
  });
}

/** Send an alert notification (queues a send_alert job). */
export async function sendAlert(payload: Record<string, unknown>): Promise<void> {
  const { enqueueJob } = await import("./jobs.ts");
  await enqueueJob({
    type: "send_alert",
    payload,
    delayMs: 0,
    maxAttempts: 3,
  });
}
