/**
 * VANTA GARAGE — PayFast checkout initiation.
 * Builds the hosted PayFast checkout URL for an order.
 */

import type { Order } from "../store-types";
import { getStoreDb } from "../store-db.ts";
import { rowToPayment } from "./payments.ts";
import { confirmPayment, getOrder } from "./checkout.ts";
import { ensureSettlementRecords } from "./settlement.ts";
import { notifyCustomer } from "./notifications.ts";
import { getPayFastCheckoutUrl, getPayFastQueryUrl } from "./payfast-url.ts";
import { payfastSignature } from "./payfast-signature.ts";

export { getPayFastBaseUrl, getPayFastCheckoutUrl, getPayFastQueryUrl } from "./payfast-url.ts";

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? "";
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY ?? "";
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE ?? "";


export function isPayFastConfigured(): boolean {
  return Boolean(PAYFAST_MERCHANT_ID && PAYFAST_MERCHANT_KEY && PAYFAST_PASSPHRASE);
}

export function buildPayFastCheckoutUrl(
  order: Order,
  returnUrl: string,
  cancelUrl: string,
  notifyUrl: string,
  itemName?: string,
): { url: string; configured: boolean } {
  if (!isPayFastConfigured()) {
    return { url: "", configured: false };
  }

  const amountZar = (order.amountCents / 100).toFixed(2);

  // Field order is part of the signature: PayFast signs the pairs in the
  // order its docs describe them (merchant, customer, transaction), so
  // this object is constructed in exactly that order — do not reorder.
  const params: Record<string, string> = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    name_first: "VANTA",
    name_last: "Customer",
    email_address: "checkout@vanta-garage.local",
    amount: amountZar,
    item_name: itemName ?? `VANTA GARAGE - #${order.productId}`,
    item_description: `Player: ${order.playerId} - ${order.inGameName}`,
    custom_str1: order.id,
  };

  const signature = payfastSignature(params, PAYFAST_PASSPHRASE);

  const checkoutParams: Record<string, string> = { ...params, signature };
  const qs = Object.entries(checkoutParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  return { url: `${getPayFastCheckoutUrl()}?${qs}`, configured: true };
}


/**
 * Retry a failed or pending webhook by re-verifying with PayFast.
 * Sec 20.1: background job retry mechanism.
 */
export async function retryWebhook(paymentId: string): Promise<void> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_payments WHERE id = ?`,
    args: [paymentId],
  });
  if (result.rows.length === 0) throw new Error("Payment not found");

  const payment = rowToPayment(result.rows[0]);
  if (payment.status === "verified") return; // already processed — idempotent

  const order = await getOrder(payment.orderId);
  if (!order) throw new Error("Order not found for payment");
  if (order.paymentState === "verified") return; // order already confirmed

  // Re-query PayFast for the transaction status if configured
  if (isPayFastConfigured() && payment.providerRef) {
    try {
      const pfQuery = await fetch(
        // The configured base URL, not the hardcoded sandbox — live
        // payments never recovered via retries with the sandbox endpoint.
        `${getPayFastQueryUrl()}?merchant_id=${encodeURIComponent(PAYFAST_MERCHANT_ID)}&merchant_key=${encodeURIComponent(PAYFAST_MERCHANT_KEY)}&payment_id=${encodeURIComponent(payment.providerRef)}`,
      );
      if (pfQuery.ok) {
        const text = await pfQuery.text();
        // PayFast returns key=value pairs separated by &
        const params: Record<string, string> = {};
        for (const pair of text.split("&")) {
          const separator = pair.indexOf("=");
          if (separator > 0) params[pair.slice(0, separator)] = pair.slice(separator + 1);
        }
        if (params.payment_status === "COMPLETED") {
          // The shared settlement path: the same conditional state flip,
          // atomic stock deduction trigger and idempotent bookkeeping used by
          // the PayFast ITN and Telegram Stars webhooks. Writing payment_state
          // directly here used to mark the order paid without spending the
          // reserved stock.
          await confirmPayment(payment.orderId);
          await ensureSettlementRecords({
            order,
            provider: "payfast",
            providerRef: payment.providerRef,
          });
          await notifyCustomer(order.customerId, "payment_confirmed_payfast", {
            id: order.id,
            productId: order.productId,
            amountCents: order.amountCents,
            currency: order.currency,
            inGameName: order.inGameName,
            playerId: order.playerId,
          }).catch((err) => console.error("Notification failed:", err));
          return;
        }
      }
    } catch {
      // PayFast query failed — job will retry via exponential backoff
    }
  }

  // If PayFast not configured or query returned no result, leave for manual review
  // The job queue will handle retries via exponential backoff
}
