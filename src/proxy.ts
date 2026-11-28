import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, trustedClientIp, verifySessionToken } from "@/lib/auth";
import { checkDurableRateLimit } from "@/lib/rate-limit";

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

function routeBucket(pathname: string): { maxRequests: number; windowMs: number } {
  if (pathname.includes("/api/store/checkout")) return { maxRequests: 10, windowMs: 60_000 };
  if (pathname.includes("/api/store/payments/payfast/webhook")) return { maxRequests: 30, windowMs: 60_000 };
  if (pathname.includes("/api/store/notifications/send")) return { maxRequests: 5, windowMs: 60_000 };
  if (pathname.includes("/api/store/admin/")) return { maxRequests: 20, windowMs: 60_000 };
  if (pathname.includes("/api/telegram/webhook")) return { maxRequests: 60, windowMs: 60_000 };
  if (pathname.startsWith("/api/")) return { maxRequests: 60, windowMs: 60_000 };
  return { maxRequests: 120, windowMs: 60_000 };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Rate limiting (Sec 19.2) ---
  // Trust the platform-attested IP, not the first (client-writable) XFF entry,
  // and count durably — a serverless instance's memory is per-invocation, so
  // rotating the header (or landing on another instance) reset every counter.
  if (pathname.startsWith("/api/")) {
    const ip = trustedClientIp(request);
    const { maxRequests, windowMs } = routeBucket(pathname);
    const limited = await checkDurableRateLimit(`rl:${ip}:${pathname}`, maxRequests, windowMs);

    if (limited) {
      return new NextResponse(
        JSON.stringify({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please slow down and try again later.",
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        },
      );
    }
  }

  // --- Public read-only trade calculator (no login needed) ---
  if (pathname.startsWith("/api/trade/prices") && request.method === "GET") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/trade/rates") && request.method === "GET") {
    return NextResponse.next();
  }
  // Screenshot identification — the trade desk's own rateLimited + Gemini
  // abort cover it, and guests use it before any session exists.
  if (pathname.startsWith("/api/trade/identify")) {
    return NextResponse.next();
  }
  // Public guest page
  if (pathname === "/trade/guest") {
    return NextResponse.next();
  }
  // Public background image for trade desk (no login needed)
  if (pathname.startsWith("/api/bg")) {
    return NextResponse.next();
  }
  // The Telegram webhook authenticates with its secret token inside the route
  // (x-telegram-bot-api-secret-token checked against TELEGRAM_WEBHOOK_SECRET).
  // It must stay reachable — the console session gate used to make it
  // unreachable: Telegram can't log in, so payment updates and link
  // verifications never arrived.
  if (pathname.startsWith("/api/telegram/webhook")) {
    return NextResponse.next();
  }
  // VANTA GARAGE store API has its own identity model — public catalog,
  // guest checkout by player id, order scoping, and its own admin gate
  // (requireStoreAdmin). The console session must not gate it: the store
  // is reachable from any browser, logged in or not.
  if (pathname.startsWith("/api/store/")) {
    return NextResponse.next();
  }
  // The fleet ledger carries its own identity gate (resolveFleetUser:
  // Telegram-first, then the console session, then the owner fallback), so
  // it must not be blocked at the proxy — inside the Telegram mini app there
  // is no console cookie and every fleet call used to 401 here before the
  // route could resolve who the caller is.
  if (
    pathname.startsWith("/api/accounts") ||
    pathname.startsWith("/api/cars") ||
    pathname.startsWith("/api/events")
  ) {
    return NextResponse.next();
  }

  // --- Per-user gate ---
  // Only a CONSOLE-scoped session opens the console; a store-customer token
  // (same numeric user id, different app) is refused here.
  const userId = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, "console");

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
