/**
 * VANTA GARAGE — PayFast webhook.
 * POST /api/store/payments/payfast/webhook
 * Verifies PayFast webhook signature, confirms payment server-side,
 * advances order state to payment_confirmed.
 */

import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api";
import { fail, ok } from "@/lib/route";
import { payfastSignature } from "@/lib/store/payfast-signature.ts";
import { confirmPayment, getOrder, rejectPayment } from "@/lib/store/checkout";
import { getPaymentsForOrder, recordPayment } from "@/lib/store/payments";
import { ledgerEntry, listLedgerEntries } from "@/lib/store/ledger";
import { ensureSettlementRecords } from "@/lib/store/settlement.ts";
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

export async function POST(request: Request) {
  try {
    if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY || !PAYFAST_PASSPHRASE) {
      throw new ApiError(500, "PAYFAST_NOT_CONFIGURED", "PayFast payments are not available.");
    }

    const body = await readItnBody(request);

    const signature = body.signature ?? "";
    const expected = payfastSignature(body, PAYFAST_PASSPHRASE);
    if (
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new ApiError(401, "INVALID_SIGNATURE", "Invalid PayFast signature");
    }

    // A valid signature alone only proves the message was signed with SOME
    // PayFast account. Without this check, anyone who can sign with their own
    // passphrase could mark an order paid for R0.
    if ((body.merchant_id ?? "").trim() !== PAYFAST_MERCHANT_ID.trim()) {
      throw new ApiError(401, "INVALID_MERCHANT", "PayFast merchant ID does not match.");
    }

    const orderId = body.custom_str1 || body.m_payment_id;
    if (!orderId) {
      throw new ApiError(400, "INVALID_WEBHOOK", "No order reference in webhook");
    }
    const order = await getOrder(String(orderId));
    if (!order) {
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (order.paymentState === "verified") {
      // Repair a half-written settlement (state flipped, payment/ledger write
      // lost) instead of leaving the audit trail permanently incomplete.
      await ensureSettlementRecords({
        order,
        provider: "payfast",
        providerRef: String(body.m_payment_id ?? ""),
      });
      return ok({ received: true }); // idempotent
    }

    const amountCents = Math.round(Number(body.amount_gross ?? 0) * 100);
    const currency = "ZAR";
    const providerRef = String(body.m_payment_id ?? "");
    const completed = body.payment_status === "COMPLETED";

    // Amount integrity: webhook amount must match order amount exactly
    if (amountCents !== order.amountCents) {
      // Keep the numbers in server logs, not in a client-visible error payload.
      console.error(
        "[cpm2] PayFast amount mismatch for order %s: got %s cents, expected %s cents",
        order.id,
        amountCents,
        order.amountCents,
      );
      throw new ApiError(400, "AMOUNT_MISMATCH", "Payment amount does not match the order.");
    }

    if (completed) {
      // The shared race-safe path: one-shot state flip + stock deduction,
      // followed by idempotent payment/ledger bookkeeping. A retry after a
      // partial failure repairs the missing rows without double-counting.
      await confirmPayment(String(orderId));
      await ensureSettlementRecords({
        order,
        provider: "payfast",
        providerRef,
      });
      notifyCustomer(order.customerId, "payment_confirmed_payfast", {
        id: order.id,
        productId: order.productId,
        amountCents: order.amountCents,
        currency: order.currency,
        inGameName: order.inGameName,
        playerId: order.playerId,
      }).catch((err) => console.error("Notification failed:", err));
    } else {
      const priorAttempts = await getPaymentsForOrder(String(orderId));
      if (!priorAttempts.some((p) => p.status === "rejected" && p.providerRef === providerRef)) {
        await recordPayment({
          orderId: String(orderId),
          provider: "payfast",
          providerRef,
          amountCents,
          currency,
          status: "rejected",
        });
      }
      await rejectPayment(String(orderId));
      const priorFees = await listLedgerEntries({ orderId: String(orderId) });
      if (!priorFees.some((entry) => entry.type === "fee" && entry.relatedPaymentId === providerRef)) {
        await ledgerEntry({
          orderId: String(orderId),
          type: "fee",
          amountCents: 0,
          currency,
          relatedPaymentId: providerRef,
        });
      }
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
