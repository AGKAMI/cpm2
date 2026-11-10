/** VANTA GARAGE — customer confirm delivery.
 * POST /api/store/appointments/[id]/confirm — customer confirms receipt.
 */

import { fail, ok } from "@/lib/route";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken);

  if (!sessionUserId) {
    return fail({ status: 401, body: { error: { code: "UNAUTHORIZED", message: "Not authorized" } } });
  }

  try {
    const db = await getStoreDb();

    // Verify the appointment belongs to this customer's order
    const result = await db.execute({
      sql: `SELECT a.id, a.customer_confirmed, o.customer_id
            FROM vanta_appointments a
            JOIN vanta_orders o ON a.order_id = o.id
            WHERE a.id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return fail({ status: 404, body: { error: { code: "NOT_FOUND", message: "Appointment not found" } } });
    }

    const row = result.rows[0];
    if (Number(row.customer_id) !== sessionUserId) {
      return fail({ status: 403, body: { error: { code: "FORBIDDEN", message: "Not your appointment" } } });
    }

    if (Number(row.customer_confirmed ?? 0) === 1) {
      return fail({ status: 400, body: { error: { code: "ALREADY_CONFIRMED", message: "Already confirmed" } } });
    }

    await db.execute({
      sql: `UPDATE vanta_appointments SET customer_confirmed = 1, updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), id],
    });

    // Update order delivery state to completed
    await db.execute({
      sql: `UPDATE vanta_orders SET delivery_state = 'completed', order_state = 'completed', updated_at = ? WHERE id IN (
              SELECT order_id FROM vanta_appointments WHERE id = ?)`,
      args: [new Date().toISOString(), id],
    });

    return ok({ confirmed: true });
  } catch (err) {
    return fail(err);
  }
}
