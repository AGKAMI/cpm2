/** VANTA GARAGE — admin management API.
 *
 * GET    /api/store/admin/admins      — list active admins (owner only)
 * POST   /api/store/admin/admins      — add an admin (owner only)
 * DELETE /api/store/admin/admins/[id] — remove an admin (owner only)
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { listAdmins, addAdmin } from "@/lib/store/admin-service";
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
    const { telegramUserId, nickname } = body as {
      telegramUserId?: string;
      nickname?: string;
    };

    if (!telegramUserId) {
      return fail({ status: 400, body: { error: { code: "missing_telegram_user_id", message: "telegramUserId is required" } } });
    }

    // Always pull the actual Telegram name from the bot via the user ID
    let telegramUsername = "";
    const userInfo = await fetchTelegramUser(Number(telegramUserId));
    if (userInfo?.username) {
      telegramUsername = userInfo.username;
    } else if (userInfo?.first_name) {
      telegramUsername = userInfo.first_name + (userInfo.last_name ? ` ${userInfo.last_name}` : "");
    }

    const admin = await addAdmin(telegramUserId, telegramUsername, nickname?.trim() ?? "", status.telegramUserId ?? "");
    return ok({ admin }, 201);
  } catch (err) {
    return fail(err);
  }
}
