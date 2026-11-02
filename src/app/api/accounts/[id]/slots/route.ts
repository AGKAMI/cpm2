import { purchaseSlots } from "@/lib/service-turso";
import { fail, ok, parseId, readJson } from "@/lib/route";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    const account = await purchaseSlots(parseId(id), await readJson(request), userId);
    return ok({ account });
  } catch (err) {
    return fail(err);
  }
}
