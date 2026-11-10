/**
 * VANTA GARAGE — link Telegram identity.
 * POST /api/store/customers/link-telegram
 * Body: none (initData carried in X-Telegram-Init-Data header)
 * Links the current Telegram Mini App user to a VANTA customer profile.
 */

import { fail, ok, readJson } from "@/lib/route";
import { assertTelegramAuth } from "@/lib/telegram";
import { getCustomerByPlatformIdentity, linkPlatformIdentity } from "@/lib/store/customers";
import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function setSessionCookie(response: NextResponse, customerId: number, request: Request) {
  const token = createSessionToken(customerId);
  response.cookies.set("cpm2_session", token, sessionCookieOptions(request));
}

export async function POST(request: Request) {
  try {
    const telegramUserId = await assertTelegramAuth(request);
    if (telegramUserId === null) {
      return NextResponse.json({ error: "no_telegram_user", message: "No Telegram user id in initData" }, { status: 401 });
    }

    const existing = await getCustomerByPlatformIdentity("telegram", String(telegramUserId));

    // Session-aware: a customer logged in via email/password attaches this
    // Telegram identity to their EXISTING account instead of creating or
    // switching to the Telegram-linked customer.
    const sessionUserId = currentUserId(request);
    if (sessionUserId) {
      if (existing && existing.customer.id !== sessionUserId) {
        return NextResponse.json(
          { error: { code: "TELEGRAM_ALREADY_LINKED", message: "This Telegram ID is already linked to a different account." } },
          { status: 409 },
        );
      }
      const alreadyLinked = Boolean(existing && existing.customer.id === sessionUserId);
      if (!alreadyLinked) {
        await linkPlatformIdentity(sessionUserId, "telegram", String(telegramUserId), existing?.identity.platformUsername ?? "");
      }
      const response = NextResponse.json({
        linked: true,
        customerId: sessionUserId,
        inGameName: alreadyLinked && existing ? existing.customer.inGameName : "",
        message: alreadyLinked ? "Telegram already linked to this account." : "Telegram linked to your account.",
      });
      setSessionCookie(response, sessionUserId, request);
      return response;
    }

    if (existing) {
      const response = NextResponse.json({
        linked: true,
        customerId: existing.customer.id,
        inGameName: existing.customer.inGameName,
        message: "Telegram already linked to this customer.",
      });
      setSessionCookie(response, existing.customer.id, request);
      return response;
    }

    // Auto-create a customer linked to this Telegram id if none exists yet.
    // The customer gets a placeholder in-game name; they can edit it later.
    const { createCustomer } = await import("@/lib/store/customers");
    const created = await createCustomer({
      inGameName: `tg_${telegramUserId}`,
      playerId: "",
      currencyPref: "ZAR",
    });
    await linkPlatformIdentity(created.id, "telegram", String(telegramUserId), "");

    const response = NextResponse.json({
      linked: true,
      customerId: created.id,
      inGameName: created.inGameName,
      message: "Telegram linked - your orders and delivery history will appear here.",
    });
    setSessionCookie(response, created.id, request);
    return response;
  } catch (err) {
    return fail(err);
  }
}

