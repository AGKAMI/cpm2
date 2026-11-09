/** VANTA GARAGE — remove admin (Telegram Mini App). * DELETE /api/store/admin/admins/[id] — remove an admin (owner only) */

import { fail, ok } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { removeAdmin } from "@/lib/store/admin-service";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const status = await requireStoreAdmin(request);
    if (!status.isOwner) {
      return fail({
        status: 403,
        body: { error: { code: "OWNER_ONLY", message: "Only the owner can remove admins." } },
      });
    }

    const { id: telegramUserId } = await params;
    if (!telegramUserId || telegramUserId === "admins") {
      return fail({
        status: 400,
        body: { error: { code: "missing_id", message: "admin id is required" } },
      });
    }

    // Prevent removing yourself (owner safety)
    if (telegramUserId === status.telegramUserId) {
      return fail({
        status: 400,
        body: {
          error: { code: "CANNOT_REMOVE_OWNER", message: "You cannot remove yourself." },
        },
      });
    }

    const removed = await removeAdmin(telegramUserId);
    return ok({ removed }, 200);
  } catch (err) {
    return fail(err);
  }
}
