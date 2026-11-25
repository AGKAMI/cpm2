import { NextRequest, NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const opts = sessionCookieOptions(request);

  // Clearing only cpm2_session used to leave every other identity artefact on
  // the browser: the vanta_telegram_id cookie that attaches a Telegram id to
  // a WEB customer, the 5-minute reveal-consent token, and any legacy
  // owner-email cookie. Logout has to clear all of them.
  response.cookies.set("cpm2_session", "", { ...opts, maxAge: 0 });
  response.cookies.set("vanta_telegram_id", "", { ...opts, maxAge: 0 });
  response.cookies.set("cpm2_reveal_pw", "", { ...opts, maxAge: 0 });
  response.cookies.set("vanta_owner_email", "", { ...opts, maxAge: 0 });

  return response;
}
