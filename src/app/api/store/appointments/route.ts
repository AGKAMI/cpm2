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

    const result = await db.execute({
      sql: `
        INSERT INTO vanta_appointments (order_id, scheduled_at, admin_platform, admin_user_id, status, created_at)
        VALUES (?, ?, 'telegram', ?, 'scheduled', ?)
      `,
      args: [body.orderId, body.scheduledAt, "telegram", String(customer.customer.id), now],
    });

    if (result.lastInsertRowid === null) {
      return fail({ status: 500, body: { error: { code: "insert_failed", message: "Could not create appointment." } } });
    }

    return ok({ id: String(result.lastInsertRowid), status: "scheduled" }, 201);
  } catch (err) {
    return fail(err);
  }
}
