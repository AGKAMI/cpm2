import {
  addGarageCar,
  listGarage,
  removeGarageCar,
} from "@/lib/service";
import { fail, ok, parseId, readJson } from "@/lib/route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** One account's garage inventory. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok({ garage: listGarage(parseId(id)) });
  } catch (err) {
    return fail(err);
  }
}

/** Adds one catalog car to the garage (by carCode from the search UI). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const accountId = parseId(id);
    const car = addGarageCar(accountId, await readJson(request));
    return ok({ car, garage: listGarage(accountId) }, 201);
  } catch (err) {
    return fail(err);
  }
}

/** Removes one car from the garage: DELETE /api/accounts/:id/garage?carId=123 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const accountId = parseId(id);
    const carId = Number(new URL(request.url).searchParams.get("carId"));
    if (!Number.isInteger(carId) || carId <= 0) {
      return fail(new Error("carId query parameter must be a positive integer."));
    }
    const result = removeGarageCar(accountId, carId);
    return ok({ ...result, garage: listGarage(accountId) });
  } catch (err) {
    return fail(err);
  }
}
