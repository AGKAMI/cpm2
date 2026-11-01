import { NextResponse } from "next/server";
import { getTradeRates, setTradeRates } from "@/lib/trade-store-turso";
import { fail, ok, readJson } from "@/lib/route";
import { tradeRatesSchema } from "@/lib/validation";
import { rateLimited } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The real-money conversion rates behind every trade valuation. */
export async function GET(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (rateLimited(`trade:rates:${ip}`)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts — wait a minute and try again." } },
        { status: 429 },
      );
    }
    return ok({ rates: await getTradeRates() });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (rateLimited(`trade:rates:${ip}`)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts — wait a minute and try again." } },
        { status: 429 },
      );
    }
    const input = tradeRatesSchema.parse(await readJson(request));
    return ok({ rates: await setTradeRates(input) });
  } catch (err) {
    return fail(err);
  }
}
