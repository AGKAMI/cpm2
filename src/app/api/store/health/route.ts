/**
 * VANTA GARAGE — Health check endpoint.
 * GET /api/store/health — returns DB connectivity, API status, uptime.
 */

import { ok, fail } from "@/lib/route";
import { getStoreDb } from "@/lib/store/store-db.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    const db = await getStoreDb();
    await db.execute({ sql: "SELECT 1", args: [] });
    const dbLatency = Date.now() - start;

    return ok({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: "connected",
        latencyMs: dbLatency,
      },
    });
  } catch (err) {
    return fail({
      status: 503,
      body: {
        error: {
          code: "database_error",
          message: "Database connection failed.",
          details: err instanceof Error ? err.message : String(err),
        },
      },
    });
  }
}