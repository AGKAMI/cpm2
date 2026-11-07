/**
 * VANTA GARAGE — orders API.
 * GET /api/store/orders — customer's orders
 * GET /api/store/orders/[id] — single order
 */

import { fail, ok } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { listOrders, getOrder } from "@/lib/store/checkout";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      const order = await getOrder(id);
      if (!order) {
        return fail({ status: 404, body: { error: { code: "order_not_found", message: "Order not found." } } });
      }
      if (order.customerId !== customer.customer.id) {
        return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
      }
      return ok({ order });
    }

    const orders = await listOrders({ customerId: customer.customer.id });
    return ok({ orders });
  } catch (err) {
    return fail(err);
  }
}
