/**
 * VANTA GARAGE — PayFast webhook.
 * POST /api/store/payments/payfast/webhook
 * Verifies PayFast webhook signature, confirms payment server-side,
 * advances order state to payment_confirmed.
 */

import { fail, ok, readJson } from "@/lib/route";
import { createHash, timingSafeEqual } from "node:crypto";
import { updatePaymentState, updateOrderState, getOrder } from "@/lib/store/checkout";
import { recordPayment } from "@/lib/store/payments";
import { ledgerEntry } from "@/lib/store/ledger";
import { notifyCustomer } from "@/lib/store/notifications";

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE;

type PayFastBody = {
  signature?: string;
  m_payment_id?: string;
  amount_gross?: string | number;
  payment_status?: string;
  custom_str1?: string;
  [key: string]: unknown;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY || !PAYFAST_PASSPHRASE) {
      throw new Error("PayFast not configured on the server.");
    }

    const body = (await readJson(request)) as PayFastBody;

    // Verify PayFast signature: MD5 of sorted param string + passphrase
    const signature = body.signature;
    const dataString = Object.keys(body)
      .filter((k) => k !== "signature")
      .sort()
      .map((k) => `${k}=${body[k]}`)
      .join("&");

    const expected = createHash("md5")
      .update(`${dataString}${PAYFAST_PASSPHRASE}`)
      .digest("hex");

    if (!signature || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new Error("Invalid PayFast signature");
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
      status: body.payment_status === "COMPLETED" ? "verified" : "rejected",
    });

    if (body.payment_status === "COMPLETED") {
          await updatePaymentState(orderId, "verified");
          await updateOrderState(orderId, "payment_confirmed");
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
          await updatePaymentState(orderId, "rejected");
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
