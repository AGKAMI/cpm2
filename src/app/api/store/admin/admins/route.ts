/** VANTA GARAGE — admin management API.
 *
 * GET    /api/store/admin/admins      — list active admins (owner only)
 * POST   /api/store/admin/admins      — add an admin (owner only)
 * DELETE /api/store/admin/admins/[id] — remove an admin (owner only)
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { listAdmins, addAdmin, updateAdminUsername } from "@/lib/store/admin-service";
import { fetchTelegramUser } from "@/lib/telegram";
import { notifyAdminPromoted } from "@/lib/store/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    let admins = await listAdmins();
    // Refresh stored usernames against the live Telegram profile so the
    // owner page never shows a stale handle (usernames can change any time).
    const fresh = await Promise.all(
      admins.map(async (a) => {
        if (!a.telegramUserId) return a;
        try {
          const userInfo = await fetchTelegramUser(Number(a.telegramUserId));
          const liveName = userInfo?.username
            ? userInfo.username
            : userInfo?.first_name
              ? userInfo.first_name + (userInfo.last_name ? ` ${userInfo.last_name}` : "")
              : "";
          if (liveName && liveName !== a.telegramUsername) {
            await updateAdminUsername(a.id, liveName);
            return { ...a, telegramUsername: liveName };
          }
        } catch {
          // Telegram lookup failed — keep the stored value
        }
        return a;
      }),
    );
    admins = fresh;
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
    // Send Telegram DM to the newly promoted admin
    try {
      await notifyAdminPromoted(Number(telegramUserId), status.telegramUserId ?? "the owner");
    } catch {
      // Don't fail the admin addition if the DM fails
    }
    return ok({ admin }, 201);
  } catch (err) {
    return fail(err);
  }
}
