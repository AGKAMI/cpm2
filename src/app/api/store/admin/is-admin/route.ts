/**
 * VANTA GARAGE — admin status check.
 * GET /api/store/admin/is-admin
 * Returns { isAdmin: boolean } — used by the UI to show/hide the admin link.
 * Gated by requireStoreAdmin (Telegram owner id only).
 */

import { ok, fail } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    return ok({ isAdmin: true });
  } catch {
    return ok({ isAdmin: false });
  }
}
