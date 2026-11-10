import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";
import { fetchTelegramPhotoUrl } from "@/lib/telegram";

/** GET /api/store/telegram-avatar
 *  Streams the calling customer's linked Telegram profile photo through the
 *  server so the bot token never reaches the client. 404 when there is no
 *  session link or no photo. */
export async function GET(request: NextRequest) {
  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken);
  if (!sessionUserId) return new NextResponse(null, { status: 401 });

  const db = await getStoreDb();
  const identity = await db.execute({
    sql: `SELECT platform_user_id FROM vanta_platform_identities WHERE platform = 'telegram' AND customer_id = ? LIMIT 1`,
    args: [sessionUserId],
  });
  if (identity.rows.length === 0) return new NextResponse(null, { status: 404 });

  const url = await fetchTelegramPhotoUrl(Number(identity.rows[0].platform_user_id));
  if (!url) return new NextResponse(null, { status: 404 });

  const photo = await fetch(url);
  if (!photo.ok || !photo.body) return new NextResponse(null, { status: 404 });

  return new NextResponse(photo.body, {
    headers: {
      "Content-Type": photo.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=900",
    },
  });
}
