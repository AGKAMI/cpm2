/**
 * VANTA GARAGE — customer appointments.
 * POST /api/store/appointments — schedule a delivery appointment.
 * Customer-gated via requireStoreCustomer.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { z } from "zod";

const appointmentSchema = z.object({
  orderId: z.string().min(1),
  scheduledAt: z.string().datetime(),
});

export const dynamic = "force-dynamic";

/**
 * The caller's delivery appointments, newest first — the appointments page
 * has always fetched this, but the route only ever implemented POST, so
 * the page silently rendered "No upcoming deliveries" forever.
 */
export async function GET(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();
    const result = await db.execute({
      sql: `SELECT a.id, a.order_id, a.scheduled_at, a.status, a.delivery_evidence,
                   a.customer_confirmed, o.product_name
              FROM vanta_appointments a
              JOIN vanta_orders o ON o.id = a.order_id
             WHERE o.customer_id = ?
             ORDER BY a.scheduled_at DESC`,
      args: [customer.customer.id],
    });
    const appointments = result.rows.map((row) => ({
      id: String(row.id),
      orderId: String(row.order_id),
      productName: String(row.product_name ?? ""),
      scheduledAt: String(row.scheduled_at ?? ""),
      status: String(row.status ?? "scheduled"),
      deliveryEvidence: row.delivery_evidence === null ? null : String(row.delivery_evidence),
      customerConfirmed: Number(row.customer_confirmed ?? 0) === 1,
    }));
    return ok({ appointments });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const body = appointmentSchema.parse(await readJson(request));
    const now = new Date().toISOString();

    // Verify order belongs to customer
    const order = await db.execute({
      sql: `SELECT id, customer_id FROM vanta_orders WHERE id = ?`,
      args: [body.orderId],
    });
    if (order.rows.length === 0) {
      return fail({ status: 404, body: { error: { code: "order_not_found", message: "Order not found." } } });
    }
    if (Number(order.rows[0].customer_id) !== customer.customer.id) {
      return fail({ status: 403, body: { error: { code: "forbidden", message: "Not your order." } } });
    }

    // vanta_appointments.id is a TEXT primary key with no autoincrement —
    // inserting without one left a NULL id that the confirm route could
    // never match, so the appointment existed but could never complete.
    const appointmentId = `APT_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await db.execute({
      sql: `
        INSERT INTO vanta_appointments (id, order_id, scheduled_at, admin_platform, admin_user_id, status, created_at, updated_at)
        VALUES (?, ?, ?, 'telegram', ?, 'scheduled', ?, ?)
      `,
      args: [appointmentId, body.orderId, body.scheduledAt, String(customer.customer.id), now, now],
    });

    return ok({ id: appointmentId, status: "scheduled" }, 201);
  } catch (err) {
    return fail(err);
  }
}
