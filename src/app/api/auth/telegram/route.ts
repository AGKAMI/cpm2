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
import { bindUserTelegram, getUserByEmail, getUserByTelegramId, verifyUserCredentials } from "@/lib/service-turso";

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

    const body = (await readJson(request)) as { initData?: unknown; email?: unknown; password?: unknown };
    const initData = typeof body.initData === "string" ? body.initData.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
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
    if (user) {
      // Already bound — session straight in.
      const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
      response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions(request));
      return response;
    }

    // Not bound yet.
    // 1) Console-only path: APP_PASSWORD matches → bind this Telegram id to the console owner.
    //    Matches the website's console lock screen: password only, no email.
    if (!email && password) {
      const appPassword = process.env.APP_PASSWORD;
      const given = password.trim();
      const expected = appPassword ? appPassword.trim() : "";
      if (appPassword && given === expected) {
        const owner = await getUserByEmail("ojuniormaluleke@gmail.com");
        if (!owner) {
          return NextResponse.json(
            { error: { code: "OWNER_NOT_FOUND", message: "Console owner account not found. Register first." } },
            { status: 401 },
          );
        }
        await bindUserTelegram(owner.id, telegramUserId);
        const response = NextResponse.json({ ok: true, user: { id: owner.id, email: owner.email }, mode: "console" });
        response.cookies.set(SESSION_COOKIE, createSessionToken(owner.id), sessionCookieOptions(request));
        return response;
      }
    }

    // 2) Player binding: email + password → verify credentials, then bind Telegram id to that account.
    if (!email || !password) {
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

    const verified = await verifyUserCredentials(email, password);
    if (!verified) {
      return NextResponse.json(
        {
          error: {
            code: "TELEGRAM_AUTH_INVALID",
            message: "That email and password did not match — try again.",
          },
        },
        { status: 401 },
      );
    }

    await bindUserTelegram(verified.id, telegramUserId);
    const response = NextResponse.json({ ok: true, user: { id: verified.id, email: verified.email } });
    response.cookies.set(SESSION_COOKIE, createSessionToken(verified.id), sessionCookieOptions(request));
    return response;
  } catch (err) {
    return fail(err);
  }
}
