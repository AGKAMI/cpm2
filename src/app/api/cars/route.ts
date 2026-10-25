import { CAR_CATALOG, carsForGame, searchCars } from "@/lib/car-catalog";
import { GAMES, type GameType } from "@/lib/constants";
import { fail, ok } from "@/lib/route";
import { ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * The car catalog for BOTH games, optionally filtered.
 * GET /api/cars?q=supra          -> name substring matches
 * GET /api/cars?q=49             -> code prefix matches
 * GET /api/cars?game=cpm1        -> restrict to one game
 * GET /api/cars                  -> first 30 across both games
 *
 * `game` is a real discriminator, not a cosmetic filter: code 13 is a 2007
 * Peugeot 308 in CPM1 and a HONDA CIVIC in CPM2, so an unfiltered numeric
 * search can legitimately return two different cars.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const requested = url.searchParams.get("game");

    let game: GameType | undefined;
    if (requested !== null && requested !== "") {
      if (!(GAMES as readonly string[]).includes(requested)) {
        throw new ApiError(400, "game_invalid", `game must be one of ${GAMES.join(", ")}.`);
      }
      game = requested as GameType;
    }

    const cars = searchCars(q, 50, game);
    const total = game ? carsForGame(game).length : CAR_CATALOG.length;
    return ok({ query: q, game: game ?? null, total, cars });
  } catch (err) {
    return fail(err);
  }
}
