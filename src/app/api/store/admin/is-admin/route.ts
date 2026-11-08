/**
 * VANTA GARAGE — admin status check.
 * GET /api/store/admin/is-admin
 * Returns { isAdmin: boolean } — used by the UI to show/hide the admin link.
 * Gated by requireStoreAdmin (Telegram owner id only).
 */

import { ok, fail } from "@/lib/route";
import { resolveAdminStatus } from "@/lib/store/admin-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const status = await resolveAdminStatus(request);
    return ok({
      isAdmin: status.isAdmin,
      isOwner: status.isOwner,
      telegramUserId: status.telegramUserId,
    });
  } catch {
    return ok({ isAdmin: false, isOwner: false });
  }
}
