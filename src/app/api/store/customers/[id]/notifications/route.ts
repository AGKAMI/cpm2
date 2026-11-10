import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";
import { sendNotification } from "@/lib/store/notifications";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customerId = Number(id);

  // Verify authentication via session cookie
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
    sql: `SELECT notifications_enabled FROM vanta_customers WHERE id = ?`,
    args: [customerId],
  });

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Customer not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
      enabled: Number(result.rows[0].notifications_enabled ?? 1) === 1,
    });
  }

async function getCustomerTelegramId(db: Awaited<ReturnType<typeof getStoreDb>>, customerId: number): Promise<number | null> {
  const result = await db.execute({
    sql: `SELECT platform_user_id FROM vanta_platform_identities WHERE customer_id = ? AND platform = 'telegram' LIMIT 1`,
    args: [customerId],
  });
  if (result.rows.length === 0) return null;
  return Number(result.rows[0].platform_user_id);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customerId = Number(id);

  // Verify authentication via session cookie
  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken);

  if (!sessionUserId || sessionUserId !== customerId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authorized" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { enabled } = body as { enabled?: boolean };

    if (enabled === undefined) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "enabled is required" } },
        { status: 400 }
      );
    }

    const db = await getStoreDb();
    await db.execute({
      sql: `UPDATE vanta_customers SET notifications_enabled = ?, updated_at = ? WHERE id = ?`,
      args: [enabled ? 1 : 0, new Date().toISOString(), customerId],
    });

    // Send confirmation message when notifications are toggled
    try {
      const telegramId = await getCustomerTelegramId(db, customerId);
      if (telegramId) {
        if (enabled) {
          await sendNotification(
            telegramId,
            `════════════════════════\n` +
            `VANTA GARAGE — NOTIFICATIONS ON\n` +
            `════════════════════════\n\n` +
            `✦ Notifications On ✦\n\n` +
            `You're all set — order updates will now come straight to your Telegram.\n\n` +
            `▸ Payment Verified — EFT or PayFast payment cleared\n` +
            `▸ Payment Rejected — Payment proof wasn't valid\n` +
            `▸ Delivery Scheduled — Your ride is ready for handoff\n` +
            `▸ Delivery Complete — Order delivered\n` +
            `▸ Order Cancelled — Order cancelled, stock released\n\n` +
            `▶ Turn these off anytime in your profile. Drive safe.`
          );
        } else {
          await sendNotification(
            telegramId,
            `════════════════════════\n` +
            `VANTA GARAGE — NOTIFICATIONS OFF\n` +
            `════════════════════════\n\n` +
            `✗ Notifications Off ✗\n\n` +
            `You will no longer receive order update notifications from Vanta Garage on Telegram.\n\n` +
            `▸ No payment, delivery, or cancellation alerts\n\n` +
            `▶ Turn notifications back on anytime in your profile.`
          );
        }
      }
    } catch {
      // Don't fail the toggle if the confirmation message fails to send
    }

    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to update notifications" } },
      { status: 500 }
    );
  }
}
