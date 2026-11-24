/**
 * VANTA GARAGE — categories API.
 * GET /api/store/categories
 */

import { fail, ok } from "@/lib/route";
import { listCategories } from "@/lib/store/products";
import type { ProductGame } from "@/lib/store-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Public: category browsing is open (see products route).
    // `game` scopes the tree; omit it for every category (admin views).
    const gameParam = new URL(request.url).searchParams.get("game");
    const game =
      gameParam === "cpm1" || gameParam === "cpm2" ? (gameParam as ProductGame) : undefined;
    const categories = await listCategories(game);
    return ok({ categories });
  } catch (err) {
    return fail(err);
  }
}
