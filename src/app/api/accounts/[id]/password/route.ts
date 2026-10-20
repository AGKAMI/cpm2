import { revealPassword } from "@/lib/service";
import { fail, ok, parseId } from "@/lib/route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok(revealPassword(parseId(id)));
  } catch (err) {
    return fail(err);
  }
}
