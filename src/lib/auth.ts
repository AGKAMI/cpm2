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
import { getKey } from "./crypto.ts";

/** The cookie that carries the signed session. */
export const SESSION_COOKIE = "cpm2_session";

/** How long one login stays open. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * A short-lived, separately-scoped consent that must be freshly earned before
 * plaintext passwords can be revealed or exported. An active session alone is
 * not enough — the console password must be re-entered, so a stolen session
 * cookie (or a briefly unattended unlocked console) cannot dump credentials.
 */
export const REVEAL_CONSENT_COOKIE = "cpm2_reveal_pw";
export const REVEAL_CONSENT_MAX_AGE_SECONDS = 5 * 60; // 5 minutes

// ---------------------------------------------------------------- password hashing

function hashRounds(): number {
  const rounds = Number(process.env.CPM2_BCRYPT_ROUNDS ?? "12");
  return Number.isFinite(rounds) && rounds > 0 ? rounds : 12;
}

function scryptHash(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(
    Buffer.from(password.normalize("NFKC"), "utf8"),
    salt,
    64,
    { N: 2 ** hashRounds(), r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
  );
  return `$scrypt$v1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

function scryptCompare(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "" || parts[1] !== "scrypt" || parts[2] !== "v1") {
    return false;
  }
  let salt: Buffer;
  try {
    salt = Buffer.from(parts[3], "base64url");
  } catch {
    return false;
  }
  let expected: Buffer;
  try {
    expected = Buffer.from(parts[4], "base64url");
  } catch {
    return false;
  }
  const given = crypto.scryptSync(
    Buffer.from(password.normalize("NFKC"), "utf8"),
    salt,
    expected.length,
    { N: 2 ** hashRounds(), r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
  );
  return timingSafeEqualBuffers(given, expected);
}

function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- sessions

/**
 * Which app a session belongs to. The console (fleet/accounts/trade) and the
 * storefront used to share one signing scheme with no audience claim, so a
 * session minted by one unlocked the other for the same numeric user id. Every
 * token now carries its scope, and a verifier that names a scope refuses
 * tokens from any other one.
 */
export type SessionScope = "console" | "store";

const SESSION_SCOPES: readonly string[] = ["console", "store"];

/**
 * Issues a stateless session token: `<scope>.<user-id>.<expiry-epoch>.<hmac>`.
 * The HMAC binds all three fields to the signing key, so tampering with any
 * of them breaks the signature. No session table, nothing to clean up.
 */
export function createSessionToken(
  userId: number,
  scope: SessionScope,
  now: number = Date.now(),
): string {
  if (!SESSION_SCOPES.includes(scope)) {
    throw new Error(`Unknown session scope: ${scope}`);
  }
  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${scope}.${userId}.${expiresAt}`;
  return `${payload}.${sessionMac(payload)}`;
}

/**
 * Parses a session token and returns the user id when valid, unexpired AND —
 * when a scope is given — minted for that scope. Returns null otherwise.
 * Note: existing sessions were issued without a scope, so this one fix
 * invalidates them once and everyone logs in again.
 */
export function verifySessionToken(
  token: string | undefined,
  expectedScope?: SessionScope,
): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [scopePart, userIdPart, expiresPart, mac] = parts;
  if (expectedScope && scopePart !== expectedScope) return null;
  if (!SESSION_SCOPES.includes(scopePart)) return null;
  const userId = Number(userIdPart);
  const expiresAt = Number(expiresPart);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= Date.now()) return null;
  const payload = `${scopePart}.${userId}.${expiresAt}`;
  return timingSafeEqualStrings(sessionMac(payload), mac) ? userId : null;
}

/**
 * A signing key derived from the encryption key, scoped to sessions only.
 * HKDF is one-way: a stolen session cookie never yields the encryption key,
 * and the two purposes can be rotated independently in future.
 */
function sessionKey(): Buffer {
  return crypto.createHash("sha256").update(getKey()).update("cpm2-session-v1").digest();
}

function sessionMac(payload: string): string {
  return crypto.createHmac("sha256", sessionKey()).update(payload).digest("base64url");
}

/** A short-lived consent token (expiry.hmac) proving the console password was
 * re-entered recently. Used to gate password reveal and export. */
export function createRevealConsentToken(now: number = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + REVEAL_CONSENT_MAX_AGE_SECONDS;
  return `${expiresAt}.${revealMac(expiresAt)}`;
}

function revealMac(expiresAt: number): string {
  return crypto.createHmac("sha256", sessionKey()).update(`reveal:${expiresAt}`).digest("base64url");
}

export function verifyRevealConsentToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresPart = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expiresAt = Number(expiresPart);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= Date.now()) return false;
  return timingSafeEqualStrings(revealMac(expiresAt), mac);
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
  const proto = request.headers.get("x-forwarded-proto") ?? "";
  // Secure follows the actual protocol, from either source:
  //   - the request URL itself (https://...)
  //   - the proxy hop (x-forwarded-proto), which is how a TLS terminator in
  //     front of a local node server reports it
  // The host used to participate, which made a PLAIN-HTTP request to a
  // *.ts.net host produce a Secure cookie the browser silently refused — so
  // login looped forever. Host has nothing to do with transport security.
  const forwarded = proto.split(",")[0].trim().toLowerCase();
  const secure = forwarded === "https" || new URL(request.url).protocol === "https:";
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Cookie attributes for the short-lived reveal consent. Same Secure/SameSite
 *  logic as the session cookie, but only valid for five minutes. */
export function revealCookieOptions(request: Request) {
  const base = sessionCookieOptions(request);
  return { ...base, maxAge: REVEAL_CONSENT_MAX_AGE_SECONDS };
}

/** Read one cookie from a raw `Cookie` header (Next.js `Request` has no `.cookies`). */
export function readRequestCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  const pair = cookie.split(";").find((part) => part.trim().startsWith(`${name}=`));
  if (!pair) return undefined;
  return pair.slice(pair.indexOf("=") + 1);
}

// ---------------------------------------------------------------- client IP (trusted)

/**
 * The caller's IP as seen by us — not as claimed by the caller.
 *
 * `x-forwarded-for` is client-writable: whoever sends the request can put
 * anything in it, so keying a rate limiter on the FIRST entry meant rotating
 * the header defeated login throttling entirely. The platform appends the
 * real socket IP to the END of the chain (Vercel does this), and sets
 * `x-real-ip` directly, so those are the two values we trust. A local node
 * server behind TLS has neither — that path yields "local" and is not
 * internet-exposed.
 */
export function trustedClientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const entries = xff.split(",").map((e) => e.trim()).filter(Boolean);
    if (entries.length > 0) return entries[entries.length - 1];
  }
  return "local";
}

/**
 * Constant-time string comparison for secrets. Plain `===` leaks the match
 * position through timing; this is used for the console password check.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a.normalize("NFKC"), "utf8");
  const bufB = Buffer.from(b.normalize("NFKC"), "utf8");
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** The console owner's email, from env. The identity used to be a literal in
 *  the login route — public in source and wrong for any other deployment. */
export function consoleOwnerEmail(): string | null {
  const fromEnv = process.env.CONSOLE_OWNER_EMAIL ?? process.env.STORE_OWNER_EMAIL;
  return fromEnv ? fromEnv.trim().toLowerCase() : null;
}

// --------------------------------------------------------------- rate limiting

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * In-memory, per-process. On Vercel every invocation is a fresh module
 * instance, so this is best-effort there — a durable limiter needs shared
 * state (Turso/Redis). It bounds memory here and self-heals on restart.
 */
export function rateLimited(key: string): boolean {
  const now = Date.now();
  // Drop expired keys at most once a minute instead of only when the same
  // key is read again — otherwise distinct keys accumulate without bound.
  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    lastSweep = now;
    for (const [k, v] of attempts) {
      if (v.resetAt <= now) attempts.delete(k);
    }
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS_PER_WINDOW;
}

export { scryptHash, scryptCompare };

/** Returns the logged-in CONSOLE user's id from the session cookie, or null.
 *  Store-scoped sessions never satisfy this — that is the point. */
export function currentUserId(request: Request): number | undefined {
  const token = readRequestCookie(request, SESSION_COOKIE);
  return verifySessionToken(token, "console") ?? undefined;
}
