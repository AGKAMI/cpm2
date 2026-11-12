/**
 * VANTA GARAGE — admin status check.
 * GET /api/store/admin/is-admin
 * Returns { isAdmin: boolean } — used by the UI to show/hide the admin link.
 * Gated by requireStoreAdmin (Telegram owner id only).
 *
 * Staleness window is wider here than for admin mutations: a Telegram WebView
 * restored from the background keeps its original initData (auth_date frozen),
 * and rejecting it made the dock admin/owner buttons and the profile Quick
 * Login button vanish intermittently. The signature still proves identity;
 * actual admin ACTIONS stay gated by requireStoreAdmin's strict 24h check.
 */

import { ok, fail } from "@/lib/route";
import { ApiError } from "@/lib/api";
import { resolveAdminStatus } from "@/lib/store/admin-service";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export async function GET(request: Request) {
  try {
    const status = await resolveAdminStatus(request, {
      maxAgeSeconds: SEVEN_DAYS_SECONDS,
    });
    return ok({
      isAdmin: status.isAdmin,
      isOwner: status.isOwner,
      telegramUserId: status.telegramUserId,
    });
  } catch (err) {
    // Auth rejections (invalid/stale signature, unconfigured bot) mean "not
    // admin". Anything else (Turso hiccup, network) is transient — return
    // 503 so the client keeps its last-known state instead of hiding buttons.
    if (err instanceof ApiError) {
      return ok({ isAdmin: false, isOwner: false });
    }
    return fail({
      status: 503,
      body: { error: { code: "STATUS_CHECK_UNAVAILABLE", message: "Admin status check unavailable." } },
    });
  }
}
