import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { rateLimit } from "@/lib/store/rate-limit";

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

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function routeBucket(pathname: string): { maxRequests: number; windowMs: number } {
  if (pathname.includes("/api/store/checkout")) return { maxRequests: 10, windowMs: 60_000 };
  if (pathname.includes("/api/store/payments/payfast/webhook")) return { maxRequests: 30, windowMs: 60_000 };
  if (pathname.includes("/api/store/notifications/send")) return { maxRequests: 5, windowMs: 60_000 };
  if (pathname.includes("/api/store/admin/")) return { maxRequests: 20, windowMs: 60_000 };
  if (pathname.startsWith("/api/")) return { maxRequests: 60, windowMs: 60_000 };
  return { maxRequests: 120, windowMs: 60_000 };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Rate limiting (Sec 19.2) ---
  if (pathname.startsWith("/api/")) {
    const ip = clientIp(request);
    const { maxRequests, windowMs } = routeBucket(pathname);
    const result = rateLimit(`rl:${ip}:${pathname}`, { maxRequests, windowMs });

    if (!result.allowed) {
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
            "Retry-After": Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
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
  // Public guest page
  if (pathname === "/trade/guest") {
    return NextResponse.next();
  }
  // Public background image for trade desk (no login needed)
  if (pathname.startsWith("/api/bg")) {
    return NextResponse.next();
  }
  // VANTA GARAGE store API has its own identity model — public catalog,
  // guest checkout by player id, order scoping, and its own admin gate
  // (requireStoreAdmin). The console session must not gate it: the store
  // is reachable from any browser, logged in or not.
  if (pathname.startsWith("/api/store/")) {
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
