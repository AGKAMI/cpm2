/**
 * Shared settlement bookkeeping.
 *
 * The order state flip, payment row and ledger row used to be written by three
 * independent call sites. If a request died between them, the order stayed
 * paid but the audit trail was missing — and a retry that saw `verified` on
 * the order returned early, so the gap was never repaired. Every settlement
 * path now funnels its bookkeeping through this idempotent helper.
 */

import type { Order } from "../store-types.ts";
import { getPaymentsForOrder, recordPayment } from "./payments.ts";
import { ledgerEntry, listLedgerEntries } from "./ledger.ts";

export async function ensureSettlementRecords(input: {
  order: Order;
  provider: string;
  providerRef: string;
}): Promise<void> {
  const { order, provider, providerRef } = input;

  const payments = await getPaymentsForOrder(order.id);
  if (!payments.some((payment) => payment.status === "verified")) {
    await recordPayment({
      orderId: order.id,
      provider,
      providerRef,
      amountCents: order.amountCents,
      currency: order.currency,
      status: "verified",
    });
  }

  const entries = await listLedgerEntries({ orderId: order.id });
  if (!entries.some((entry) => entry.type === "payment")) {
    await ledgerEntry({
      orderId: order.id,
      type: "payment",
      amountCents: order.amountCents,
      currency: order.currency,
      relatedPaymentId: providerRef,
    });
  }
}
