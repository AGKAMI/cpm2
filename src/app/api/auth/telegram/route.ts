import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import { ApiError } from "@/lib/api";
import {
  SESSION_COOKIE,
  createSessionToken,
  rateLimited,
  sessionCookieOptions,
} from "@/lib/auth";
import { initDataUserId, telegramBotToken, verifyTelegramInitData } from "@/lib/telegram";
import { getUserByTelegramId } from "@/lib/service-turso";

export const dynamic = "force-dynamic";

/**
 * Telegram login: POST {initData}.
 *
 * - Verifies the Telegram signature. Returns the Telegram user id inside it.
 * - Looks up a local player bound to that Telegram id.
 * - If bound: creates a session for that player (no password needed).
 * - If not bound: 401 telling them to register or log in first.
 * - A stranger who finds the bot and opens the mini app gets nothing unless
 *   their Telegram id is bound to a registered player.
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

    const body = (await readJson(request)) as { initData?: unknown };
    const initData = typeof body.initData === "string" ? body.initData.trim() : "";
    const token = telegramBotToken();
    if (!initData || !token || !(await verifyTelegramInitData(initData, token))) {
      throw new ApiError(
        401,
        "TELEGRAM_AUTH_INVALID",
        "The Telegram signature did not verify — reopen the console from Telegram and try again.",
      );
    }

    const telegramUserId = initDataUserId(initData);
    if (telegramUserId === null) {
      throw new ApiError(401, "TELEGRAM_AUTH_INVALID", "The initData carries no usable user id.");
    }

    const user = await getUserByTelegramId(telegramUserId);
    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: "TELEGRAM_NOT_BOUND",
            message: "This Telegram account is not linked to a player account. Register first.",
          },
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions(request));
    return response;
  } catch (err) {
    return fail(err);
  }
}
