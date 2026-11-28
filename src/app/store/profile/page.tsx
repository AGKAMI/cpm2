import { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { ProfileClient } from "@/components/ProfileClient";
import { ProfileSkeleton } from "@/components/skeleton";
import { getCustomerByPlatformIdentity } from "@/lib/store/customers";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";
import { resolveAdminStatus } from "@/lib/store/admin-service";
import {
  assertTelegramAuth,
  fetchTelegramUser,
  fetchTelegramPhotoFileId,
  initDataUserId,
} from "@/lib/telegram";
import type { VantaCustomer, TelegramUser } from "@/lib/store/client";

export const metadata: Metadata = {
  title: "Profile - VANTA GARAGE",
};

export const dynamic = "force-dynamic";

type ProfileData = {
  customer: VantaCustomer | null;
  telegramUser: TelegramUser | null;
};

/**
 * Resolves the signed-in customer and Telegram identity for the profile page.
 *
 * This is the SAME resolution /api/store/profile performs — Telegram
 * initData signature verification, signed session cookie, owner-email
 * fallback — called IN-PROCESS instead of over HTTP. The page used to
 * self-fetch its own API on every render through a Host header the client
 * controls, which put an unnecessary internal hop (and a client-chosen
 * origin) in front of plain server-side data access. No network hop, no
 * Host header, never a fetch of our own API.
 */
async function resolveProfileData(request: Request): Promise<ProfileData> {
  // resolveAdminStatus throws on a stale/forged initData header. A valid web
  // session must still render the profile in that case, so degrade to the
  // signed-out role instead of throwing before the session lookup below.
  let adminStatus: Awaited<ReturnType<typeof resolveAdminStatus>> | null = null;
  try {
    adminStatus = await resolveAdminStatus(request);
  } catch {
    adminStatus = null;
  }
  const role: "owner" | "admin" | "customer" = adminStatus?.role ?? "customer";

  // 1. Try session cookie (web login)
  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken, "store");

  if (sessionUserId) {
    const db = await getStoreDb();
    const customer = await db.execute({
      sql: `SELECT id, in_game_name, player_id, email, currency_pref, notifications_enabled, created_at, updated_at FROM vanta_customers WHERE id = ?`,
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
      let telegramUser: TelegramUser | null = null;
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
          displayName: username || firstName || String(c.in_game_name ?? "") || "user",
        };
      }

      return {
        customer: {
          id: Number(c.id),
          inGameName: String(c.in_game_name ?? ""),
          playerId: String(c.player_id ?? ""),
          email: String(c.email ?? ""),
          currencyPref: String(c.currency_pref ?? "ZAR"),
          notificationsEnabled: Boolean(c.notifications_enabled),
          telegramLinked,
          telegramId: telegramLinked ? String(identity.rows[0].platform_user_id) : null,
          role,
          createdAt: String(c.created_at ?? ""),
          updatedAt: String(c.updated_at ?? ""),
        },
        telegramUser,
      };
    }
  }

  // 2. Try Telegram initData (Mini App) — SIGNED ONLY. The API verifies the
  //    signature; this server component must do the same before trusting the
  //    `user` payload it renders into the page.
  const initData = request.headers.get("X-Telegram-Init-Data");
  if (initData) {
    let verifiedId: number | null = null;
    try {
      verifiedId = await assertTelegramAuth(request);
    } catch {
      verifiedId = null;
    }
    // A forged or stale header is a signed-out render, never a customer lookup.
    if (!verifiedId) return { customer: null, telegramUser: null };

    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    let tgUser: { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string } | null = null;
    if (userJson) {
      try {
        tgUser = JSON.parse(userJson);
      } catch {
        tgUser = null;
      }
    }
    // The verified id is authoritative, not the id in the parsed JSON.
    const telegramUserId = initDataUserId(initData) ?? verifiedId;

    const result = await getCustomerByPlatformIdentity("telegram", String(telegramUserId));
    const customer: VantaCustomer | null = result
      ? {
          ...result.customer,
          email: "",
          role,
          telegramLinked: true,
          telegramId: String(telegramUserId),
        }
      : null;

    return {
      customer,
      telegramUser: {
        id: telegramUserId,
        username: tgUser?.username,
        firstName: tgUser?.first_name,
        lastName: tgUser?.last_name,
        photoUrl: tgUser?.photo_url,
        displayName: tgUser?.username || tgUser?.first_name || "user",
      },
    };
  }

  return { customer: null, telegramUser: null };
}

async function ProfileContent() {
  const headerList = await headers();

  // Build an in-process Request carrying the same auth inputs the profile API
  // reads — the Telegram initData header and the signed session cookie — and
  // resolve directly. No self-fetch, no client-controlled Host header, and no
  // client-supplied owner-email header (that path was removed server-side).
  const requestHeaders = new Headers();
  const cookie = headerList.get("cookie");
  if (cookie) requestHeaders.set("cookie", cookie);
  const initData = headerList.get("x-telegram-init-data");
  if (initData) requestHeaders.set("X-Telegram-Init-Data", initData);
  const request = new Request("https://profile.internal/api/store/profile", {
    headers: requestHeaders,
  });

  let customer: VantaCustomer | null = null;
  let telegramUser: TelegramUser | null = null;
  try {
    const data = await resolveProfileData(request);
    customer = data.customer;
    telegramUser = data.telegramUser;
  } catch {
    // A forged/stale Telegram initData header used to come back as a non-ok
    // response from the self-fetch: the page rendered signed-out and
    // ProfileClient re-authenticated client-side. Keep that behaviour instead
    // of letting the throw hit the error boundary.
  }

  return (
    <ProfileClient
      initialCustomer={customer}
      initialTelegramUser={telegramUser}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}