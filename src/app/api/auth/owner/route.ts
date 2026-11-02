import { NextResponse } from "next/server";
import { fail } from "@/lib/route";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

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
    const userId = verifySessionToken(cookie ? decodeURIComponent(cookie) : undefined);
    if (!userId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Sign in to use the console." } },
        { status: 401 },
      );
    }
    return NextResponse.json({ user: { id: userId } });
  } catch (err) {
    return fail(err);
  }
}
