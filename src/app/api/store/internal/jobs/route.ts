/**
 * VANTA GARAGE — internal job processor.
 * POST /api/store/internal/jobs — processes all due background jobs.
 * Admin-gated: only callable from within the admin dashboard or cron.
 */

import { fail, ok, readJson } from "@/lib/route";
import { ApiError } from "@/lib/api";
import { assertTelegramAuth } from "@/lib/telegram";
import { requireStoreAdmin } from "@/lib/store/auth";
import { constantTimeEquals } from "@/lib/auth";
import { processJobs } from "@/lib/store/jobs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Two ways in: an admin (Telegram initData) or a scheduled caller holding
    // CRON_SECRET. A cron cannot present Telegram initData, so without this
    // path no external scheduler could ever drive the queue — the retry and
    // reservation machinery only ever ran when an admin opened the dashboard.
    const cronSecret = process.env.CRON_SECRET ?? "";
    const presented = request.headers.get("x-cron-secret") ?? "";
    const isCron = Boolean(cronSecret) && constantTimeEquals(presented, cronSecret);
    if (!isCron) {
      // Admin-only: requires valid Telegram initData
      await requireStoreAdmin(request);
    }

    const body = (await readJson(request)) as { limit?: number };
    const limit = body.limit ?? 50;

    const result = await processJobs();

    return ok({ processed: result.processed, failed: result.failed });
  } catch (err) {
    return fail(err);
  }
}

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);

    const { listDueJobs, listDeadLetterJobs } = await import("@/lib/store/jobs");
    const due = await listDueJobs();
    const dead = await listDeadLetterJobs();

    return ok({ due, deadLetter: dead });
  } catch (err) {
    return fail(err);
  }
}
