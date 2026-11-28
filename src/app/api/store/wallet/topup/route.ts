/**
 * VANTA GARAGE — wallet top-up API.
 * POST /api/store/wallet/topup { amountCents } → a pending ledger row and the
 * PayFast redirect URL. The ITN webhook credits the balance when payment
 * clears (custom_str1 "W-<txnId>" routes it to the wallet, not an order).
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { buildPayFastTopupUrl } from "@/lib/store/payfast";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TOPUP_MIN_CENTS = 1000; // R10
const TOPUP_MAX_CENTS = 100000; // R1000 per top-up

const topupSchema = z.object({
  amountCents: z.coerce
    .number()
    .int()
    .min(TOPUP_MIN_CENTS, "Minimum top-up is R10")
    .max(TOPUP_MAX_CENTS, "Maximum top-up is R1000"),
});

export async function POST(request: Request) {
  try {
    const { customer } = await requireStoreCustomer(request);
    const body = topupSchema.parse(await readJson(request));
    const db = await getStoreDb();
    const now = new Date().toISOString();

    // The pending ledger row IS the top-up order: no payment, no balance.
    const inserted = await db.execute({
      sql: `INSERT INTO vanta_wallet_txns
              (customer_id, type, amount_cents, balance_after_cents, status, reference, note, created_at)
            VALUES (?, 'topup', ?, 0, 'pending', ?, ?, ?)`,
      args: [customer.id, body.amountCents, null, "Wallet top-up (awaiting payment)", now],
    });
    const txnId = inserted.lastInsertRowid;
    if (txnId === null) {
      return fail({ status: 500, body: { error: { code: "insert_failed", message: "Could not start the top-up." } } });
    }

    const origin = new URL(request.url).origin;
    const { url, configured } = buildPayFastTopupUrl({
      txnId: String(txnId),
      amountCents: body.amountCents,
      returnUrl: `${origin}/store/wallet?topup=pending`,
      cancelUrl: `${origin}/store/wallet?topup=cancelled`,
      notifyUrl: `${origin}/api/store/payments/payfast/webhook`,
    });
    if (!configured) {
      return fail({
        status: 503,
        body: { error: { code: "payfast_unconfigured", message: "Card payments are not available right now." } },
      });
    }

    return ok({ redirectUrl: url, txnId: String(txnId) }, 201);
  } catch (err) {
    return fail(err);
  }
}
