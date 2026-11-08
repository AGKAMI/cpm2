/**
 * VANTA GARAGE — link email + password to a customer.
 * POST /api/store/customers/link-email-password
 * Body: { email, password }
 * Header: X-Telegram-Init-Data (for Telegram users) OR X-Owner-Email (for web owner access)
 *
 * Links an email + password to a customer account so the customer can also
 * log in from the web browser.
 *
 * Telegram users: authenticated via initData, customer found by Telegram link.
 * Web owner: authenticated via X-Owner-Email matching STORE_OWNER_EMAIL env var,
 * customer found/created by email.
 */

import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/route";
import { initDataUserId, telegramBotToken, verifyTelegramInitData } from "@/lib/telegram";
import { scryptHash } from "@/lib/auth";
import { getStoreDb } from "@/lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "Email and password are required." } },
        { status: 400 },
      );
    }

    const ownerEmailEnv = process.env.STORE_OWNER_EMAIL ?? "";
    const ownerEmailHeader = request.headers.get("x-owner-email") ?? "";
    const isOwnerEmail = ownerEmailEnv && ownerEmailHeader.toLowerCase() === ownerEmailEnv.toLowerCase();

    let customerId: number;
    const customerEmail = email.trim().toLowerCase();

    const initData = request.headers.get("x-telegram-init-data") ?? "";

    if (initData) {
      // Telegram path: authenticated via initData
      const token = telegramBotToken();
      if (!token || !(await verifyTelegramInitData(initData, token))) {
        return NextResponse.json(
          { error: { code: "TELEGRAM_AUTH_INVALID", message: "Telegram authentication failed." } },
          { status: 401 },
        );
      }

      const telegramUserId = initDataUserId(initData);
      if (!telegramUserId) {
        return NextResponse.json(
          { error: { code: "TELEGRAM_AUTH_INVALID", message: "No Telegram user ID." } },
          { status: 401 },
        );
      }

      const telegramUserIdStr = String(telegramUserId);
      const db = await getStoreDb();

      const existing = await db.execute({
        sql: `SELECT c.* FROM vanta_customers c
              JOIN vanta_platform_identities pi ON c.id = pi.customer_id
              WHERE pi.platform = 'telegram' AND pi.platform_user_id = ?`,
        args: [telegramUserIdStr],
      });

      if (existing.rows.length === 0) {
        return NextResponse.json(
          { error: { code: "NOT_LINKED", message: "Telegram not linked. Link your Telegram first." } },
          { status: 400 },
        );
      }

      customerId = Number(existing.rows[0].id);
    } else if (isOwnerEmail) {
      // Web owner path: authenticated via X-Owner-Email matching STORE_OWNER_EMAIL
      const db = await getStoreDb();

      // Find existing customer by email
      const existing = await db.execute({
        sql: `SELECT id FROM vanta_customers WHERE email = ? LIMIT 1`,
        args: [customerEmail],
      });

      if (existing.rows.length > 0) {
        customerId = Number(existing.rows[0].id);
      } else {
        // Create a new customer record for the owner
        const now = new Date().toISOString();
        const result = await db.execute({
          sql: `INSERT INTO vanta_customers (email, in_game_name, currency_pref, created_at, updated_at)
                VALUES (?, ?, 'ZAR', ?, ?)`,
          args: [customerEmail, customerEmail.split("@")[0], now, now],
        });
        customerId = Number(result.lastInsertRowid);
      }
    } else {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Authentication required. Link via Telegram or use owner email." } },
        { status: 401 },
      );
    }

    const db = await getStoreDb();

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

    // Ensure unique index on email for ON CONFLICT to work
    await db.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_vanta_customer_credentials_email ON vanta_customer_credentials(email)`,
      args: [],
    });

    // Hash password
    const passwordHash = scryptHash(password);
    const now = new Date().toISOString();

    // Upsert credentials
    await db.execute({
      sql: `INSERT INTO vanta_customer_credentials (customer_id, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              customer_id = excluded.customer_id,
              password_hash = excluded.password_hash,
              updated_at = excluded.updated_at`,
      args: [customerId, customerEmail, passwordHash, now, now],
    });

    return ok({ message: "Email and password saved. You can now log in from the web." });
  } catch (err) {
    return fail(err);
  }
}
