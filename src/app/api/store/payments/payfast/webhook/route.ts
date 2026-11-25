/**
 * VANTA GARAGE — PayFast webhook.
 * POST /api/store/payments/payfast/webhook
 * Verifies PayFast webhook signature, confirms payment server-side,
 * advances order state to payment_confirmed.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { fail, ok } from "@/lib/route";
import { confirmPayment, getOrder, rejectPayment } from "@/lib/store/checkout";
import { recordPayment } from "@/lib/store/payments";
import { ledgerEntry } from "@/lib/store/ledger";
import { notifyCustomer } from "@/lib/store/notifications";

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE;

export const dynamic = "force-dynamic";

/**
 * Parse the ITN body in either encoding, with values as received.
 * PayFast posts application/x-www-form-urlencoded — readJson() rejects that
 * content-type, which is how every real ITN used to die before any code ran.
 */
async function readItnBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed = (await request.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) out[k] = String(v ?? "");
    return out;
  }
  // form-urlencoded — URLSearchParams decodes percent-encoding, so values
  // match exactly what PayFast signed.
  const text = await request.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

/** PayFast signature: MD5 over the sorted key=value&... string of every
 *  received field except signature, passphrase appended. Empty fields stay
 *  in the string — they are part of what PayFast signs. */
function payfastSignature(body: Record<string, string>, passphrase: string): string {
  const dataString = Object.keys(body)
    .filter((k) => k !== "signature")
    .sort()
    .map((k) => `${k}=${body[k]}`)
    .join("&");
  return createHash("md5").update(`${dataString}${passphrase}`).digest("hex");
}

export async function POST(request: Request) {
  try {
    if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY || !PAYFAST_PASSPHRASE) {
      throw new Error("PayFast not configured on the server.");
    }

    const body = await readItnBody(request);

    const signature = body.signature ?? "";
    const expected = payfastSignature(body, PAYFAST_PASSPHRASE);
    if (
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return fail(new Error("Invalid PayFast signature"));
    }

    const orderId = body.custom_str1 || body.m_payment_id;
    if (!orderId) {
      throw new Error("No order reference in webhook");
    }
    const order = await getOrder(String(orderId));
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.paymentState === "verified") {
      return ok({ received: true }); // idempotent
    }

    const amountCents = Math.round(Number(body.amount_gross ?? 0) * 100);
    const currency = "ZAR";
    const providerRef = String(body.m_payment_id ?? "");
    const completed = body.payment_status === "COMPLETED";

    // Amount integrity: webhook amount must match order amount exactly
    if (amountCents !== order.amountCents) {
      throw new Error(
        `Amount mismatch: webhook ${amountCents}¢ ≠ order ${order.amountCents}¢ (order ${order.id})`,
      );
    }

    await recordPayment({
      orderId: String(orderId),
      provider: "payfast",
      providerRef,
      amountCents,
      currency,
      status: completed ? "verified" : "rejected",
    });

    if (completed) {
          // The shared race-safe path: one-shot state flip + stock deduction.
          // Calling updatePaymentState directly skipped confirmStockDeduction,
          // so paid orders never reduced inventory (and duplicate ITNs
          // double-recorded).
          await confirmPayment(String(orderId));
          await ledgerEntry({
            orderId: String(orderId),
            type: "payment",
            amountCents,
            currency,
            relatedPaymentId: providerRef,
          });
          // Notify customer (fire-and-forget)
          notifyCustomer(order.customerId, "payment_confirmed_payfast", {
            id: order.id,
            productId: order.productId,
            amountCents: order.amountCents,
            currency: order.currency,
            inGameName: order.inGameName,
            playerId: order.playerId,
          }).catch((err) => console.error("Notification failed:", err));
        } else {
          await rejectPayment(String(orderId));
          await ledgerEntry({
            orderId: String(orderId),
            type: "fee",
            amountCents: 0,
            currency,
            relatedPaymentId: providerRef,
          });
          // Notify customer (fire-and-forget)
          notifyCustomer(order.customerId, "payment_rejected", {
            id: order.id,
            productId: order.productId,
            amountCents: order.amountCents,
            currency: order.currency,
            inGameName: order.inGameName,
            playerId: order.playerId,
            reason: "PayFast payment failed or cancelled",
          }).catch((err) => console.error("Notification failed:", err));
        }

    return ok({ received: true });
  } catch (err) {
    return fail(err);
  }
}
