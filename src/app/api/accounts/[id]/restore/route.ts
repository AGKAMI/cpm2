import { restoreAccount } from "@/lib/service-turso";
import { fail, ok, parseId } from "@/lib/route";
import { resolveFleetUser } from "@/lib/fleet-identity";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Brings an archived account back into the fleet. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const identity = await resolveFleetUser(request);
    const userId = identity?.userId;
    const { id } = await context.params;
    return ok({ account: await restoreAccount(parseId(id), userId) });
  } catch (err) {
    return fail(err);
  }
}
