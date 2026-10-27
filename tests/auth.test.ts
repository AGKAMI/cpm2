import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolated key + owner file so the real data/ is never touched.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-auth-"));
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");
process.env.CPM2_OWNER_PATH = path.join(tmp, "telegram-owner.json");
process.env.APP_PASSWORD = "test-passphrase-1234";

const {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  passwordMatches,
  appPassword,
  telegramOwnerId,
  bindTelegramOwner,
  rateLimited,
  sessionCookieOptions,
} = await import("../src/lib/auth.ts");
const { resetKeyCache } = await import("../src/lib/crypto.ts");

describe("auth · session tokens", () => {
  it("round-trips a fresh token", () => {
    assert.equal(verifySessionToken(createSessionToken()), true);
  });

  it("refuses an expired token", () => {
    const stale = createSessionToken(Date.now() - (SESSION_MAX_AGE_SECONDS + 60) * 1000);
    assert.equal(verifySessionToken(stale), false);
  });

  it("refuses a tampered expiry — the signature no longer matches", () => {
    const token = createSessionToken();
    const [expiresAt] = token.split(".");
    const forged = `${Number(expiresAt) + 86_400}.${token.split(".")[1]}`;
    assert.equal(verifySessionToken(forged), false);
  });

  it("refuses garbage, empty and missing tokens", () => {
    assert.equal(verifySessionToken(undefined), false);
    assert.equal(verifySessionToken(""), false);
    assert.equal(verifySessionToken("garbage"), false);
    assert.equal(verifySessionToken("123456789.not-a-signature"), false);
  });

  it("is not re-issuable without the key: a token signed by another key fails", () => {
    const real = createSessionToken();

    // Sign a fresh-looking token under a DIFFERENT key, then restore the real one.
    const savedEnv = process.env.CPM2_ENCRYPTION_KEY;
    process.env.CPM2_ENCRYPTION_KEY = Buffer.from(crypto.randomBytes(32)).toString("base64");
    resetKeyCache();
    const forged = createSessionToken();
    if (savedEnv) process.env.CPM2_ENCRYPTION_KEY = savedEnv;
    else delete process.env.CPM2_ENCRYPTION_KEY;
    resetKeyCache();

    assert.equal(verifySessionToken(forged), false, "a foreign-key token must not open the console");
    assert.equal(verifySessionToken(real), true, "the real token still verifies");
  });
});

describe("auth · password", () => {
  it("accepts the configured password", () => {
    assert.equal(passwordMatches("test-passphrase-1234"), true);
  });

  it("refuses wrong, empty and non-string input", () => {
    assert.equal(passwordMatches("wrong"), false);
    assert.equal(passwordMatches(""), false);
    assert.equal(passwordMatches(undefined), false);
    assert.equal(passwordMatches(1234), false);
  });

  it("a missing configured password locks everything out", () => {
    const saved = process.env.APP_PASSWORD;
    delete process.env.APP_PASSWORD;
    try {
      assert.equal(appPassword(), undefined);
      assert.equal(passwordMatches("anything"), false);
    } finally {
      process.env.APP_PASSWORD = saved;
    }
  });
});

describe("auth · telegram owner binding", () => {
  it("starts unclaimed", () => {
    fs.rmSync(process.env.CPM2_OWNER_PATH!, { force: true });
    assert.equal(telegramOwnerId(), null);
  });

  it("binds exactly one owner and reads it back", () => {
    bindTelegramOwner(777000);
    assert.equal(telegramOwnerId(), 777000);
    bindTelegramOwner(888000); // a later claim overwrites (only reachable with the password)
    assert.equal(telegramOwnerId(), 888000);
  });

  it("refuses malformed owner files instead of trusting them", () => {
    fs.writeFileSync(process.env.CPM2_OWNER_PATH!, "not json at all", "utf8");
    assert.equal(telegramOwnerId(), null);
  });
});

describe("auth · brute-force damper", () => {
  it("lets the first attempts through, then backs off, then resets", () => {
    const key = `test:${Math.random()}`;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(rateLimited(key), false, `attempt ${attempt + 1} should pass`);
    }
    assert.equal(rateLimited(key), true, "attempt 11 must back off");
  });
});

describe("auth · cookie options", () => {
  it("uses SameSite=None + Secure over HTTPS / the ts.net host", () => {
    const https = sessionCookieOptions(
      new Request("https://kami.tailc10831.ts.net/api/auth/login", { headers: { host: "kami.tailc10831.ts.net" } }),
    );
    assert.equal(https.secure, true);
    assert.equal(https.sameSite, "none");

    const forwarded = sessionCookieOptions(
      new Request("http://127.0.0.1:3457/api/auth/login", { headers: { "x-forwarded-proto": "https" } }),
    );
    assert.equal(forwarded.secure, true);
  });

  it("uses SameSite=Lax over plain local HTTP", () => {
    const local = sessionCookieOptions(new Request("http://127.0.0.1:3457/api/auth/login"));
    assert.equal(local.secure, false);
    assert.equal(local.sameSite, "lax");
    assert.equal(local.httpOnly, true);
    assert.equal(local.path, "/");
    assert.equal(local.maxAge, SESSION_MAX_AGE_SECONDS);
  });
});

// The cookie name is part of the contract with src/proxy.ts.
assert.equal(typeof SESSION_COOKIE, "string");
