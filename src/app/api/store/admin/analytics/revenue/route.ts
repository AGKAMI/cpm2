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

    // A verified payment on a REFUNDED or CANCELLED order is not revenue —
    // the old query counted it (and inflated "verified orders" with it).
    const REVENUE_GUARD = `payment_state = 'verified' AND order_state NOT IN ('refunded', 'refund_pending', 'cancelled', 'disputed')`;
    const totalRevenue = await db.execute({
      sql: `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM vanta_orders WHERE ${REVENUE_GUARD}`,
      args: [],
    });
    const verifiedOrders = await db.execute({
      sql: `SELECT COUNT(*) AS value FROM vanta_orders WHERE ${REVENUE_GUARD}`,
      args: [],
    });
    const pendingOrders = await db.execute({
      sql: `SELECT COUNT(*) AS value FROM vanta_orders WHERE order_state = 'awaiting_payment'`,
      args: [],
    });
    // "Today" must be the SAST day the operator is looking at, not the
    // server's local day: created_at is UTC ISO, and the old code compared it
    // against a server-local midnight, shifting the boundary by hours.
    const SAST_OFFSET_MINUTES = 120;
    const now = new Date();
    const saastNow = new Date(now.getTime() + SAST_OFFSET_MINUTES * 60_000);
    const sastMidnight = Date.UTC(
      saastNow.getUTCFullYear(),
      saastNow.getUTCMonth(),
      saastNow.getUTCDate(),
      0, 0, 0, 0,
    );
    const todayStartIso = new Date(sastMidnight - SAST_OFFSET_MINUTES * 60_000).toISOString();
    const todayRevenue = await db.execute({
      sql: `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM vanta_orders WHERE ${REVENUE_GUARD} AND created_at >= ?`,
      args: [todayStartIso],
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
