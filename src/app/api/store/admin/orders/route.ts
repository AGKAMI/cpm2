/***
 * VANTA GARAGE — admin orders list.
 * GET /api/store/admin/orders — admin-gated, lists every order.
 * Admin-gated via requireStoreAdmin (Telegram owner id only).
 */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { listAllOrders } from "@/lib/store/checkout";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const orders = await listAllOrders();
    return ok({ orders });
  } catch (err) {
    return fail(err);
  }
}
