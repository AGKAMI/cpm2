/**
 * VANTA GARAGE — send notification.
 * POST /api/store/notifications/send — send a Telegram notification to a customer.
 * Admin-gated via requireStoreAdmin.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import { sendNotification } from "@/lib/store/notifications";
import { z } from "zod";

const notificationSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const db = await getStoreDb();

    const body = notificationSchema.parse(await readJson(request));

    // Get customer's telegram platform identity
    const customer = await db.execute({
      sql: `SELECT c.id, c.in_game_name FROM vanta_customers c WHERE c.id = ?`,
      args: [body.customerId],
    });
    if (customer.rows.length === 0) {
      return fail({ status: 404, body: { error: { code: "customer_not_found", message: "Customer not found." } } });
    }

    const identity = await db.execute({
      sql: `SELECT platform_user_id FROM vanta_platform_identities WHERE customer_id = ? AND platform = 'telegram' LIMIT 1`,
      args: [body.customerId],
    });

    if (identity.rows.length === 0) {
      return fail({
        status: 400,
        body: { error: { code: "no_telegram_link", message: "Customer has no linked Telegram account." } },
      });
    }

    const chatId = Number(identity.rows[0].platform_user_id);
    const text = `<b>${body.title}</b>\n\n${body.message}`;

    const sent = await sendNotification(chatId, text);
    if (!sent) {
      return fail({ status: 502, body: { error: { code: "send_failed", message: "Failed to send notification." } } });
    }

    return ok({ sent: true, customerId: body.customerId });
  } catch (err) {
    return fail(err);
  }
}
