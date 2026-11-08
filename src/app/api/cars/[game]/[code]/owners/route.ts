import { carOwners } from "@/lib/service-turso";
import { fail, ok } from "@/lib/route";
import { GAMES, isGameType, type GameType } from "@/lib/constants";
import { parseCarCode } from "@/lib/http";
import { ApiError } from "@/lib/api";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Which accounts hold one car code, inside ONE game.
 *
 * The game is a required path segment (not a query parameter) because the
 * answer is meaningless without it: code 13 is a Peugeot 308 in CPM1 and a
 * Honda Civic in CPM2, so a game-less lookup would return a mix of accounts
 * owning two different cars as if they were one.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string; code: string }> },
) {
  const { game, code } = await params;

  if (!isGameType(game)) {
    return fail(
      new ApiError(400, "game_invalid", `Unknown game "${game}" - expected ${GAMES.join(" or ")}.`),
    );
  }

  let carCode: number;
  try {
    carCode = parseCarCode(code);
  } catch (err) {
    return fail(err);
  }

  const userId = currentUserId(request);
  try {
    return ok({ owners: await carOwners(game as GameType, carCode, userId) });
  } catch (err) {
    return fail(err);
  }
}
