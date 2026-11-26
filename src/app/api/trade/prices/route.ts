import { NextResponse } from "next/server";
import { isGameType } from "@/lib/constants";
import { ApiError } from "@/lib/api";
import { parseCarCode } from "@/lib/http";
import { fail, ok, readJson } from "@/lib/route";
import { deleteTradePrice, listTradePrices, setTradePrice } from "@/lib/trade-store-turso";
import { tradePriceSetSchema } from "@/lib/validation";
import { trustedClientIp } from "@/lib/auth";
import { checkDurableRateLimit } from "@/lib/rate-limit";
import { isSignedOwnerSession } from "@/lib/store/admin-service";

export const dynamic = "force-dynamic";

/** The editable price book for one game (`?game=cpm2`). */
export async function GET(request: Request) {
  try {
    // Platform-attested IP + durable counter (the first XFF entry is
    // client-writable, and serverless instances share no memory).
    const ip = trustedClientIp(request);
    if (await checkDurableRateLimit(`trade:prices:${ip}`, 60, 60_000)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts - wait a minute and try again." } },
        { status: 429 },
      );
    }
    const game = new URL(request.url).searchParams.get("game") ?? "";
    if (!isGameType(game)) {
      throw new ApiError(400, "INVALID_GAME", "Game must be cpm1 or cpm2.");
    }
    return ok({ prices: await listTradePrices(game) });
  } catch (err) {
    return fail(err);
  }
}

/** Upsert one car's price entry. OWNER ONLY: the price book drives every
 *  trade valuation, and a plain console session (any logged-in player) used
 *  to be enough to rewrite it. */
export async function PUT(request: Request) {
  try {
    if (!(await isSignedOwnerSession(request))) {
      return NextResponse.json(
        { error: { code: "NOT_OWNER", message: "Only the owner can change the price book." } },
        { status: 403 },
      );
    }
    const ip = trustedClientIp(request);
    if (await checkDurableRateLimit(`trade:prices:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts - wait a minute and try again." } },
        { status: 429 },
      );
    }
    const input = tradePriceSetSchema.parse(await readJson(request));
    return ok({ price: await setTradePrice(input.game, input.code, input.kind, input.price) });
  } catch (err) {
    return fail(err);
  }
}

/** Forget one car's price (`?game=cpm2&code=13`). */
export async function DELETE(request: Request) {
  try {
    // Owner only, same as PUT — deleting a valuation is a write.
    if (!(await isSignedOwnerSession(request))) {
      return NextResponse.json(
        { error: { code: "NOT_OWNER", message: "Only the owner can change the price book." } },
        { status: 403 },
      );
    }
    const ip = trustedClientIp(request);
    if (await checkDurableRateLimit(`trade:prices:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts - wait a minute and try again." } },
        { status: 429 },
      );
    }
    const params = new URL(request.url).searchParams;
    const game = params.get("game") ?? "";
    if (!isGameType(game)) {
      throw new ApiError(400, "INVALID_GAME", "Game must be cpm1 or cpm2.");
    }
    const code = parseCarCode(params.get("code") ?? "");
    return ok({ deleted: await deleteTradePrice(game, code) });
  } catch (err) {
    return fail(err);
  }
}
