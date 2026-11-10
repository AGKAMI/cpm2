/**
 * VANTA GARAGE — Next.js middleware.
 * Sec 19.2: rate limiting applied globally to sensitive API routes.
 *
 * Limits:
 *   - /api/store/checkout → 10 req / min per IP
 *   - /api/store/payments/payfast/webhook → 30 req / min per IP
 *   - /api/store/notifications/send → 5 req / min per IP
 *   - /api/store/admin/* → 20 req / min per IP
 *   - Default API → 60 req / min per IP
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/store/rate-limit";

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

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) return NextResponse.next();

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

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(maxRequests));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.resetTime));
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
