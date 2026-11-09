/**
 * VANTA GARAGE — support tickets (admin).
 * GET    /api/store/admin/support/tickets — list all tickets (admin-gated).
 * POST   /api/store/admin/support/tickets — create a ticket (admin-gated).
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { z } from "zod";

const createTicketSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const db = await getStoreDb();

    const result = await db.execute({
      sql: `
        SELECT t.id, t.customer_id, t.subject, t.message, t.status, t.priority,
               t.admin_reply, t.resolved_at, t.created_at, t.updated_at,
               c.in_game_name, c.player_id
        FROM vanta_support_tickets t
        JOIN vanta_customers c ON t.customer_id = c.id
        ORDER BY t.created_at DESC
      `,
      args: [],
    });

    const tickets = result.rows.map((row) => ({
      id: Number(row.id),
      customerId: Number(row.customer_id),
      subject: String(row.subject ?? ""),
      message: String(row.message ?? ""),
      status: String(row.status ?? "open"),
      priority: String(row.priority ?? "medium"),
      adminReply: row.admin_reply ? String(row.admin_reply) : null,
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      customer: {
        inGameName: String(row.in_game_name ?? ""),
        playerId: String(row.player_id ?? ""),
      },
    }));

    return ok({ tickets });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const db = await getStoreDb();

    const body = createTicketSchema.parse(await readJson(request));
    const now = new Date().toISOString();

    const result = await db.execute({
      sql: `
        INSERT INTO vanta_support_tickets (customer_id, subject, message, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'open', ?, ?)
      `,
      args: [body.customerId, body.subject, body.message, body.priority, now, now],
    });

    if (result.lastInsertRowid === null) {
      return fail({ status: 500, body: { error: { code: "insert_failed", message: "Could not create ticket." } } });
    }

    return ok({ id: Number(result.lastInsertRowid) }, 201);
  } catch (err) {
    return fail(err);
  }
}
