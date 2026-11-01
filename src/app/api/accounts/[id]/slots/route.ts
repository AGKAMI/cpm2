import { purchaseSlots } from "@/lib/service-turso";
import { fail, ok, parseId, readJson } from "@/lib/route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const account = await purchaseSlots(parseId(id), await readJson(request));
    return ok({ account });
  } catch (err) {
    return fail(err);
  }
}
