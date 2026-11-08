import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { scryptCompare, createSessionToken, sessionCookieOptions, rateLimited } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`store-login:${ip}`)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." } },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "Email and password are required." } },
        { status: 400 }
      );
    }

    const customerEmail = email.trim().toLowerCase();
    const db = await getStoreDb();

    // Find credentials by email
    const creds = await db.execute({
      sql: `SELECT customer_id, email, password_hash FROM vanta_customer_credentials WHERE email = ? LIMIT 1`,
      args: [customerEmail],
    });

    if (creds.rows.length === 0) {
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } },
        { status: 401 }
      );
    }

    const storedHash = String(creds.rows[0].password_hash);
    const customerId = Number(creds.rows[0].customer_id);

    // Verify password
    if (!scryptCompare(password, storedHash)) {
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } },
        { status: 401 }
      );
    }

    // Get customer details
    const customer = await db.execute({
      sql: `SELECT id, in_game_name, player_id, email, currency_pref FROM vanta_customers WHERE id = ?`,
      args: [customerId],
    });

    if (customer.rows.length === 0) {
      return NextResponse.json(
        { error: { code: "CUSTOMER_NOT_FOUND", message: "Customer record not found." } },
        { status: 404 }
      );
    }

    const c = customer.rows[0];

    // Create session token and set cookie
    const token = createSessionToken(customerId);
    const response = NextResponse.json({
      customer: {
        id: Number(c.id),
        inGameName: String(c.in_game_name ?? ""),
        playerId: String(c.player_id ?? ""),
        email: String(c.email ?? ""),
        currencyPref: String(c.currency_pref ?? "ZAR"),
      },
    });

    response.cookies.set("cpm2_session", token, sessionCookieOptions(request));
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Login failed. Try again." } },
      { status: 500 }
    );
  }
}
