/** Shared PayFast signature calculation for checkout and ITN verification.
 *  Kept free of app imports so both sides can be unit tested in isolation. */
import { createHash } from "node:crypto";

/**
 * PayFast signature: MD5 over `key=value` pairs sorted by key, joined with `&`,
 * with the passphrase appended. Empty values remain in the string because
 * PayFast signs them too. The incoming `signature` field is always excluded.
 */
export function payfastSignature(fields: Record<string, string>, passphrase: string): string {
  const dataString = Object.keys(fields)
    .filter((key) => key !== "signature")
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("&");
  return createHash("md5").update(`${dataString}${passphrase}`).digest("hex");
}
