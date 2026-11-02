import { listTrophies, setTrophies, trophySummary } from "@/lib/service-turso";
import { fail, ok, parseId, readJson } from "@/lib/route";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Every drag racing class for one account, with the trophy counts per metal. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    const accountId = parseId(id);
    return ok({ trophies: await listTrophies(accountId, userId), summary: await trophySummary(accountId, userId) });
  } catch (err) {
    return fail(err);
  }
}

/** Sets the trophy counts for a single class. */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    const accountId = parseId(id);
    const trophy = await setTrophies(accountId, await readJson(request), userId);
    return ok({ trophy, summary: await trophySummary(accountId, userId) });
  } catch (err) {
    return fail(err);
  }
}
