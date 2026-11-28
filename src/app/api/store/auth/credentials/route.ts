/**
 * VANTA GARAGE — update the caller's web login credentials.
 * PATCH /api/store/auth/credentials  Body: { email?, password? }
 *
 * Identity comes from the store session (either the signed web session or
 * Telegram initData, resolved by getStoreCustomer) — never from the body.
 * ProfileClient's credentials form has always called this route; it never
 * existed, so email/password changes 404'd and silently failed.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStoreDb } from "@/lib/store-db";
import { scryptHash } from "@/lib/auth";
import { getStoreCustomer } from "@/lib/store/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const credentialsSchema = z.object({
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(128).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const linked = await getStoreCustomer(request).catch(() => null);
    if (!linked) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in before changing credentials." } },
        { status: 401 },
      );
    }
    const customerId = linked.customer.id;

    const body = credentialsSchema.parse(await request.json());
    if (body.email === undefined && body.password === undefined) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "Enter at least an email or a password." } },
        { status: 400 },
      );
    }

    const db = await getStoreDb();
    const now = new Date().toISOString();

    if (body.email !== undefined) {
      const email = body.email.toLowerCase();
      // Never steal another customer's login email.
      const clash = await db.execute({
        sql: `SELECT customer_id FROM vanta_customer_credentials WHERE email = ? COLLATE NOCASE LIMIT 1`,
        args: [email],
      });
      if (clash.rows.length > 0 && Number(clash.rows[0].customer_id) !== customerId) {
        return NextResponse.json(
          { error: { code: "EMAIL_EXISTS", message: "That email already belongs to another store account." } },
          { status: 409 },
        );
      }
      await db.execute({
        sql: `UPDATE vanta_customers SET email = ?, updated_at = ? WHERE id = ?`,
        args: [email, now, customerId],
      });
    }

    if (body.password !== undefined) {
      // The credentials row keys off the customer's CURRENT email — read it
      // after any email change above so the upsert lands on the right key.
      const row = (
        await db.execute({
          sql: `SELECT email FROM vanta_customers WHERE id = ?`,
          args: [customerId],
        })
      ).rows[0];
      const currentEmail = String(row?.email ?? "").trim().toLowerCase();
      if (!currentEmail) {
        return NextResponse.json(
          { error: { code: "EMAIL_REQUIRED", message: "Set an email first — the password signs in with it." } },
          { status: 400 },
        );
      }
      const passwordHash = scryptHash(body.password);
      await db.execute({
        sql: `INSERT INTO vanta_customer_credentials (customer_id, email, password_hash, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(email COLLATE NOCASE) DO UPDATE SET
                password_hash = excluded.password_hash,
                updated_at = excluded.updated_at`,
        args: [customerId, currentEmail, passwordHash, now, now],
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Check the email format and password length (8+ characters)." } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Could not update credentials. Try again." } },
      { status: 500 },
    );
  }
}
