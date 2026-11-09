/**
 * VANTA GARAGE — admin analytics revenue.
 * GET /api/store/admin/analytics/revenue — aggregated revenue metrics.
 * Admin-gated via requireStoreAdmin.
 */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const db = await getStoreDb();

    const totalRevenue = await db.execute({
      sql: `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM vanta_orders WHERE payment_state = 'verified'`,
      args: [],
    });
    const verifiedOrders = await db.execute({
      sql: `SELECT COUNT(*) AS value FROM vanta_orders WHERE payment_state = 'verified'`,
      args: [],
    });
    const pendingOrders = await db.execute({
      sql: `SELECT COUNT(*) AS value FROM vanta_orders WHERE order_state = 'awaiting_payment'`,
      args: [],
    });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRevenue = await db.execute({
      sql: `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM vanta_orders WHERE payment_state = 'verified' AND created_at >= ?`,
      args: [todayStart.toISOString()],
    });

    const revenueRow = totalRevenue.rows[0] as Record<string, unknown>;
    const verifiedRow = verifiedOrders.rows[0] as Record<string, unknown>;
    const pendingRow = pendingOrders.rows[0] as Record<string, unknown>;
    const todayRow = todayRevenue.rows[0] as Record<string, unknown>;

    return ok({
      totalRevenueCents: Number(revenueRow?.value ?? 0),
      verifiedOrders: Number(verifiedRow?.value ?? 0),
      pendingOrders: Number(pendingRow?.value ?? 0),
      todayRevenueCents: Number(todayRow?.value ?? 0),
    });
  } catch (err) {
    return fail(err);
  }
}
