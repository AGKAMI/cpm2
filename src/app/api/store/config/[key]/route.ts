/**
 * VANTA GARAGE — Public config endpoint.
 * GET /api/store/config/:key — get a public (non-sensitive) config value
 */

import { fail, ok } from "@/lib/route";
import { getConfig } from "@/lib/store/config-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const key = request.url.split("/config/")[1];
    if (!key) {
      return fail({ status: 400, body: { error: { code: "missing_key", message: "Config key required." } } });
    }
    const value = await getConfig(key);
    if (value === null) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Config key not found." } } });
    }
    return ok({ key, value });
  } catch (err) {
    return fail(err);
  }
}