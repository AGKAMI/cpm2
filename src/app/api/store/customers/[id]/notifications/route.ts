import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { verifySessionToken, readRequestCookie, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customerId = Number(id);

  // Verify authentication via session cookie
  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken);

  if (!sessionUserId || sessionUserId !== customerId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authorized" } },
      { status: 401 }
    );
  }

  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT notifications_enabled FROM vanta_customers WHERE id = ?`,
    args: [customerId],
  });

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Customer not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
      enabled: Number(result.rows[0].notifications_enabled ?? 1) === 1,
    });
  }

  export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customerId = Number(id);

  // Verify authentication via session cookie
  const sessionToken = readRequestCookie(request, SESSION_COOKIE);
  const sessionUserId = verifySessionToken(sessionToken);

  if (!sessionUserId || sessionUserId !== customerId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authorized" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { enabled } = body as { enabled?: boolean };

    if (enabled === undefined) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "enabled is required" } },
        { status: 400 }
      );
    }

    const db = await getStoreDb();
    await db.execute({
      sql: `UPDATE vanta_customers SET notifications_enabled = ?, updated_at = ? WHERE id = ?`,
      args: [enabled ? 1 : 0, new Date().toISOString(), customerId],
    });

    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to update notifications" } },
      { status: 500 }
    );
  }
}
