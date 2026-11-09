/**
 * Telegram Mini App authentication.
 *
 * When the console runs inside Telegram (its own bot), every request the
 * browser makes carries the raw `Telegram.WebApp.initData` string, which
 * Telegram signed with the bot's token. The proxy (src/proxy.ts) verifies that
 * signature so requests claiming to come from the mini app cannot be forged;
 * a request without the header is left alone, so the desktop window, the
 * Edge app-window and the LAN keep working exactly as before.
 *
 * The recipe is the official one from core.telegram.org/bots/webapps
 * ("Validating data received via the Mini App"):
 *
 *   secret_key = HMAC_SHA256(bot_token, "WebAppData")
 *   hash       = hex(HMAC_SHA256(data_check_string, secret_key))
 *
 * where data_check_string is every initData field except `hash`, sorted
 * alphabetically as `key=value` lines joined with \n. The Ed25519 `signature`
 * field modern clients add STAYS in the string (only the third-party Ed25519
 * flow excludes it) — this matches the canonical validator exactly; dropping
 * it would flag every real request as forged.
 *
 * Only WebCrypto is used (no node-only imports), so the proxy can load this
 * file regardless of runtime.
 */

import { ApiError } from "./api.ts";

/** The request header that carries the raw initData to the server. */
export const TELEGRAM_INIT_DATA_HEADER = "X-Telegram-Init-Data";

/** initData generated more than this many seconds ago is refused. */
export const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 86_400; // 24h
/** The bot token, without printing it. Reads the standard Next.js env source. */
export function telegramBotToken(): string | undefined {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token ? token : undefined;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/** Hex compare that does not short-circuit on the first differing byte. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/**
 * Verifies one raw initData string against one bot token.
 * False for a tampered field, a foreign token, a stale timestamp or garbage.
 */
export async function verifyTelegramInitData(
  raw: string,
  token: string,
  options: { now?: number; maxAgeSeconds?: number } = {},
): Promise<boolean> {
  const initData = raw.trim();
  if (!initData || !token) return false;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return false;
  }

  const receivedHash = params.get("hash");
  if (!receivedHash || !/^[0-9a-f]{64}$/i.test(receivedHash)) return false;

  // data-check-string: every field except `hash`, as `key=value` pairs sorted
  // alphabetically — the rendered pairs, matching the canonical validator.
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;
  const encoder = new TextEncoder();

  // secret_key = HMAC_SHA256(bot_token, "WebAppData")
  const secretKey = await subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await subtle.sign("HMAC", secretKey, encoder.encode(token));

  const signatureKey = await subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await subtle.sign("HMAC", signatureKey, encoder.encode(dataCheckString));
  const calculated = bytesToHex(new Uint8Array(signature));

  if (!timingSafeEqualHex(calculated, receivedHash.toLowerCase())) return false;

  // Freshness: auth_date is a Unix timestamp in seconds.
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0) return false;
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? TELEGRAM_INIT_DATA_MAX_AGE_SECONDS;
  if (nowSeconds - authDate > maxAge) return false;

  return true;
}

/**
 * The Telegram user id inside one raw initData string, or null when the
 * `user` field is missing, malformed, or has no numeric id.
 */
export function initDataUserId(raw: string): number | null {
  try {
    const user = JSON.parse(new URLSearchParams(raw.trim()).get("user") ?? "null") as {
      id?: unknown;
    } | null;
    return typeof user?.id === "number" && Number.isInteger(user.id) ? user.id : null;
  } catch {
    return null;
  }
}

/**
 * Verifies one Telegram initData signature and returns the Telegram user id
 * inside it. The caller is responsible for binding that Telegram id to a local
 * user account (see /api/auth/telegram).
 *
 * Throws on forged, stale, or invalid signatures. Returns null when no
 * initData header is present (caller falls back to session cookie).
 */
export async function assertTelegramAuth(request: Request): Promise<number | null> {
  const initData = request.headers.get(TELEGRAM_INIT_DATA_HEADER);
  if (!initData) return null;

  const token = telegramBotToken();
  if (!token) throw new ApiError(401, "TELEGRAM_AUTH_INVALID", "Telegram auth is not configured.");

  if (!(await verifyTelegramInitData(initData, token))) {
    throw new ApiError(
      401,
      "TELEGRAM_AUTH_INVALID",
      "The Telegram signature did not verify - reopen the console from Telegram and try again.",
    );
  }

  const userId = initDataUserId(initData);
  if (userId === null) {
    throw new ApiError(401, "TELEGRAM_AUTH_INVALID", "The initData carries no usable user id.");
  }
  return userId;
}

/**
 * Fetches Telegram user info by user ID using the Bot API's getChat method.
 * Returns { username, first_name, last_name } or null if user not found/bot can't access.
 * Requires TELEGRAM_BOT_TOKEN env var.
 */
export async function fetchTelegramUser(userId: number): Promise<{
  username: string | null;
  first_name: string | null;
  last_name: string | null;
} | null> {
  const token = telegramBotToken();
  if (!token) return null;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: userId }),
    });
    const data = await resp.json();
    if (!data.ok) return null;
    return {
      username: data.result.username ?? null,
      first_name: data.result.first_name ?? null,
      last_name: data.result.last_name ?? null,
    };
  } catch {
    return null;
  }
}
