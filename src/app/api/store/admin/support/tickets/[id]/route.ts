/**
 * VANTA GARAGE — support ticket update (admin).
 * PATCH /api/store/admin/support/tickets/[id] — update ticket status/reply.
 * Admin-gated via requireStoreAdmin.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { z } from "zod";

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  adminReply: z.string().max(2000).optional(),
});

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStoreAdmin(request);
    const db = await getStoreDb();

    const { id } = await params;
    const ticketId = Number(id);
    if (!ticketId) {
      return fail({ status: 400, body: { error: { code: "missing_id", message: "Ticket id required." } } });
    }

    const body = updateTicketSchema.parse(await readJson(request));
    const now = new Date().toISOString();

    // Check ticket exists
    const existing = await db.execute({
      sql: `SELECT id FROM vanta_support_tickets WHERE id = ?`,
      args: [ticketId],
    });
    if (existing.rows.length === 0) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Ticket not found." } } });
    }

    const updates: string[] = [];
    const args: unknown[] = [];

    if (body.status !== undefined) {
      updates.push(`status = ?`);
      args.push(body.status);
    }
    if (body.priority !== undefined) {
      updates.push(`priority = ?`);
      args.push(body.priority);
    }
    if (body.adminReply !== undefined) {
      updates.push(`admin_reply = ?`);
      args.push(body.adminReply);
    }
    if (body.status === "resolved" || body.status === "closed") {
      updates.push(`resolved_at = ?`);
      args.push(now);
    }
    updates.push(`updated_at = ?`);
    args.push(now);
    args.push(ticketId);

    await db.execute({
      sql: `UPDATE vanta_support_tickets SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    return ok({ updated: true });
  } catch (err) {
    return fail(err);
  }
}
