import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALGO = "aes-256-gcm";
const VERSION = "v1";

export class SecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretError";
  }
}

function keyFilePath(): string {
  const override = process.env.CPM2_KEY_PATH;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.join(process.cwd(), "data", ".secret-key");
}

let cachedKey: Buffer | null = null;

/**
 * Loads (or creates on first run) the 32 byte AES key used to encrypt account
 * passwords. The key never leaves the machine unless the user points
 * CPM2_ENCRYPTION_KEY at their own base64 key.
 */
export function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.CPM2_ENCRYPTION_KEY;
  if (fromEnv && fromEnv.trim()) {
    const key = Buffer.from(fromEnv.trim(), "base64");
    if (key.length !== 32) {
      throw new SecretError("CPM2_ENCRYPTION_KEY must be 32 raw bytes encoded as base64.");
    }
    cachedKey = key;
    return key;
  }

  const file = keyFilePath();
  try {
    if (fs.existsSync(/* turbopackIgnore: true */ file)) {
      const key = Buffer.from(
        fs.readFileSync(/* turbopackIgnore: true */ file, "utf8").trim(),
        "base64",
      );
      if (key.length !== 32) {
        throw new SecretError(`Encryption key file is corrupted: ${file}`);
      }
      cachedKey = key;
      return key;
    }
  } catch {
    // Read-only filesystem (Vercel serverless) or other IO error —
    // fall through to an in-memory key. Sessions won't persist across
    // cold starts but this avoids a 500 error.
  }

  const key = crypto.randomBytes(32);
  cachedKey = key;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(/* turbopackIgnore: true */ file, key.toString("base64"), {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // Read-only filesystem — key stays in memory only; sessions won't
    // persist across cold starts but this avoids a 500 error.
  }
  return key;
}

/** Encrypts a secret into `v1.iv.tag.ciphertext` (all base64). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

/** Decrypts a payload produced by {@link encryptSecret}. */
export function decryptSecret(payload: string): string {
  const parts = String(payload || "").split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretError("Stored password payload is not readable.");
  }

  try {
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(parts[1], "base64"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new SecretError("Password could not be decrypted - the encryption key has changed.");
  }
}

/** Test helper: forces the next call to re-read the key from disk / env. */
export function resetKeyCache(): void {
  cachedKey = null;
}
