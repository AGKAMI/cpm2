/**
 * VANTA GARAGE — notify a newly promoted admin via Telegram DM.
 * POST /api/store/admin/notify-admin-promoted
 * Body: { telegramUserId: string, promotedBy: string }
 * Sends an emojified promotion message to the promoted admin's Telegram.
 * Admin-gated via requireStoreAdmin.
 */

import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { notifyAdminPromoted } from "@/lib/store/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireStoreAdmin(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail({ status: 400, body: { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } } });
    }
    const { telegramUserId, promotedBy } = body as {
      telegramUserId?: string;
      promotedBy?: string;
    };

    if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
      return NextResponse.json(
        { error: { code: "INVALID_ID", message: "A valid Telegram user ID is required." } },
        { status: 400 },
      );
    }

    await notifyAdminPromoted(Number(telegramUserId), promotedBy ?? "the owner");

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to send promotion notice." } },
      { status: 500 }
    );
  }
}
