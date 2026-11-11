/**
 * VANTA GARAGE — admin creates a customer notification.
 * POST /api/store/admin/notifications
 * Body: { customerId?: number, title: string, message: string, type?: string, relatedProductId?: number, relatedOrderId?: string }
 * If customerId is omitted, sends to all customers with notifications enabled.
 * Admin-gated via requireStoreAdmin.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { requireStoreAdmin } from "@/lib/store/auth";
import { sendNotification, broadcastToWhatsAppBot } from "@/lib/store/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const notificationSchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.string().min(1).max(50).default("general"),
  relatedProductId: z.coerce.number().int().positive().optional(),
  relatedOrderId: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireStoreAdmin(request);

    const db = await getStoreDb();
    const body = notificationSchema.parse(await request.json());

    let targetCustomerIds: number[] = [];

    if (body.customerId) {
      targetCustomerIds = [body.customerId];
    } else {
      // Send to ALL customers for the in-app bell (not optional)
      const result = await db.execute({
        sql: `SELECT c.id FROM vanta_customers c`,
        args: [],
      });
      targetCustomerIds = result.rows.map((row: any) => Number(row.id));
    }

    const now = new Date().toISOString();
    const created: number[] = [];

    // Get customers with notifications enabled (for Telegram DMs only)
    const tgResult = await db.execute({
      sql: `SELECT c.id, p.platform_user_id FROM vanta_customers c
            LEFT JOIN vanta_platform_identities p ON p.customer_id = c.id AND p.platform = 'telegram'
            WHERE c.notifications_enabled = 1`,
      args: [],
    });
    const telegramCustomers = new Map<number, number | null>();
    for (const row of tgResult.rows as any[]) {
      telegramCustomers.set(Number(row.id), row.platform_user_id ? Number(row.platform_user_id) : null);
    }

    for (const customerId of targetCustomerIds) {
      const insert = await db.execute({
        sql: `INSERT INTO vanta_notifications (customer_id, type, title, message, is_read, related_product_id, related_order_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        args: [
          customerId,
          body.type,
          body.title,
          body.message,
          body.relatedProductId ?? null,
          body.relatedOrderId ?? null,
          now,
          now,
        ],
      });
      const notificationId = Number(insert.lastInsertRowid);
      created.push(notificationId);

      // Send Telegram DM only if customer has notifications enabled AND a linked Telegram
      const telegramId = telegramCustomers.get(customerId);
      if (telegramId) {
        try {
          await sendNotification(
            telegramId,
            `<b>${body.title}</b>\n\n${body.message}`
          );
        } catch {
          // Don't fail if Telegram send fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      sentTo: targetCustomerIds.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err?.message || "Failed to create notification" } },
      { status: 500 }
    );
  }
}
