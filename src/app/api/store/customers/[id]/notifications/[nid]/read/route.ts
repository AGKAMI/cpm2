/**
 * VANTA GARAGE — mark a notification as read.
 * PATCH /api/store/customers/[id]/notifications/[nid]/read
 */

import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nid: string }> }
) {
  const { id, nid } = await params;
  const customerId = Number(id);
  const notificationId = Number(nid);

  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken);

  if (!sessionUserId || sessionUserId !== customerId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authorized" } },
      { status: 401 }
    );
  }

  const db = await getStoreDb();

  // Verify the notification belongs to this customer
  const check = await db.execute({
    sql: `SELECT id FROM vanta_notifications WHERE id = ? AND customer_id = ?`,
    args: [notificationId, customerId],
  });

  if (check.rows.length === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Notification not found" } },
      { status: 404 }
    );
  }

  await db.execute({
    sql: `UPDATE vanta_notifications SET is_read = 1, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), notificationId],
  });

  return NextResponse.json({ success: true });
}
