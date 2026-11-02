import { restoreAccount } from "@/lib/service-turso";
import { fail, ok, parseId } from "@/lib/route";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Brings an archived account back into the fleet. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    return ok({ account: await restoreAccount(parseId(id), userId) });
  } catch (err) {
    return fail(err);
  }
}
