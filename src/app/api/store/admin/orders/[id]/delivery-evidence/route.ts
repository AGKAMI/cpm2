/***
 * VANTA GARAGE — admin delivery evidence.
 * POST /api/store/admin/orders/[id]/delivery-evidence
 * Admin-gated via requireStoreAdmin.
 * Admin uploads delivery evidence URL for an order (photo/screenshot link).
 * Creates appointment record if none exists, advances order to delivery_scheduled.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { setDeliveryEvidence, getOrder } from "@/lib/store/checkout";
import { notifyCustomer } from "@/lib/store/notifications";
import { z } from "zod";

const evidenceSchema = z.object({
  orderId: z.string().min(1),
  evidenceUrl: z.string().url("Invalid evidence URL"),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStoreAdmin(request);
    const { id } = await params;
    const body = evidenceSchema.parse(await readJson(request));

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

    await setDeliveryEvidence(id, body.evidenceUrl);
    // Notify customer (fire-and-forget, don't block response)
    notifyCustomer(order.customerId, "delivery_scheduled", {
      id: order.id,
      productId: order.productId,
      amountCents: order.amountCents,
      currency: order.currency,
      inGameName: order.inGameName,
      playerId: order.playerId,
      evidenceUrl: body.evidenceUrl,
    }).catch((err) => console.error("Notification failed:", err));
    return ok({
      orderId: id,
      deliveryEvidence: body.evidenceUrl,
      orderState: "delivery_scheduled",
    });
  } catch (err) {
    return fail(err);
  }
}
