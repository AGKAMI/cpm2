import { archiveAccount, getAccount, updateAccount } from "@/lib/service-turso";
import { fail, ok, parseId, readJson } from "@/lib/route";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    return ok({ account: await getAccount(parseId(id), userId) });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    const account = await updateAccount(parseId(id), await readJson(request), userId);
    return ok({ account });
  } catch (err) {
    return fail(err);
  }
}

/** Soft delete: the account is archived, never destroyed. */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    return ok({ archived: await archiveAccount(parseId(id), userId) });
  } catch (err) {
    return fail(err);
  }
}
