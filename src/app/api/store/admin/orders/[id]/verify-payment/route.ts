/***
 * VANTA GARAGE — admin verify EFT payment.
 * POST /api/store/admin/orders/[id]/verify-payment
 * Admin-gated via requireStoreAdmin.
 * Confirms EFT payment server-side: deducts stock, advances order to payment_confirmed.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { confirmPayment, getOrder } from "@/lib/store/checkout";
import { ensureSettlementRecords } from "@/lib/store/settlement.ts";
import { notifyCustomer } from "@/lib/store/notifications";
import { z } from "zod";

const verifySchema = z.object({
  orderId: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStoreAdmin(request);
    const { id } = await params;
    const body = verifySchema.parse(await readJson(request));

    if (body.orderId !== id) {
      return fail({
        status: 400,
        body: { error: { code: "id_mismatch", message: "Order ID mismatch." } },
      });
    }

    const order = await getOrder(id);
    if (!order) {
      return fail({
        status: 404,
        body: { error: { code: "order_not_found", message: "Order not found." } },
      });
    }
    if (order.paymentMethod !== "eft") {
      return fail({
        status: 400,
        body: {
          error: { code: "not_eft", message: "Only EFT payments can be manually verified." },
        },
      });
    }

    if (order.paymentState === "verified") {
      // A prior request may have flipped payment_state and then died before
      // the order-state write or the audit rows. Re-run the same repair path a
      // retry is supposed to take instead of returning the stale state.
      await confirmPayment(id);
      await ensureSettlementRecords({
        order,
        provider: "eft",
        providerRef: `manual:${id}`,
      });
      const repaired = (await getOrder(id)) ?? order;
      return ok({ orderId: id, paymentState: "verified", orderState: repaired.orderState });
    }

    await confirmPayment(id);
    // Keep the payment + ledger record consistent with the other settlement
    // paths (PayFast ITN and Telegram Stars), so refund/audit reporting can
    // see how an EFT order was settled.
    await ensureSettlementRecords({
      order,
      provider: "eft",
      providerRef: `manual:${id}`,
    });
    // Notify customer (fire-and-forget, don't block response)
    notifyCustomer(order.customerId, "payment_verified", {
      id: order.id,
      productId: order.productId,
      amountCents: order.amountCents,
      currency: order.currency,
      inGameName: order.inGameName,
      playerId: order.playerId,
    }).catch((err) => console.error("Notification failed:", err));
    return ok({ orderId: id, paymentState: "verified", orderState: "payment_confirmed" });
  } catch (err) {
    return fail(err);
  }
}
