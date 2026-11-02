import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolated key + owner file so the real data/ is never touched.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpm2-auth-"));
process.env.CPM2_KEY_PATH = path.join(tmp, ".secret-key");
process.env.APP_PASSWORD = "test-passphrase-1234";

const {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  rateLimited,
  sessionCookieOptions,
  REVEAL_CONSENT_MAX_AGE_SECONDS,
  createRevealConsentToken,
  verifyRevealConsentToken,
  revealCookieOptions,
  readRequestCookie,
} = await import("../src/lib/auth.ts");
import { scryptHash, scryptCompare } from "../src/lib/auth.ts";
const { resetKeyCache } = await import("../src/lib/crypto.ts");

describe("auth · session tokens", () => {
  it("round-trips a fresh token", () => {
    assert.equal(verifySessionToken(createSessionToken(1)), 1);
  });

  it("refuses an expired token", () => {
    const stale = createSessionToken(1, Date.now() - (SESSION_MAX_AGE_SECONDS + 60) * 1000);
    assert.equal(verifySessionToken(stale), null);
  });

  it("refuses a tampered expiry — the signature no longer matches", () => {
    const token = createSessionToken(1);
    const parts = token.split(".");
    const forged = `${parts[0]}.${Number(parts[1]) + 86_400}.${parts[2]}`;
    assert.equal(verifySessionToken(forged), null);
  });

  it("refuses garbage, empty and missing tokens", () => {
    assert.equal(verifySessionToken(undefined), null);
    assert.equal(verifySessionToken(""), null);
    assert.equal(verifySessionToken("garbage"), null);
    assert.equal(verifySessionToken("123456789.not-a-signature"), null);
  });

  it("is not re-issuable without the key: a token signed by another key fails", () => {
    const real = createSessionToken(1);

    const savedEnv = process.env.CPM2_ENCRYPTION_KEY;
    process.env.CPM2_ENCRYPTION_KEY = Buffer.from(crypto.randomBytes(32)).toString("base64");
    resetKeyCache();
    const forged = createSessionToken(1);
    if (savedEnv) process.env.CPM2_ENCRYPTION_KEY = savedEnv;
    else delete process.env.CPM2_ENCRYPTION_KEY;
    resetKeyCache();

    assert.equal(verifySessionToken(forged), null, "a foreign-key token must not open the console");
    assert.equal(verifySessionToken(real), 1, "the real token still verifies");
  });
});

describe("auth · password hashing", () => {
  it("scryptCompare verifies a hash made by scryptHash", () => {
    const hash = scryptHash("test-passphrase-1234");
    assert.equal(scryptCompare("test-passphrase-1234", hash), true);
  });

  it("scryptCompare refuses wrong password", () => {
    const hash = scryptHash("test-passphrase-1234");
    assert.equal(scryptCompare("wrong", hash), false);
  });

  it("scryptCompare refuses garbage hash", () => {
    assert.equal(scryptCompare("anything", "not-a-hash"), false);
  });

  it("scryptCompare refuses malformed hash", () => {
    assert.equal(scryptCompare("anything", "$scrypt$v1$bad"), false);
  });
});

describe("auth · telegram owner binding", () => {
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

describe("auth · reveal consent", () => {
  it("round-trips a fresh consent token", () => {
    assert.equal(verifyRevealConsentToken(createRevealConsentToken()), true);
  });

  it("refuses an expired consent token", () => {
    const stale = createRevealConsentToken(Date.now() - (REVEAL_CONSENT_MAX_AGE_SECONDS + 60) * 1000);
    assert.equal(verifyRevealConsentToken(stale), false);
  });

  it("refuses a tampered consent token", () => {
    const token = createRevealConsentToken();
    const [expiresAt] = token.split(".");
    const forged = `${Number(expiresAt) + 60}.${token.split(".")[1]}`;
    assert.equal(verifyRevealConsentToken(forged), false);
  });

  it("refuses garbage, empty and missing consent tokens", () => {
    assert.equal(verifyRevealConsentToken(undefined), false);
    assert.equal(verifyRevealConsentToken(""), false);
    assert.equal(verifyRevealConsentToken("garbage"), false);
    assert.equal(verifyRevealConsentToken("123456789.not-a-signature"), false);
  });

  it("readRequestCookie extracts one cookie from a header", () => {
    const req = new Request("http://127.0.0.1:3457/api/auth/reveal-consent", {
      headers: { cookie: "cpm2_session=abc; cpm2_reveal_pw=xyz.def; other=1" },
    });
    assert.equal(readRequestCookie(req, "cpm2_reveal_pw"), "xyz.def");
    assert.equal(readRequestCookie(req, "cpm2_session"), "abc");
    assert.equal(readRequestCookie(req, "missing"), undefined);
  });

  it("revealCookieOptions is short-lived and secure over HTTPS", () => {
    const https = revealCookieOptions(
      new Request("https://kami.tailc10831.ts.net/api/auth/reveal-consent", {
        headers: { host: "kami.tailc10831.ts.net" },
      }),
    );
    assert.equal(https.secure, true);
    assert.equal(https.sameSite, "none");
    assert.equal(https.maxAge, REVEAL_CONSENT_MAX_AGE_SECONDS);
  });
});

// The cookie name is part of the contract with src/proxy.ts.
assert.equal(typeof SESSION_COOKIE, "string");
