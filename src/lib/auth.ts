/**
 * The console's access lock.
 *
 * Two ways in, one gate:
 * - DESKTOP / LAN browser: type the console password (`APP_PASSWORD`) once and
 *   a signed session cookie keeps the console open for 30 days.
 * - TELEGRAM: the mini app sends Telegram's signed initData; the first person
 *   to also give the correct password becomes the bound OWNER — from then on
 *   ONLY that Telegram user id is accepted, with no password prompt, so anyone
 *   who merely finds the bot sees a locked screen.
 *
 * Everything here is Node-runtime only (fs + node:crypto) — it is shared by
 * src/proxy.ts and the /api/auth routes, both of which run on Node.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getKey } from "./crypto.ts";

/** The cookie that carries the signed session. */
export const SESSION_COOKIE = "cpm2_session";

/** How long one login stays open. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// ---------------------------------------------------------------- sessions

/**
 * Issues a stateless session token: `<expiry-epoch>.<hmac>` — the expiry is
 * signed with the SAME 32-byte key that encrypts account passwords, so there
 * is no session table and nothing to clean up. Tampering with the expiry
 * breaks the HMAC; extending it means re-signing, which requires the key.
 */
export function createSessionToken(now: number = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  return `${expiresAt}.${sessionMac(expiresAt)}`;
}

/** True when the token's signature is valid AND it has not expired. */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresPart = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expiresAt = Number(expiresPart);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= Date.now()) return false;
  return timingSafeEqualStrings(sessionMac(expiresAt), mac);
}

function sessionMac(expiresAt: number): string {
  return crypto.createHmac("sha256", getKey()).update(String(expiresAt)).digest("base64url");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Cookie attributes for the session. Telegram Web (an iframe) needs
 * `SameSite=None; Secure`, which we turn on whenever the request arrived over
 * HTTPS (the Tailscale URL always does); plain local HTTP keeps Lax.
 */
export function sessionCookieOptions(request: Request) {
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "";
  const secure = proto.split(",")[0].trim() === "https" || host.endsWith(".ts.net");
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

// --------------------------------------------------------------- password

/** The console password, without printing it. Empty/absent means locked out. */
export function appPassword(): string | undefined {
  const password = process.env.APP_PASSWORD?.trim();
  return password ? password : undefined;
}

/** Constant-time comparison against the configured password. */
export function passwordMatches(input: unknown): boolean {
  const expected = appPassword();
  if (!expected || typeof input !== "string") return false;
  const given = Buffer.from(input.normalize("NFKC"));
  const wanted = Buffer.from(expected.normalize("NFKC"));
  if (given.length !== wanted.length) {
    // Burn a comparison anyway so wrong-length guesses cost the same time.
    crypto.timingSafeEqual(wanted, wanted);
    return false;
  }
  return crypto.timingSafeEqual(given, wanted);
}

// ------------------------------------------------------- telegram owner binding

function ownerFilePath(): string {
  const override = process.env.CPM2_OWNER_PATH;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.join(process.cwd(), "data", "telegram-owner.json");
}

/** The bound owner's Telegram user id, or null while nobody has claimed it. */
export function telegramOwnerId(): number | null {
  try {
    const raw = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ ownerFilePath(), "utf8")) as {
      userId?: unknown;
    };
    return typeof raw.userId === "number" && Number.isInteger(raw.userId) ? raw.userId : null;
  } catch {
    return null;
  }
}

/** Records WHICH Telegram user claimed the console (first correct password wins). */
export function bindTelegramOwner(userId: number): void {
  const file = ownerFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    /* turbopackIgnore: true */ file,
    `${JSON.stringify({ userId, boundAt: new Date().toISOString() }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

// ------------------------------------------------------------ rate limiting

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Sliding-window brute-force damper for the password routes. True when this
 * key (usually an IP) must back off. Entries age out on their own.
 */
export function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS_PER_WINDOW;
}
