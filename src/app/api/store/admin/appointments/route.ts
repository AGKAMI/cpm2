/** VANTA GARAGE — admin appointments list.
 * GET /api/store/admin/appointments — all delivery appointments for admin.
 */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const db = await getStoreDb();

    const result = await db.execute({
      sql: `SELECT a.id, a.order_id, a.customer_id, a.scheduled_at, a.status,
                 a.delivery_evidence, a.customer_confirmed,
                 c.in_game_name, p.name as product_name
          FROM vanta_appointments a
          JOIN vanta_orders o ON a.order_id = o.id
          JOIN vanta_customers c ON o.customer_id = c.id
          JOIN vanta_products p ON o.product_id = p.id
          ORDER BY a.scheduled_at DESC`,
      args: [],
    });

    return ok({
      appointments: result.rows.map((row) => ({
        id: String(row.id),
        orderId: String(row.order_id),
        customerId: Number(row.customer_id),
        customerName: String(row.in_game_name),
        productName: String(row.product_name),
        scheduledAt: String(row.scheduled_at),
        status: String(row.status),
        deliveryEvidence: row.delivery_evidence ? String(row.delivery_evidence) : null,
        customerConfirmed: Number(row.customer_confirmed ?? 0) === 1,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
