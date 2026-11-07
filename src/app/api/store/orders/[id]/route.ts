/**
 * VANTA GARAGE — order detail API.
 * GET /api/store/orders/[id]
 */

import { fail, ok } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getOrder } from "@/lib/store/checkout";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const customer = await requireStoreCustomer(request);
    const { id } = await params;
    const order = await getOrder(id);
    if (!order) {
      return fail({ status: 404, body: { error: { code: "order_not_found", message: "Order not found." } } });
    }
    if (order.customerId !== customer.customer.id) {
      return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
    }
    return ok({ order });
  } catch (err) {
    return fail(err);
  }
}
