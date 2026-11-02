import {
  addGarageCar,
  listGarage,
  removeGarageCar,
} from "@/lib/service-turso";
import { fail, ok, parseId, readJson } from "@/lib/route";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** One account's garage inventory. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    return ok({ garage: await listGarage(parseId(id), userId) });
  } catch (err) {
    return fail(err);
  }
}

/** Adds one catalog car to the garage (by carCode from the search UI). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    const accountId = parseId(id);
    const car = await addGarageCar(accountId, await readJson(request), userId);
    return ok({ car, garage: await listGarage(accountId, userId) }, 201);
  } catch (err) {
    return fail(err);
  }
}

/** Removes one car from the garage: DELETE /api/accounts/:id/garage?carId=123 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    const accountId = parseId(id);
    const carId = Number(new URL(request.url).searchParams.get("carId"));
    if (!Number.isInteger(carId) || carId <= 0) {
      return fail(new Error("carId query parameter must be a positive integer."));
    }
    const result = await removeGarageCar(accountId, carId, userId);
    return ok({ ...result, garage: await listGarage(accountId, userId) });
  } catch (err) {
    return fail(err);
  }
}
