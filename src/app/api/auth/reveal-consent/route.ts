import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import {
  SESSION_COOKIE,
  constantTimeEquals,
  createRevealConsentToken,
  revealCookieOptions,
  trustedClientIp,
  verifySessionToken,
} from "@/lib/auth";
import { checkDurableRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Earn a short-lived consent to view plaintext passwords. Requires a valid
 * console session (already proves you passed the APP_PASSWORD gate), then
 * verifies the console password again. Sets an HttpOnly cookie valid five
 * minutes. The reveal and export routes require this cookie — an active
 * session alone is not enough to dump credentials.
 */
export async function POST(request: Request) {
  try {
    // Platform-attested IP + durable counter: a client-writable XFF entry and
    // per-process memory let an attacker rotate past this gate on serverless.
    const ip = trustedClientIp(request);
    if (await checkDurableRateLimit(`reveal-consent:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts - wait a minute and try again." } },
        { status: 429 },
      );
    }

    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    const userId = verifySessionToken(cookie ? decodeURIComponent(cookie) : undefined, "console");
    if (!userId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Sign in to use the console." } },
        { status: 401 },
      );
    }

    const body = (await readJson(request)) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";

    const appPassword = process.env.APP_PASSWORD;
    const given = password.trim();
    const expected = appPassword ? appPassword.trim() : "";
    // Constant-time — a plain !== leaks the match position through timing.
    if (!appPassword || !constantTimeEquals(given, expected)) {
      return NextResponse.json(
        { error: { code: "AUTH_INVALID", message: "Wrong console password." } },
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
