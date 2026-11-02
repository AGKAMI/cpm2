import { fleetGarages } from "@/lib/service-turso";
import { fail, ok } from "@/lib/route";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Every account's garage, for the fleet-wide catalog ownership marks. */
export async function GET(request: Request) {
  try {
    const userId = currentUserId(request);
    return ok({ garages: await fleetGarages(userId) });
  } catch (err) {
    return fail(err);
  }
}
