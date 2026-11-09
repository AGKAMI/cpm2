/**
 * VANTA GARAGE — customer support ticket creation.
 * POST /api/store/support/tickets — create a support ticket.
 * Customer-gated via requireStoreCustomer.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { z } from "zod";

const createTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const body = createTicketSchema.parse(await readJson(request));
    const now = new Date().toISOString();

    const result = await db.execute({
      sql: `
        INSERT INTO vanta_support_tickets (customer_id, subject, message, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'open', ?, ?)
      `,
      args: [customer.customer.id, body.subject, body.message, body.priority, now, now],
    });

    if (result.lastInsertRowid === null) {
      return fail({ status: 500, body: { error: { code: "insert_failed", message: "Could not create ticket." } } });
    }

    return ok({ id: Number(result.lastInsertRowid), status: "open" }, 201);
  } catch (err) {
    return fail(err);
  }
}
