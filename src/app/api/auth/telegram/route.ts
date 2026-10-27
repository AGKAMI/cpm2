import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import { ApiError } from "@/lib/api";
import {
  SESSION_COOKIE,
  bindTelegramOwner,
  createSessionToken,
  passwordMatches,
  rateLimited,
  sessionCookieOptions,
  telegramOwnerId,
} from "@/lib/auth";
import { initDataUserId, telegramBotToken, verifyTelegramInitData } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Telegram login: POST {initData, password?}.
 *
 * - First ever login: the correct password CLAIMS the console — the Telegram
 *   user in the signed initData becomes the permanent owner and gets a
 *   session. A wrong (or missing) password claims nothing.
 * - Every later login: the initData's user id must BE the owner; no password
 *   needed, the signed initData is enough.
 * - A different Telegram account is locked out even with the right password —
 *   the console belongs to one person.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (rateLimited(`telegram:${ip}`)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts — wait a minute and try again." } },
        { status: 429 },
      );
    }

    const body = (await readJson(request)) as { initData?: unknown; password?: unknown };
    const initData = typeof body.initData === "string" ? body.initData.trim() : "";
    const token = telegramBotToken();
    if (!initData || !token || !(await verifyTelegramInitData(initData, token))) {
      throw new ApiError(
        401,
        "TELEGRAM_AUTH_INVALID",
        "The Telegram signature did not verify — reopen the console from Telegram and try again.",
      );
    }

    const userId = initDataUserId(initData);
    if (userId === null) {
      throw new ApiError(401, "TELEGRAM_AUTH_INVALID", "The initData carries no usable user id.");
    }

    const owner = telegramOwnerId();
    if (owner === null) {
      // Unclaimed: the password is what separates the owner from everyone else.
      if (!passwordMatches(body.password)) {
        return NextResponse.json(
          {
            error: {
              code: "AUTH_CLAIM_REQUIRED",
              message: "Enter the console password once to claim this console for your Telegram account.",
            },
          },
          { status: 401 },
        );
      }
      bindTelegramOwner(userId);
    } else if (userId !== owner) {
      return NextResponse.json(
        { error: { code: "TELEGRAM_NOT_OWNER", message: "This console belongs to another Telegram account." } },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions(request));
    return response;
  } catch (err) {
    return fail(err);
  }
}
