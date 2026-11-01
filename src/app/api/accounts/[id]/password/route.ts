import { revealPassword } from "@/lib/service-turso";
import { fail, ok, parseId } from "@/lib/route";
import { REVEAL_CONSENT_COOKIE, readRequestCookie, verifyRevealConsentToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const consent = readRequestCookie(request, REVEAL_CONSENT_COOKIE);
    if (!verifyRevealConsentToken(consent)) {
      return new Response(
        JSON.stringify({
          error: {
            code: "REVEAL_CONSENT_REQUIRED",
            message: "Re-enter the console password to view stored passwords.",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const { id } = await context.params;
    return ok(await revealPassword(parseId(id)));
  } catch (err) {
    return fail(err);
  }
}
