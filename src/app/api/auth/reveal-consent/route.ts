import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import {
  SESSION_COOKIE,
  createRevealConsentToken,
  rateLimited,
  revealCookieOptions,
  verifySessionToken,
} from "@/lib/auth";
import { verifyUserCredentials } from "@/lib/service-turso";

export const dynamic = "force-dynamic";

/**
 * Earn a short-lived consent to view plaintext passwords. Verifies the logged-in
 * player's own password (brute-forced per IP) and sets an HttpOnly cookie valid
 * five minutes. The reveal and export routes require this cookie — an active
 * session alone is not enough to dump credentials. Every successful consent is audited.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (rateLimited(`reveal-consent:${ip}`)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts — wait a minute and try again." } },
        { status: 429 },
      );
    }

    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    const userId = verifySessionToken(cookie ? decodeURIComponent(cookie) : undefined);
    if (!userId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Sign in to use the console." } },
        { status: 401 },
      );
    }

    const body = (await readJson(request)) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    const user = await verifyUserCredentials(email, password);
    if (!user) {
      return NextResponse.json(
        { error: { code: "AUTH_INVALID", message: "Wrong email or password." } },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      "cpm2_reveal_pw",
      createRevealConsentToken(),
      revealCookieOptions(request),
    );
    return response;
  } catch (err) {
    return fail(err);
  }
}
