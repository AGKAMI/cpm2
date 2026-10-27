import { NextResponse } from "next/server";
import { fail } from "@/lib/route";
import { SESSION_COOKIE, telegramOwnerId, verifySessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Who owns this console — for the Settings page's Access panel. The path sits
 * in the public /api/auth subtree, so it enforces the session itself instead
 * of relying on the proxy.
 */
export async function GET(request: Request) {
  try {
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    if (!verifySessionToken(cookie ? decodeURIComponent(cookie) : undefined)) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Sign in to use the console." } },
        { status: 401 },
      );
    }
    return NextResponse.json({ owner: { userId: telegramOwnerId() } });
  } catch (err) {
    return fail(err);
  }
}
