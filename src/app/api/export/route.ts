import { exportFleet } from "@/lib/service";
import { fail } from "@/lib/route";

export const dynamic = "force-dynamic";

/**
 * Fleet export. Exposes every decrypted password, so it requires an explicit
 * `confirm=true` and writes an `export_performed` audit event.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = (url.searchParams.get("format") ?? "json").toLowerCase();
    const format = raw === "csv" ? "csv" : "json";
    const confirmed = url.searchParams.get("confirm") === "true";

    const { body, contentType } = exportFleet(format, { confirmed });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="cpm2-fleet-${stamp}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
