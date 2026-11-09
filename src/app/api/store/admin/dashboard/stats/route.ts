/** VANTA GARAGE — admin dashboard stats API.
 * GET /api/store/admin/dashboard/stats — aggregated business indicators.
 * Admin-gated via requireStoreAdmin.
 */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "../../../../../../lib/store-db.ts";

export const dynamic = "force-dynamic";

async function scalar(db: Awaited<ReturnType<typeof getStoreDb>>, sql: string, args: unknown[] = []): Promise<number> {
  const result = await db.execute({ sql, args });
  const row = result.rows[0] as Record<string, unknown>;
  return Number(row?.value ?? row?.count ?? 0);
}

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const db = await getStoreDb();

    const totalOrders = await scalar(db, `SELECT COUNT(*) AS value FROM vanta_orders`);
    const totalRevenue = await scalar(
      db,
      `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM vanta_orders WHERE payment_state = 'verified'`
    );
    const pendingOrders = await scalar(
      db,
      `SELECT COUNT(*) AS value FROM vanta_orders WHERE order_state = 'awaiting_payment'`
    );
    const verifiedOrders = await scalar(
      db,
      `SELECT COUNT(*) AS value FROM vanta_orders WHERE payment_state = 'verified'`
    );
    const rejectedPayments = await scalar(
      db,
      `SELECT COUNT(*) AS value FROM vanta_orders WHERE payment_state = 'rejected'`
    );
    const totalProducts = await scalar(db, `SELECT COUNT(*) AS value FROM vanta_products WHERE is_published = 1`);
    const lowStockProducts = await scalar(
      db,
      `SELECT COUNT(*) AS value FROM vanta_products WHERE is_published = 1 AND stock_quantity <= 2`
    );
    const outOfStockProducts = await scalar(
      db,
      `SELECT COUNT(*) AS value FROM vanta_products WHERE is_published = 1 AND stock_quantity = 0`
    );

    return ok({
      totalOrders,
      totalRevenueCents: totalRevenue,
      pendingOrders,
      verifiedOrders,
      rejectedPayments,
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
    });
  } catch (err) {
    return fail(err);
  }
}
