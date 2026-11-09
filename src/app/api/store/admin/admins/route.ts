/** VANTA GARAGE — admin management API.
 *
 * GET    /api/store/admin/admins      — list active admins (owner only)
 * POST   /api/store/admin/admins      — add an admin (owner only)
 * DELETE /api/store/admin/admins/[id] — remove an admin (owner only)
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { listAdmins, addAdmin, removeAdmin } from "@/lib/store/admin-service";
import { fetchTelegramUser } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const admins = await listAdmins();
    return ok({ admins }, 200);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const status = await requireStoreAdmin(request);
    if (!status.isOwner) {
      return fail({ status: 403, body: { error: { code: "OWNER_ONLY", message: "Only the owner can add admins." } } });
    }

    const body = await readJson(request);
    const { telegramUserId, telegramUsername } = body as {
      telegramUserId?: string;
      telegramUsername?: string;
    };

    if (!telegramUserId) {
      return fail({ status: 400, body: { error: { code: "missing_telegram_user_id", message: "telegramUserId is required" } } });
    }

    // Auto-fetch username from Telegram if not provided
    let finalUsername = telegramUsername ?? "";
    if (!finalUsername) {
      const userInfo = await fetchTelegramUser(Number(telegramUserId));
      if (userInfo?.username) {
        finalUsername = userInfo.username;
      } else if (userInfo?.first_name) {
        // Fallback to first_name if no username
        finalUsername = userInfo.first_name;
      }
    }

    const admin = await addAdmin(telegramUserId, finalUsername, status.telegramUserId ?? "");
    return ok({ admin }, 201);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const status = await requireStoreAdmin(request);
    if (!status.isOwner) {
      return fail({ status: 403, body: { error: { code: "OWNER_ONLY", message: "Only the owner can remove admins." } } });
    }

    const url = new URL(request.url);
    const telegramUserId = url.searchParams.get("id");
    if (!telegramUserId) {
      return fail({ status: 400, body: { error: { code: "missing_id", message: "id query parameter is required" } } });
    }

    // Prevent removing yourself (owner safety)
    if (telegramUserId === status.telegramUserId) {
      return fail({ status: 400, body: { error: { code: "CANNOT_REMOVE_OWNER", message: "You cannot remove yourself." } } });
    }

    const removed = await removeAdmin(telegramUserId);
    return ok({ removed }, 200);
  } catch (err) {
    return fail(err);
  }
}
