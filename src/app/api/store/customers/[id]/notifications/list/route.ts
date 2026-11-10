/**
 * VANTA GARAGE — list customer notifications.
 * GET /api/store/customers/[id]/notifications/list
 * Returns unread + read notifications for a customer, newest first.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customerId = Number(id);

  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken);

  if (!sessionUserId || sessionUserId !== customerId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authorized" } },
      { status: 401 }
    );
  }

  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT id, type, title, message, is_read, related_product_id, related_order_id, created_at
          FROM vanta_notifications
          WHERE customer_id = ?
          ORDER BY is_read ASC, created_at DESC
          LIMIT 50`,
    args: [customerId],
  });

  const notifications = result.rows.map((row: any) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: Number(row.is_read) === 1,
    relatedProductId: row.related_product_id,
    relatedOrderId: row.related_order_id,
    createdAt: row.created_at,
  }));

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json({ notifications, unreadCount });
}
