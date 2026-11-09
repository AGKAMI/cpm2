/**
 * VANTA GARAGE — EFT proof upload.
 * POST /api/store/checkout/[productId]/proof — Upload EFT proof of payment for an order.
 *
 * Body: { orderId: string, proofUrl: string }
 * Admin-gated: only the customer who owns the order can upload proof for it.
 */

import { fail, ok, readJson } from "@/lib/route";
import { getStoreCustomer } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { assertTelegramAuth } from "@/lib/telegram";
import { getCustomerByPlatformIdentity } from "@/lib/store/customers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const telegramUserId = await assertTelegramAuth(request);
    if (telegramUserId === null) {
      return fail({ status: 401, body: { error: { code: "not_authenticated", message: "Telegram authentication required." } } });
    }

    const body = (await readJson(request)) as Record<string, unknown>;
    const { orderId, proofUrl } = body;

    if (!orderId || !proofUrl) {
      return fail({ status: 400, body: { error: { code: "missing_fields", message: "orderId and proofUrl required." } } });
    }

    const db = await getStoreDb();
    const result = await db.execute({
      sql: `SELECT * FROM vanta_orders WHERE id = ?`,
      args: [orderId],
    });

    if (result.rows.length === 0) {
      return fail({ status: 404, body: { error: { code: "order_not_found", message: "Order not found." } } });
    }

    const order = result.rows[0];

    // Verify ownership: only the customer who owns the order can upload proof
    const customer = await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
    if (!customer || customer.customer.id !== Number(order.customer_id)) {
      return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
    }

    // Update order with proof URL
    await db.execute({
      sql: `UPDATE vanta_orders SET eft_proof_url = ?, updated_at = ? WHERE id = ?`,
      args: [proofUrl, new Date().toISOString(), orderId],
    });

    return ok({ orderId, proofUrl, message: "EFT proof uploaded successfully. Awaiting admin verification." });
  } catch (err) {
    return fail(err);
  }
}