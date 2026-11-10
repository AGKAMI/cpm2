import { NextRequest, NextResponse } from "next/server";
import { getCustomerByPlatformIdentity } from "@/lib/store/customers";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";
import { resolveAdminStatus } from "@/lib/store/admin-service";
import { fetchTelegramUser, fetchTelegramPhotoFileId } from "@/lib/telegram";

export async function GET(request: NextRequest) {
  const adminStatus = await resolveAdminStatus(request);
  const role: "owner" | "admin" | "customer" = adminStatus.role ?? "customer";

  // 1. Try session cookie (web login)
  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken);
  
  if (sessionUserId) {
    const db = await getStoreDb();
    const customer = await db.execute({
      sql: `SELECT id, in_game_name, player_id, email, currency_pref FROM vanta_customers WHERE id = ?`,
      args: [sessionUserId],
    });
    if (customer.rows.length > 0) {
      const c = customer.rows[0];
      // Telegram link status for the logged-in customer
      const identity = await db.execute({
        sql: `SELECT platform_user_id, platform_username FROM vanta_platform_identities WHERE platform = 'telegram' AND customer_id = ? LIMIT 1`,
        args: [sessionUserId],
      });
      const telegramLinked = identity.rows.length > 0;

      // Resolve the Telegram display identity (username / first name / avatar)
      // so the profile header shows the Telegram identity instead of the email
      // prefix. fetchTelegramUser uses getChat (getUser does not exist in the
      // Bot API); the avatar is proxied so the bot token stays server-side.
      let telegramUser: { id: number; username?: string; firstName?: string; photoUrl?: string; displayName: string } | null = null;
      if (telegramLinked) {
        const tgId = String(identity.rows[0].platform_user_id);
        const tgInfo = await fetchTelegramUser(Number(tgId));
        const dbUsername = String(identity.rows[0].platform_username ?? "");
        const username = tgInfo?.username ?? (dbUsername || null);
        const firstName = tgInfo?.first_name ?? null;
        const hasPhoto = (await fetchTelegramPhotoFileId(Number(tgId))) !== null;
        telegramUser = {
          id: Number(tgId),
          username: username ?? undefined,
          firstName: firstName ?? undefined,
          photoUrl: hasPhoto ? `/api/store/telegram-avatar?v=${tgId}` : undefined,
          displayName: username || firstName || String(c.in_game_name ?? "") || "there",
        };
      }

      return NextResponse.json({ 
        customer: {
          id: Number(c.id),
          inGameName: String(c.in_game_name ?? ""),
          playerId: String(c.player_id ?? ""),
          email: String(c.email ?? ""),
          currencyPref: String(c.currency_pref ?? "ZAR"),
          telegramLinked,
          telegramId: telegramLinked ? String(identity.rows[0].platform_user_id) : null,
          role,
        }, 
        telegramUser 
      });
    }
  }

  // 2. Try Telegram initData (Mini App)
  const initData = request.headers.get("X-Telegram-Init-Data");
  if (initData) {
    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    let telegramUser: { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string } | null = null;
    
    if (userJson) {
      try {
        telegramUser = JSON.parse(userJson);
      } catch {
        telegramUser = null;
      }
    }

    let customer = null;
    if (telegramUser) {
      const result = await getCustomerByPlatformIdentity("telegram", String(telegramUser.id));
      if (result) {
        customer = result.customer;
      }
    }

    return NextResponse.json({ 
      customer: customer ? { ...customer, role } : null, 
      telegramUser: telegramUser ? {
        id: telegramUser.id,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        photoUrl: telegramUser.photo_url,
        displayName: telegramUser.username || telegramUser.first_name || "there"
      } : null
    });
  }

  return NextResponse.json({ customer: null, telegramUser: null, role: "customer" });
}
