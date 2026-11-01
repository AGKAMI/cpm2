import { archiveAccount, getAccount, updateAccount } from "@/lib/service-turso";
import { fail, ok, parseId, readJson } from "@/lib/route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok({ account: await getAccount(parseId(id)) });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const account = await updateAccount(parseId(id), await readJson(request));
    return ok({ account });
  } catch (err) {
    return fail(err);
  }
}

/** Soft delete: the account is archived, never destroyed. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok({ archived: await archiveAccount(parseId(id)) });
  } catch (err) {
    return fail(err);
  }
}
