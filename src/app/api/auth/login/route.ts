import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import { getUserByEmail, getUserByTelegramId } from "@/lib/service-turso";
import {
  SESSION_COOKIE,
  createSessionToken,
  rateLimited,
  scryptCompare,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Desktop / LAN login: POST {email, password} for player accounts,
 * or POST {password} for the console lock screen (APP_PASSWORD only, KAMI).
 * Sets the signed session cookie on success. Brute-forced attempts are damped per IP.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (rateLimited(`login:${ip}`)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts — wait a minute and try again." } },
        { status: 429 },
      );
    }

    const body = (await readJson(request)) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    // --- Console lock screen: APP_PASSWORD only, no email ---
    if (!email) {
      const appPassword = process.env.APP_PASSWORD;
      const given = password.trim();
      const expected = appPassword ? appPassword.trim() : "";
      if (!appPassword || given !== expected) {
        return NextResponse.json(
          { error: { code: "AUTH_INVALID", message: "Wrong console password." } },
          { status: 401 },
        );
      }
      const owner = await getUserByTelegramId(7036681178);
      if (!owner) {
        return NextResponse.json(
          { error: { code: "OWNER_NOT_FOUND", message: "Console owner not registered. Register first, then link Telegram." } },
          { status: 401 },
        );
      }
      const response = NextResponse.json({ ok: true, user: { id: owner.id, email: owner.email }, mode: "console" });
      response.cookies.set(SESSION_COOKIE, createSessionToken(owner.id), sessionCookieOptions(request));
      return response;
    }

    // --- Player account login: email + password ---
    const user = await getUserByEmail(email);
    if (!user || !(await scryptCompare(password, user.password_hash))) {
      // Same response whether the user exists or not — no enumeration.
      return NextResponse.json(
        { error: { code: "AUTH_INVALID", message: "Wrong email or password." } },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email }, mode: "player" });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions(request));
    return response;
  } catch (err) {
    return fail(err);
  }
}
