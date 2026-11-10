/**
 * VANTA GARAGE — Check Telegram verification status.
 * GET /api/store/customers/link-telegram-check?verificationId=number
 *
 * Returns { status: 'pending' | 'confirmed' | 'rejected' | 'expired' }
 * plus customer info when confirmed.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionUserId = currentUserId(request);
    if (!sessionUserId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in." } },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const verificationId = url.searchParams.get("verificationId");
    if (!verificationId || !/^\d+$/.test(verificationId)) {
      return NextResponse.json(
        { error: { code: "INVALID_ID", message: "Missing verification ID." } },
        { status: 400 },
      );
    }

    const db = await getStoreDb();
    const result = await db.execute({
      sql: `SELECT status, customer_id, telegram_user_id, expires_at, confirmed_at
            FROM vanta_telegram_verifications
            WHERE id = ? AND customer_id = ?`,
      args: [Number(verificationId), sessionUserId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Verification not found." } },
        { status: 404 },
      );
    }

    const row = result.rows[0];
    const status = String(row.status);
    const now = new Date();

    // Auto-expire if past expiry and still pending
    if (status === "pending" && new Date(String(row.expires_at)) < now) {
      await db.execute({
        sql: `UPDATE vanta_telegram_verifications SET status = 'expired' WHERE id = ?`,
        args: [Number(verificationId)],
      });
      return NextResponse.json({ status: "expired" });
    }

    // When confirmed, perform the actual link
    if (status === "confirmed") {
      const { linkPlatformIdentity } = await import("@/lib/store/customers");
      const already = await db.execute({
        sql: `SELECT id FROM vanta_platform_identities WHERE platform = 'telegram' AND customer_id = ?`,
        args: [sessionUserId],
      });
      if (already.rows.length === 0) {
        await linkPlatformIdentity(sessionUserId, "telegram", String(row.telegram_user_id), "");
      }
      return NextResponse.json({
        status: "confirmed",
        customerId: sessionUserId,
        telegramId: row.telegram_user_id,
      });
    }

    return NextResponse.json({ status });
  } catch (err) {
    console.error("Check error:", err);
    return NextResponse.json(
      { error: { code: "CHECK_FAILED", message: "Could not check verification status." } },
      { status: 500 },
    );
  }
}
