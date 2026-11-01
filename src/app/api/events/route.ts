import { listEvents } from "@/lib/service-turso";
import { fail, ok } from "@/lib/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "100");
    return ok({ events: await listEvents(Number.isFinite(limit) ? limit : 100) });
  } catch (err) {
    return fail(err);
  }
}
