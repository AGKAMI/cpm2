/** Shared PayFast signature calculation for checkout and ITN verification.
 *  Kept free of app imports so both sides can be unit tested in isolation. */
import { createHash } from "node:crypto";

/**
 * PHP's urlencode(): everything except [A-Za-z0-9-_.] is percent-encoded
 * (uppercase hex) and spaces become '+'. encodeURIComponent leaves
 * ! ~ * ' ( ) alone, which PHP does not — that difference alone changes
 * the MD5, so it is normalised here.
 */
function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/~/g, "%7E");
}

/**
 * PayFast signature, per the official custom-integration docs
 * (developers.payfast.co.za — "Step 2: Create security signature"):
 *
 * 1. Concatenate `key=urlencode(trim(value))` for all NON-BLANK variables,
 *    in the order the fields are given — explicitly NOT alphabetical:
 *    "Do not use the API signature format, which uses alphabetical
 *    ordering!" The previous implementation sorted keys, kept blank
 *    values and appended the bare passphrase, so every signature it
 *    produced mismatched PayFast's.
 * 2. Append `&passphrase=urlencode(trim(passphrase))`.
 * 3. MD5 the result. The `signature` field itself is always excluded.
 *
 * Callers must pass fields in the documented order (checkout builder) or
 * in the order received (ITN verification, which URLSearchParams
 * preserves) — this function deliberately never reorders.
 */
export function payfastSignature(fields: Record<string, string>, passphrase: string): string {
  const dataString = Object.entries(fields)
    .filter(([key, value]) => key !== "signature" && value !== "")
    .map(([key, value]) => `${key}=${phpUrlencode(value.trim())}`)
    .join("&");
  const signed = passphrase
    ? `${dataString}&passphrase=${phpUrlencode(passphrase.trim())}`
    : dataString;
  return createHash("md5").update(signed).digest("hex");
}
