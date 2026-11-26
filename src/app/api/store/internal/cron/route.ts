/**
 * Scheduled maintenance endpoint.
 * GET /api/store/internal/cron — Vercel Cron (or any scheduler) calls this.
 *
 * Vercel Cron always issues GET with `Authorization: Bearer <CRON_SECRET>`;
 * manual/CLI callers may send `x-cron-secret` instead. Unauthenticated calls
 * are refused. Processing here (rather than relying on unawaited work in a
 * page render) makes reservation expiry and job retries reliable on
 * serverless, where the runtime can freeze after the response is sent.
 */

import { fail, ok } from "@/lib/route";
import { constantTimeEquals } from "@/lib/auth";
import { processJobs, sweepExpiredReservations } from "@/lib/store/jobs";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  try {
    const configured = process.env.CRON_SECRET ?? "";
    const authHeader = request.headers.get("authorization") ?? "";
    const presented = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : request.headers.get("x-cron-secret") ?? "";
    if (!configured || !constantTimeEquals(presented, configured)) {
      return fail({
        status: 401,
        body: { error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } },
      });
    }

    const sweep = await sweepExpiredReservations();
    const jobs = await processJobs();
    return ok({ ...sweep, ...jobs });
  } catch (err) {
    return fail(err);
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
