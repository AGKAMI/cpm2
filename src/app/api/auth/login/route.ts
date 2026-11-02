import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import { getUserByEmail } from "@/lib/service-turso";
import {
  SESSION_COOKIE,
  createSessionToken,
  rateLimited,
  scryptCompare,
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

    const body = (await readJson(request)) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    const user = await getUserByEmail(email);
    if (!user || !(await scryptCompare(password, user.password_hash))) {
      // Same response whether the user exists or not — no enumeration.
      return NextResponse.json(
        { error: { code: "AUTH_INVALID", message: "Wrong email or password." } },
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
