/**
 * VANTA GARAGE — orders API.
 * GET /api/store/orders — customer's orders
 * GET /api/store/orders/[id] — single order
 */

import { fail, ok } from "@/lib/route";
import { canAccessOrder, getStoreCustomer, requireStoreAdmin } from "@/lib/store/auth";
import { listOrders, getOrder } from "@/lib/store/checkout";

export const dynamic = "force-dynamic";

/**
 * Resolve whose orders we're looking at:
 * - Telegram Mini App → the linked customer (full scoping).
 * - Any browser → the player id in the `playerId` query param, matched against
 *   a customer record (web checkouts identify guests by player id, so orders
 *   are scoped to that player, never the whole table).
 */
async function resolveOrdersScope(request: Request): Promise<
  { kind: "customerId"; value: number } | null
> {
  // SIGNED IDENTITIES ONLY. The playerId query fallback used to be enough:
  // order ids, amounts, products, player names and delivery state were
  // readable by anyone who guessed a playerId (short format, and visible in
  // order URLs). A guest's playerId is now exchanged for a signed session at
  // checkout, so reads come from the Telegram identity or the session cookie
  // — never a query param.
  const linked = await getStoreCustomer(request);
  if (linked) return { kind: "customerId", value: linked.customer.id };
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      const order = await getOrder(id);
      if (!order) {
        return fail({ status: 404, body: { error: { code: "order_not_found", message: "Order not found." } } });
      }
      // Signed identity, the per-order capability from checkout, or an admin.
      // A guessed player id is never enough.
      if (canAccessOrder(request, order)) return ok({ order });
      try {
        await requireStoreAdmin(request);
        return ok({ order });
      } catch {
        return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
      }
    }

    const scope = await resolveOrdersScope(request);
    if (!scope) {
      return fail({ status: 401, body: { error: { code: "NO_CUSTOMER", message: "No orders found for this identity." } } });
    }
    const orders = await listOrders({ customerId: scope.value });
    return ok({ orders });
  } catch (err) {
    return fail(err);
  }
}
