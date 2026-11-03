import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * The single gate in front of the whole console.
 *
 * One key opens it: a valid signed session cookie bound to a specific user.
 * Read-only trade calculator is public: anyone can check prices and rates
 * without logging in. Everything else (writes, fleet data, settings) stays
 * behind per-user auth.
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

  // --- Per-user gate ---
  const userId = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  // API routes always require auth (401 JSON). Page routes load for everyone —
  // GuestGate blurs them client-side when there's no session, so guests can
  // see what they're missing and tap straight into sign in.
  if (pathname.startsWith("/api/")) {
    if (userId) return NextResponse.next();
    return NextResponse.json(
      { error: { code: "AUTH_REQUIRED", message: "Sign in to use the console." } },
      { status: 401 },
    );
  }

  // Pages are public; the client decides whether to blur.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|auth|api/auth|_next|icon.svg|favicon.ico).*)",
  ],
};
