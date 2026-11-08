/***
 * VANTA GARAGE — admin verify EFT payment.
 * POST /api/store/admin/orders/[id]/verify-payment
 * Admin-gated via requireStoreAdmin.
 * Confirms EFT payment server-side: deducts stock, advances order to payment_confirmed.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { confirmPayment, getOrder } from "@/lib/store/checkout";
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

    await confirmPayment(id);
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
