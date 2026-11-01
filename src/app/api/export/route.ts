import { exportFleet } from "@/lib/service-turso";
import { fail } from "@/lib/route";
import { REVEAL_CONSENT_COOKIE, readRequestCookie, verifyRevealConsentToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Fleet export. Exposes every decrypted password, so it requires an explicit
 * `confirm=true` AND a fresh reveal-consent cookie (console password re-entered
 * within the last five minutes). An active session alone is not enough.
 */
export async function GET(request: Request) {
  try {
    const consent = readRequestCookie(request, REVEAL_CONSENT_COOKIE);
    if (!verifyRevealConsentToken(consent)) {
      return new Response(
        JSON.stringify({
          error: {
            code: "REVEAL_CONSENT_REQUIRED",
            message: "Re-enter the console password to export the fleet.",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const url = new URL(request.url);
    const raw = (url.searchParams.get("format") ?? "json").toLowerCase();
    const format = raw === "csv" ? "csv" : "json";
    const confirmed = url.searchParams.get("confirm") === "true";

    const { body, contentType } = await exportFleet(format, { confirmed });
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
