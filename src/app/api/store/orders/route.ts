/**
 * VANTA GARAGE — orders API.
 * GET /api/store/orders — customer's orders
 * GET /api/store/orders/[id] — single order
 */

import { fail, ok } from "@/lib/route";
import { assertTelegramAuth } from "@/lib/telegram";
import { getStoreCustomer } from "@/lib/store/auth";
import { getCustomerByPlayerId } from "@/lib/store/customers";
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
  { kind: "customerId"; value: number } | { kind: "playerId"; value: string } | null
> {
  const telegramUserId = await assertTelegramAuth(request);
  if (telegramUserId !== null) {
    const linked = await getStoreCustomer(request);
    if (linked) return { kind: "customerId", value: linked.customer.id };
  }
  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId")?.trim();
  if (playerId) {
    const customer = await getCustomerByPlayerId(playerId);
    if (customer) return { kind: "customerId", value: customer.id };
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      // Single order: verify ownership via telegram customer OR matching player id.
      const order = await getOrder(id);
      if (!order) {
        return fail({ status: 404, body: { error: { code: "order_not_found", message: "Order not found." } } });
      }
      const telegramUserId = await assertTelegramAuth(request);
      if (telegramUserId !== null) {
        const linked = await getStoreCustomer(request);
        if (linked && order.customerId === linked.customer.id) {
          return ok({ order });
        }
      } else {
        const playerId = url.searchParams.get("playerId")?.trim();
        if (playerId && order.playerId === playerId) {
          return ok({ order });
        }
      }
      return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
    }

    const scope = await resolveOrdersScope(request);
    if (!scope) {
      return fail({ status: 401, body: { error: { code: "NO_CUSTOMER", message: "No orders found for this identity." } } });
    }
    const orders =
      scope.kind === "customerId"
        ? await listOrders({ customerId: scope.value })
        : await listOrders({ playerId: scope.value });
    return ok({ orders });
  } catch (err) {
    return fail(err);
  }
}
