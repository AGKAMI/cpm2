/** VANTA GARAGE — owner stats API.
 * GET /api/store/owner/stats — store-wide stats for the owner dashboard.
 * Owner-gated via requireStoreAdmin (isOwner check).
 */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "../../../../../lib/store-db.ts";

export const dynamic = "force-dynamic";

async function scalar(db: Awaited<ReturnType<typeof getStoreDb>>, sql: string, args: unknown[] = []): Promise<number> {
  const result = await db.execute({ sql, args });
  const row = result.rows[0] as Record<string, unknown>;
  return Number(row?.value ?? row?.count ?? 0);
}

export async function GET(request: Request) {
  try {
    const status = await requireStoreAdmin(request);
    if (!status.isOwner) {
      return fail({
        status: 403,
        body: { error: { code: "OWNER_ONLY", message: "Only the owner can view store stats." } },
      });
    }
    const db = await getStoreDb();

    const totalCustomers = await scalar(db, `SELECT COUNT(*) AS value FROM vanta_customers`);
    const totalOrders = await scalar(db, `SELECT COUNT(*) AS value FROM vanta_orders`);
    const totalRevenue = await scalar(
      db,
      `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM vanta_orders WHERE payment_state = 'verified'`
    );
    const totalAdmins = await scalar(db, `SELECT COUNT(*) AS value FROM vanta_admins WHERE is_active = 1`);
    const totalProducts = await scalar(db, `SELECT COUNT(*) AS value FROM vanta_products WHERE is_published = 1`);
    const verifiedOrders = await scalar(
      db,
      `SELECT COUNT(*) AS value FROM vanta_orders WHERE payment_state = 'verified'`
    );

    return ok({
      totalCustomers,
      totalOrders,
      totalRevenueCents: totalRevenue,
      totalAdmins,
      totalProducts,
      verifiedOrders,
    });
  } catch (err) {
    return fail(err);
  }
}
