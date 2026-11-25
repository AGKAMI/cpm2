import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/route";
import { createUser } from "@/lib/service-turso";
import { userRegisterSchema } from "@/lib/validation";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  trustedClientIp,
} from "@/lib/auth";
import { checkDurableRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * New player registration: POST {email, password, confirmPassword, telegramUserId?}.
 * Creates a user account with a scrypt-hashed password. Email must be unique.
 * Brute-forced attempts are damped per IP.
 * On success, sets the signed session cookie so the new player is logged in
 * immediately instead of being treated as a guest.
 */
export async function POST(request: Request) {
  try {
    // Trust the platform-attested IP, not the first XFF entry the client
        // controls; count durably — serverless instances share no memory.
        const ip = trustedClientIp(request);
        if (await checkDurableRateLimit(`register:${ip}`, 10, 60_000)) {
          return NextResponse.json(
            { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts - wait a minute and try again." } },
            { status: 429 },
          );
        }

        const input = userRegisterSchema.parse(await readJson(request));
        const email = input.email.trim().toLowerCase();

        const user = await createUser(email, input.password);

        const response = NextResponse.json(
          { ok: true, user: { id: user.id, email: user.email } },
          { status: 201 },
        );

        response.cookies.set(
          SESSION_COOKIE,
          createSessionToken(user.id, "console"),
          sessionCookieOptions(request),
        );

        // A client-asserted telegramUserId is NOT bound here. It used to be, with
        // no proof: anyone could register with someone else's Telegram id and
        // squat or steal the binding (there was no unique index on the column,
        // so duplicates were silently accepted too). Telegram identities are
        // attached only through verified initData (/api/auth/telegram) or the
        // store's DM-proof link flow — both of which check a signature this
        // request never had.
        return response;
  } catch (err) {
    return fail(err);
  }
}
