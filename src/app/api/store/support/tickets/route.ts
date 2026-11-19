/**
 * VANTA GARAGE — customer support tickets.
 * GET  /api/store/support/tickets — list the caller's tickets.
 * POST /api/store/support/tickets — create a support ticket.
 * Customer-gated via requireStoreCustomer.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { z } from "zod";

const createTicketSchema = z.object({
  category: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export const dynamic = "force-dynamic";

function ticketNumber(id: number): string {
  return `VNT-T-${String(id).padStart(4, "0")}`;
}

function categoryLabel(raw: string): string {
  if (!raw) return "Support";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export async function GET(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const result = await db.execute({
      sql: `
        SELECT id, subject, message, status, priority, admin_reply, resolved_at, created_at
        FROM vanta_support_tickets
        WHERE customer_id = ?
        ORDER BY created_at DESC
      `,
      args: [customer.customer.id],
    });

    const tickets = result.rows.map((row) => {
      const id = Number(row.id);
      return {
        id: String(id),
        ticketNumber: ticketNumber(id),
        category: String(row.subject ?? "Support"),
        description: String(row.message ?? ""),
        status: String(row.status ?? "open"),
        priority: String(row.priority ?? "medium"),
        adminReply: row.admin_reply === null ? null : String(row.admin_reply),
        resolvedAt: row.resolved_at === null ? null : String(row.resolved_at),
        createdAt: String(row.created_at ?? ""),
      };
    });

    return ok({ tickets });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const db = await getStoreDb();

    const body = createTicketSchema.parse(await readJson(request));
    // The storefront form sends { category, description }; the admin form
    // sends { subject, message }. Accept both, require a description.
    const subject = categoryLabel(body.category ?? body.subject ?? "");
    const message = body.message ?? body.description ?? "";
    if (!message) {
      return fail({
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "Describe your issue before opening a ticket.",
          },
        },
      });
    }

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `
        INSERT INTO vanta_support_tickets (customer_id, subject, message, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'open', ?, ?)
      `,
      args: [customer.customer.id, subject, message, body.priority, now, now],
    });

    if (result.lastInsertRowid === null) {
      return fail({ status: 500, body: { error: { code: "insert_failed", message: "Could not create ticket." } } });
    }

    const id = Number(result.lastInsertRowid);
    return ok(
      {
        ticket: {
          id: String(id),
          ticketNumber: ticketNumber(id),
          category: subject,
          description: message,
          status: "open",
          priority: body.priority,
          adminReply: null,
          resolvedAt: null,
          createdAt: now,
        },
      },
      201,
    );
  } catch (err) {
    return fail(err);
  }
}
