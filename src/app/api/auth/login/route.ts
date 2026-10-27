import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import {
  SESSION_COOKIE,
  createSessionToken,
  passwordMatches,
  rateLimited,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Desktop / LAN login: POST {password}. Sets the signed session cookie on
 * success. Brute-forced attempts are damped per IP.
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

    const body = (await readJson(request)) as { password?: unknown };
    if (!passwordMatches(body.password)) {
      return NextResponse.json(
        { error: { code: "AUTH_INVALID", message: "Wrong password." } },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions(request));
    return response;
  } catch (err) {
    return fail(err);
  }
}
