/**
 * VANTA GARAGE — admin presence heartbeat.
 * POST /api/store/admin/heartbeat
 * Marks the calling admin as online (updates last_seen).
 * Admin-gated via requireStoreAdmin.
 */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { adminHeartbeat } from "@/lib/store/admin-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const status = await requireStoreAdmin(request);
    if (!status.telegramUserId) {
      return fail({ status: 400, body: { error: { code: "no_telegram_user", message: "No Telegram user linked." } } });
    }
    await adminHeartbeat(status.telegramUserId);
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
