import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { scryptHash, createSessionToken, sessionCookieOptions, rateLimited } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`store-register:${ip}`)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, password, playerId } = body as { email?: string; password?: string; playerId?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "Email and password are required." } },
        { status: 400 }
      );
    }

    const customerEmail = email.trim().toLowerCase();
    const db = await getStoreDb();

    // Check if credentials already exist for this email
    const existingCreds = await db.execute({
      sql: `SELECT customer_id FROM vanta_customer_credentials WHERE email = ? LIMIT 1`,
      args: [customerEmail],
    });

    if (existingCreds.rows.length > 0) {
      return NextResponse.json(
        { error: { code: "EMAIL_EXISTS", message: "An account with this email already exists. Please log in." } },
        { status: 400 }
      );
    }

    let customerId: number;

    if (playerId && playerId.trim()) {
      // Find customer by playerId (web guest who checked out)
      const customer = await db.execute({
        sql: `SELECT id FROM vanta_customers WHERE player_id = ? LIMIT 1`,
        args: [playerId.trim()],
      });

      if (customer.rows.length > 0) {
        customerId = Number(customer.rows[0].id);
        // Update customer with email if not set
        await db.execute({
          sql: `UPDATE vanta_customers SET email = ?, updated_at = ? WHERE id = ?`,
          args: [customerEmail, new Date().toISOString(), customerId],
        });
      } else {
        // Create new customer with playerId and email
        const now = new Date().toISOString();
        const result = await db.execute({
          sql: `INSERT INTO vanta_customers (in_game_name, player_id, email, currency_pref, created_at, updated_at)
                VALUES (?, ?, ?, 'ZAR', ?, ?)`,
          args: ["", playerId.trim(), customerEmail, now, now],
        });
        customerId = Number(result.lastInsertRowid);
      }
    } else {
      // Create new customer with just email
      const now = new Date().toISOString();
      const result = await db.execute({
        sql: `INSERT INTO vanta_customers (email, in_game_name, currency_pref, created_at, updated_at)
              VALUES (?, ?, 'ZAR', ?, ?)`,
        args: [customerEmail, customerEmail.split("@")[0], now, now],
      });
      customerId = Number(result.lastInsertRowid);
    }

    // Create credentials table if not exists
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS vanta_customer_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES vanta_customers(id)
          )`,
      args: [],
    });

    // Ensure unique index on email
    await db.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_vanta_customer_credentials_email ON vanta_customer_credentials(email)`,
      args: [],
    });

    // Hash password
    const passwordHash = scryptHash(password);
    const now = new Date().toISOString();

    // Insert credentials
    await db.execute({
      sql: `INSERT INTO vanta_customer_credentials (customer_id, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [customerId, customerEmail, passwordHash, now, now],
    });

    // Create session token and set cookie
    const token = createSessionToken(customerId);
    const response = NextResponse.json({
      customer: {
        id: customerId,
        email: customerEmail,
      },
    });

    response.cookies.set("cpm2_session", token, sessionCookieOptions(request));
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Registration failed. Try again." } },
      { status: 500 }
    );
  }
}
