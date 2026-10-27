import { NextResponse, type NextRequest } from "next/server";
import { assertTelegramAuth } from "@/lib/telegram";
import { errorPayload } from "@/lib/api";

/**
 * The single choke point in front of the API.
 *
 * Requests that carry the Telegram Mini App's `X-Telegram-Init-Data` header
 * must carry a real Telegram signature for THIS bot — a forged or stale one
 * is refused with 401 before any business logic runs. Requests without the
 * header (the desktop window, the LAN, Tailscale) pass untouched, because the
 * tracker has no other auth layer and gating them here would break everything
 * that already works.
 */
export async function proxy(request: NextRequest) {
  try {
    await assertTelegramAuth(request);
  } catch (err) {
    const { status, body } = errorPayload(err);
    return NextResponse.json(body, { status });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
