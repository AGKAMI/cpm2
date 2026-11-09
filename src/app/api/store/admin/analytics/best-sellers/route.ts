/**
 * VANTA GARAGE — admin analytics best sellers.
 * GET /api/store/admin/analytics/best-sellers — top products by units sold.
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

    const limit = 10;
    const result = await db.execute({
      sql: `
        SELECT p.id, p.name, p.base_price_cents, p.currency,
               SUM(o.quantity) AS units_sold,
               COALESCE(SUM(o.amount_cents), 0) AS revenue_cents
        FROM vanta_orders o
        JOIN vanta_products p ON o.product_id = p.id
        WHERE o.payment_state = 'verified'
        GROUP BY p.id, p.name, p.base_price_cents, p.currency
        ORDER BY units_sold DESC
        LIMIT ?
      `,
      args: [limit],
    });

    const bestSellers = result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ""),
      basePriceCents: Number(row.base_price_cents ?? 0),
      currency: String(row.currency ?? "ZAR"),
      unitsSold: Number(row.units_sold ?? 0),
      revenueCents: Number(row.revenue_cents ?? 0),
    }));

    return ok({ bestSellers });
  } catch (err) {
    return fail(err);
  }
}
