import { archiveAccount, getAccount, updateAccount } from "@/lib/service";
import { fail, ok, parseId, readJson } from "@/lib/route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok({ account: getAccount(parseId(id)) });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const account = updateAccount(parseId(id), await readJson(request));
    return ok({ account });
  } catch (err) {
    return fail(err);
  }
}

/** Soft delete: the account is archived, never destroyed. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok({ archived: archiveAccount(parseId(id)) });
  } catch (err) {
    return fail(err);
  }
}
