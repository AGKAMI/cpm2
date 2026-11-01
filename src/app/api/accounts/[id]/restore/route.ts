import { restoreAccount } from "@/lib/service-turso";
import { fail, ok, parseId } from "@/lib/route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Brings an archived account back into the fleet. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok({ account: await restoreAccount(parseId(id)) });
  } catch (err) {
    return fail(err);
  }
}
