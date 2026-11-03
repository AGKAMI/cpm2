import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import { rateLimited } from "@/lib/auth";
import { createUser, bindUserTelegram } from "@/lib/service-turso";
import { userRegisterSchema } from "@/lib/validation";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * New player registration: POST {email, password, confirmPassword, telegramUserId?}.
 * Creates a user account with a scrypt-hashed password. Email must be unique.
 * Brute-forced attempts are damped per IP.
 * On success, sets the signed session cookie so the new player is logged in
 * immediately instead of being treated as a guest.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (rateLimited(`register:${ip}`)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts — wait a minute and try again." } },
        { status: 429 },
      );
    }

    const input = userRegisterSchema.parse(await readJson(request));
    const email = input.email.trim().toLowerCase();

    const user = await createUser(email, input.password);

    const response = NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email } },
      { status: 201 },
    );

    response.cookies.set(
      SESSION_COOKIE,
      createSessionToken(user.id),
      sessionCookieOptions(request),
    );

    // Auto-link Telegram if the caller passed a verified Telegram user id.
    if (input.telegramUserId) {
      await bindUserTelegram(user.id, input.telegramUserId);
    }

    return response;
  } catch (err) {
    return fail(err);
  }
}
