/**
 * VANTA GARAGE — mark all customer notifications as read.
 * PATCH /api/store/customers/[id]/notifications/read-all
 */

import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
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

  await db.execute({
    sql: `UPDATE vanta_notifications SET is_read = 1, updated_at = ? WHERE customer_id = ? AND is_read = 0`,
    args: [new Date().toISOString(), customerId],
  });

  return NextResponse.json({ success: true });
}
