import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { scryptHash, createSessionToken, sessionCookieOptions, trustedClientIp } from "@/lib/auth";
import { checkDurableRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Platform-attested IP + durable counter (serverless shares no memory).
  const ip = trustedClientIp(request);
  if (await checkDurableRateLimit(`store-register:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
      { status: 429 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {}; // empty or malformed body -> validation below, not a 500
    }
    // playerId is deliberately NOT accepted as an identity claim. It used to
    // be: an anonymous POST with any (email, password, playerId) resolved the
    // victim's customer row by that playerId, overwrote their email,
    // attached the ATTACKER's credentials, and issued a session for the
    // victim's account — a full takeover, and player ids are short and
    // visible in orders/URLs. A guest record's history is only ever bound to
    // a login through a verified identity (Telegram link or the DM-proof
    // flow), never through a guessable string.
    const { email, password } = body as { email?: string; password?: string; playerId?: string };

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

    // Every registration creates its OWN customer — no lookup, no claiming,
        // no email overwrite (see the playerId note above).
        const now = new Date().toISOString();
        const result = await db.execute({
          sql: `INSERT INTO vanta_customers (email, in_game_name, currency_pref, created_at, updated_at)
                VALUES (?, ?, 'ZAR', ?, ?)`,
          args: [customerEmail, customerEmail.split("@")[0], now, now],
        });
        const customerId = Number(result.lastInsertRowid);

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
    const credsNow = new Date().toISOString();

    // Insert credentials
    await db.execute({
      sql: `INSERT INTO vanta_customer_credentials (customer_id, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [customerId, customerEmail, passwordHash, credsNow, credsNow],
    });

    // Create session token and set cookie
    // Store-scoped session: it unlocks the storefront, never the console.
    const token = createSessionToken(customerId, "store");
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
