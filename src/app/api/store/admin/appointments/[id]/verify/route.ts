/*** VANTA GARAGE — admin verify delivery.
 * POST /api/store/admin/appointments/[id]/verify
 * Admin marks a scheduled delivery appointment as completed.
 *
 * This is the endpoint the admin deliveries page's "Verify Delivery"
 * button always needed: it used to POST the appointment id at the
 * order delivery-evidence route (which expects an order id AND an
 * evidence URL body), so verifying a delivery could only ever fail,
 * and nothing anywhere ever moved an appointment to 'completed'.
 */

import { fail, ok } from "@/lib/route";
import { getStoreDb } from "@/lib/store-db";
import { requireStoreAdmin } from "@/lib/store/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStoreAdmin(request);
    const { id } = await params;
    const db = await getStoreDb();

    const result = await db.execute({
      sql: `SELECT a.id, a.status, o.id AS order_id, o.payment_state
            FROM vanta_appointments a
            JOIN vanta_orders o ON a.order_id = o.id
            WHERE a.id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return fail({
        status: 404,
        body: { error: { code: "NOT_FOUND", message: "Appointment not found." } },
      });
    }

    const row = result.rows[0];
    // Idempotent: re-verifying a completed delivery is a no-op success,
    // not an error — the admin's intent is already satisfied.
    if (String(row.status) === "completed") {
      return ok({ appointmentId: id, status: "completed", verified: true });
    }

    // Same rule as the customer confirm: an unpaid order cannot be
    // marked delivered, whatever surface asks.
    if (String(row.payment_state) !== "verified") {
      return fail({
        status: 409,
        body: {
          error: {
            code: "PAYMENT_NOT_VERIFIED",
            message: "Payment is not verified yet — this delivery cannot be verified.",
          },
        },
      });
    }

    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE vanta_appointments SET status = 'completed', updated_at = ? WHERE id = ?`,
      args: [now, id],
    });

    // Mirror the customer-confirm completion so order views agree
    // whichever side closes the delivery out.
    await db.execute({
      sql: `UPDATE vanta_orders SET delivery_state = 'completed', order_state = 'completed', updated_at = ? WHERE id = ?`,
      args: [now, String(row.order_id)],
    });

    return ok({ appointmentId: id, status: "completed", verified: true });
  } catch (err) {
    return fail(err);
  }
}
