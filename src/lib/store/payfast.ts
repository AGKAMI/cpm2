/**
 * VANTA GARAGE — PayFast checkout initiation.
 * Builds the hosted PayFast checkout URL for an order.
 */

import { createHash } from "node:crypto";
import type { Order } from "../store-types";
import { getStoreDb } from "../store-db.ts";
import { rowToPayment, getPaymentsForOrder } from "./payments.ts";
import { updatePaymentState, updateOrderState, getOrder } from "./checkout.ts";
import { recordPayment } from "./payments.ts";
import { ledgerEntry } from "./ledger.ts";
import { notifyCustomer } from "./notifications.ts";

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? "";
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY ?? "";
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE ?? "";

const PAYFAST_BASE = "https://sandbox.payfast.co.za/eng/process"; // sandbox; flip to live via env

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

  const params: Record<string, string> = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    amount: amountZar,
    item_name: itemName ?? `VANTA GARAGE - #${order.productId}`,
    item_description: `Player: ${order.playerId} - ${order.inGameName}`,
    custom_str1: order.id,
    name_first: "VANTA",
    name_last: "Customer",
    email_address: "checkout@vanta-garage.local",
  };

  // PayFast signature: MD5 of sorted param string + passphrase
  const sortedKeys = Object.keys(params).sort();
  const dataString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  // PayFast signature: MD5 of (sorted param string + passphrase)
  const signature = createHash("md5")
    .update(`${dataString}${PAYFAST_PASSPHRASE}`)
    .digest("hex");

  const checkoutParams: Record<string, string> = { ...params, signature };
  const qs = Object.entries(checkoutParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const baseUrl = getPayFastBaseUrl();
  return { url: `${baseUrl}?${qs}`, configured: true };
}

export function getPayFastBaseUrl(): string {
  return process.env.PAYFAST_BASE_URL ?? PAYFAST_BASE;
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
        `https://sandbox.payfast.co.za/eng/query_transactions?merchant_id=${encodeURIComponent(PAYFAST_MERCHANT_ID)}&merchant_key=${encodeURIComponent(PAYFAST_MERCHANT_KEY)}&payment_id=${encodeURIComponent(payment.providerRef)}`,
      );
      if (pfQuery.ok) {
        const text = await pfQuery.text();
        // PayFast returns key=value pairs separated by &
        const params: Record<string, string> = {};
        for (const pair of text.split("&")) {
          const [k, v] = pair.split("=");
          if (k && v !== undefined) params[k] = v;
        }
        if (params.payment_status === "COMPLETED") {
          await recordPayment({
            orderId: payment.orderId,
            provider: "payfast",
            providerRef: payment.providerRef,
            amountCents: payment.amountCents,
            currency: payment.currency,
            status: "verified",
          });
          await updatePaymentState(payment.orderId, "verified");
          await updateOrderState(payment.orderId, "payment_confirmed");
          await ledgerEntry({
            orderId: payment.orderId,
            type: "payment",
            amountCents: payment.amountCents,
            currency: payment.currency,
            relatedPaymentId: payment.providerRef,
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
