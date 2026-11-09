/**
 * VANTA GARAGE — Admin config CRUD.
 * GET    /api/store/admin/config/:key — get a config value (sensitive included)
 * POST   /api/store/admin/config/:key — set/update a config value
 * DELETE /api/store/admin/config/:key — delete a config key
 */

import { fail, ok, readJson } from "@/lib/route";
import { getConfigRaw, setConfig, deleteConfig } from "@/lib/store/config-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const key = request.url.split("/config/")[1];
    if (!key) {
      return fail({ status: 400, body: { error: { code: "missing_key", message: "Config key required." } } });
    }
    const value = await getConfigRaw(key);
    if (value === null) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Config key not found." } } });
    }
    return ok({ key: value.key, value: value.value, type: value.type, isSensitive: value.isSensitive });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const key = request.url.split("/config/")[1];
    if (!key) {
      return fail({ status: 400, body: { error: { code: "missing_key", message: "Config key required." } } });
    }
    const value = body.value;
    if (value === undefined) {
      return fail({ status: 400, body: { error: { code: "missing_value", message: "Value required." } } });
    }
    await setConfig(key, String(value as string), String(body.type ?? "string"), Boolean(body.isSensitive));
    return ok({ key, value: body.value });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const key = request.url.split("/config/")[1];
    if (!key) {
      return fail({ status: 400, body: { error: { code: "missing_key", message: "Config key required." } } });
    }
    await deleteConfig(key);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}