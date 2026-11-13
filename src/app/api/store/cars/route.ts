/** VANTA GARAGE — CPM2 car catalog from Fleet Ledger DB.
 * GET /api/store/cars — returns all CPM2 cars (code + name) from vanta_cpm2_cars table.
 * CPM2 only — no CPM1 mixing.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { ok } from "@/lib/route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const store = await getStoreDb();
    const result = await store.execute({
      sql: `SELECT code, name FROM vanta_cpm2_cars ORDER BY code`,
      args: [],
    });

    const cars = result.rows.map((row: any) => ({
      code: Number(row.code),
      name: String(row.name),
      game: "cpm2",
    }));

    return ok({ cars });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err?.message || "Failed to load cars" } },
      { status: 500 }
    );
  }
}
