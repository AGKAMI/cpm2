import { NextResponse } from "next/server";
import { getTradeRates, setTradeRates } from "@/lib/trade-store-turso";
import { fail, ok, readJson } from "@/lib/route";
import { tradeRatesSchema } from "@/lib/validation";
import { trustedClientIp } from "@/lib/auth";
import { checkDurableRateLimit } from "@/lib/rate-limit";
import { isSignedOwnerSession } from "@/lib/store/admin-service";

export const dynamic = "force-dynamic";

/** The real-money conversion rates behind every trade valuation. */
export async function GET(request: Request) {
  try {
    // Platform-attested IP + durable counter (the first XFF entry is
    // client-writable, and serverless instances share no memory).
    const ip = trustedClientIp(request);
    if (await checkDurableRateLimit(`trade:rates:${ip}`, 60, 60_000)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts - wait a minute and try again." } },
        { status: 429 },
      );
    }
    return ok({ rates: await getTradeRates() });
  } catch (err) {
    return fail(err);
  }
}

/** OWNER ONLY: these rates are the real-money conversion behind every
 *  valuation; any console session used to be able to rewrite them. */
export async function PUT(request: Request) {
  try {
    if (!(await isSignedOwnerSession(request))) {
      return NextResponse.json(
        { error: { code: "NOT_OWNER", message: "Only the owner can change the rates." } },
        { status: 403 },
      );
    }
    const ip = trustedClientIp(request);
    if (await checkDurableRateLimit(`trade:rates:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts - wait a minute and try again." } },
        { status: 429 },
      );
    }
    const input = tradeRatesSchema.parse(await readJson(request));
    return ok({ rates: await setTradeRates(input) });
  } catch (err) {
    return fail(err);
  }
}
