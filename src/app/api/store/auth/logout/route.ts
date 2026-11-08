import { NextRequest, NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("cpm2_session", "", { ...sessionCookieOptions(request), maxAge: 0 });
  return response;
}
