import { createAccount, fleetStats, listAccounts } from "@/lib/service-turso";
import { fail, ok, readJson } from "@/lib/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const archivedParam = url.searchParams.get("archived");
    const archived = archivedParam === "include" ? "include" : archivedParam === "true" ? "only" : "exclude";
    const accounts = await listAccounts({ archived });
    return ok({ accounts, stats: await fleetStats() });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const account = await createAccount(await readJson(request));
    return ok({ account }, 201);
  } catch (err) {
    return fail(err);
  }
}
