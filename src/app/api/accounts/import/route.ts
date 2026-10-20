import { importAccounts } from "@/lib/service";
import { fail, ok, readJson } from "@/lib/route";

export const dynamic = "force-dynamic";

/**
 * Bulk import. `format=json` (default) takes an array of accounts, `format=csv`
 * takes a raw CSV body. Every row is validated with the same zod schema used
 * by the manual create endpoint.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const requested = (url.searchParams.get("format") ?? "json").toLowerCase();
    const format = requested === "csv" ? "csv" : "json";

    const contentType = request.headers.get("content-type") ?? "";
    let payload: unknown;

    if (format === "csv" && !contentType.includes("application/json")) {
      payload = await request.text();
    } else {
      payload = await readJson(request);
      if (format === "csv") {
        payload =
          payload && typeof payload === "object"
            ? (payload as { csv?: unknown }).csv
            : undefined;
      }
    }

    const report = importAccounts(payload, format);
    return ok({ import: report }, report.created > 0 ? 201 : 200);
  } catch (err) {
    return fail(err);
  }
}
