/***
 * VANTA GARAGE — admin reject EFT payment.
 * POST /api/store/admin/orders/[id]/reject-payment
 * Admin-gated via requireStoreAdmin.
 * Releases reserved stock, marks payment rejected, order cancelled.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { rejectPayment, getOrder } from "@/lib/store/checkout";
import { notifyCustomer } from "@/lib/store/notifications";
import { z } from "zod";

const rejectSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStoreAdmin(request);
    const { id } = await params;
    const body = rejectSchema.parse(await readJson(request));

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
          error: { code: "not_eft", message: "Only EFT payments can be manually rejected." },
        },
      });
    }

    await rejectPayment(id);
    // Notify customer (fire-and-forget, don't block response)
    notifyCustomer(order.customerId, "payment_rejected", {
      id: order.id,
      productId: order.productId,
      amountCents: order.amountCents,
      currency: order.currency,
      inGameName: order.inGameName,
      playerId: order.playerId,
      reason: body.reason ?? undefined,
    }).catch((err) => console.error("Notification failed:", err));
    return ok({
      orderId: id,
      paymentState: "rejected",
      orderState: "cancelled",
      reason: body.reason ?? null,
    });
  } catch (err) {
    return fail(err);
  }
}
