import { createAccount, fleetStats, listAccounts } from "@/lib/service-turso";
import { fail, ok, readJson } from "@/lib/route";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = currentUserId(request);
    const url = new URL(request.url);
    const archivedParam = url.searchParams.get("archived");
    const archived = archivedParam === "include" ? "include" : archivedParam === "true" ? "only" : "exclude";
    const accounts = await listAccounts({ archived, userId });
    return ok({ accounts, stats: await fleetStats(userId) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = currentUserId(request);
    const account = await createAccount(await readJson(request), userId);
    return ok({ account }, 201);
  } catch (err) {
    return fail(err);
  }
}
