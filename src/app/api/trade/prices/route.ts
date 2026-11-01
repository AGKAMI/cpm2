import { isGameType } from "@/lib/constants";
import { ApiError } from "@/lib/api";
import { parseCarCode } from "@/lib/http";
import { fail, ok, readJson } from "@/lib/route";
import { deleteTradePrice, listTradePrices, setTradePrice } from "@/lib/trade-store-turso";
import { tradePriceSetSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** The editable price book for one game (`?game=cpm2`). */
export async function GET(request: Request) {
  try {
    const game = new URL(request.url).searchParams.get("game") ?? "";
    if (!isGameType(game)) {
      throw new ApiError(400, "INVALID_GAME", "Game must be cpm1 or cpm2.");
    }
    return ok({ prices: await listTradePrices(game) });
  } catch (err) {
    return fail(err);
  }
}

/** Upsert one car's price entry. */
export async function PUT(request: Request) {
  try {
    const input = tradePriceSetSchema.parse(await readJson(request));
    return ok({ price: await setTradePrice(input.game, input.code, input.kind, input.price) });
  } catch (err) {
    return fail(err);
  }
}

/** Forget one car's price (`?game=cpm2&code=13`). */
export async function DELETE(request: Request) {
  try {
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
