import { CAR_CATALOG, searchCars } from "@/lib/car-catalog";
import { fail, ok } from "@/lib/route";

export const dynamic = "force-static";

/**
 * The full CPM2 car catalog, optionally filtered.
 * GET /api/cars?q=supra        -> name substring matches
 * GET /api/cars?q=49           -> code prefix matches
 * GET /api/cars                -> first 30 of the full list
 */
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const cars = searchCars(q, 50);
    return ok({ query: q, total: CAR_CATALOG.length, cars });
  } catch (err) {
    return fail(err);
  }
}
