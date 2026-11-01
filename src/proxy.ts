import { NextResponse, type NextRequest } from "next/server";
import { assertTelegramAuth } from "@/lib/telegram";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { errorPayload } from "@/lib/api";

/**
 * The single gate in front of the whole console.
 *
 * Two keys open it:
 * 1. a valid signed session cookie (desktop login, or a Telegram session the
 *    login screen established), or
 * 2. the Telegram initData header — verified against the bot token AND bound
 *    to the owner's Telegram user id, so a stranger who finds the bot and
 *    opens the mini app gets nothing but a locked screen.
 *
 * Read-only trade calculator is public: anyone can check prices and rates
 * without logging in. Everything else (writes, fleet data, settings) stays
 * behind auth.
 *
 * /login itself, the /api/auth routes and static assets stay public so the
 * lock screen can do its job.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Public read-only trade calculator (no login needed) ---
  if (pathname.startsWith("/api/trade/prices") && request.method === "GET") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/trade/rates") && request.method === "GET") {
    return NextResponse.next();
  }
  // Public guest page
  if (pathname === "/trade/guest") {
    return NextResponse.next();
  }

  // --- Owner-only gate ---
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  try {
    await assertTelegramAuth(request);
  } catch (err) {
    const { status, body } = errorPayload(err);
    return NextResponse.json(body, { status });
  }
  if (request.headers.get("X-Telegram-Init-Data")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "AUTH_REQUIRED", message: "Sign in to use the console." } },
      { status: 401 },
    );
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|api/auth|_next|icon.svg|favicon.ico).*)"],
};
