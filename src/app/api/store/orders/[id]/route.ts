/**
 * VANTA GARAGE — order detail API.
 * GET /api/store/orders/[id]
 */

import { fail, ok } from "@/lib/route";
import { assertTelegramAuth } from "@/lib/telegram";
import { getStoreCustomer } from "@/lib/store/auth";
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
    // Ownership: Telegram customer link, or web-guest player id match.
    const telegramUserId = await assertTelegramAuth(request);
    if (telegramUserId !== null) {
      const linked = await getStoreCustomer(request);
      if (linked && order.customerId === linked.customer.id) {
        return ok({ order });
      }
      return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
    }
    const url = new URL(request.url);
    const playerId = url.searchParams.get("playerId")?.trim();
    if (playerId && order.playerId === playerId) {
      return ok({ order });
    }
    return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
  } catch (err) {
    return fail(err);
  }
}
