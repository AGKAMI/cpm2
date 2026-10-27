import { NextResponse } from "next/server";
import { fail } from "@/lib/route";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Locks the console again: clears the session cookie. */
export async function POST() {
  try {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    return fail(err);
  }
}
