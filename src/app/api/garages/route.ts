import { fleetGarages } from "@/lib/service-turso";
import { fail, ok } from "@/lib/route";

export const dynamic = "force-dynamic";

/** Every account's garage, for the fleet-wide catalog ownership marks. */
export async function GET() {
  try {
    return ok({ garages: await fleetGarages() });
  } catch (err) {
    return fail(err);
  }
}
