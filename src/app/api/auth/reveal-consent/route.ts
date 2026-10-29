import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import {
  createRevealConsentToken,
  passwordMatches,
  rateLimited,
  revealCookieOptions,
} from "@/lib/auth";
import { logEvent } from "@/lib/service";

export const dynamic = "force-dynamic";

/**
 * Earn a short-lived consent to view plaintext passwords. Verifies the console
 * password (brute-forced per IP) and sets an HttpOnly cookie valid five minutes.
 * The reveal and export routes require this cookie — an active session alone
 * is not enough to dump credentials. Every successful consent is audited.
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

    const body = (await readJson(request)) as { password?: unknown };
    if (!passwordMatches(body.password)) {
      return NextResponse.json(
        { error: { code: "AUTH_INVALID", message: "Wrong console password." } },
        { status: 401 },
      );
    }

    logEvent(null, "(console)", "password_revealed", "Console password re-entered to earn reveal consent");

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
