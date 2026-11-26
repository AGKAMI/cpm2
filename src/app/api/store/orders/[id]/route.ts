/**
 * VANTA GARAGE — order detail API.
 * GET /api/store/orders/[id]
 *
 * Authorization is identical to /api/store/orders?id=…: a signed store
 * session for the buyer, the per-order capability returned at checkout, or a
 * store admin. A player id in the query string is never an identity claim.
 */

import { fail, ok } from "@/lib/route";
import { canAccessOrder, requireStoreAdmin } from "@/lib/store/auth";
import { getOrder } from "@/lib/store/checkout";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await getOrder(id);
    if (!order) {
      return fail({ status: 404, body: { error: { code: "order_not_found", message: "Order not found." } } });
    }
    if (canAccessOrder(request, order)) return ok({ order });
    try {
      await requireStoreAdmin(request);
      return ok({ order });
    } catch {
      return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
    }
  } catch (err) {
    return fail(err);
  }
}
