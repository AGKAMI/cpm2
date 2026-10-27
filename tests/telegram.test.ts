import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const {
  verifyTelegramInitData,
  assertTelegramAuth,
  TELEGRAM_INIT_DATA_HEADER,
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
} = await import("../src/lib/telegram.ts");
const { ApiError } = await import("../src/lib/api.ts");

const TOKEN = "100200300:TELEGRAM-FAKE-TOKEN";
const OTHER_TOKEN = "100200300:OTHER-TOKEN fake";

/**
 * Signs initData the way TELEGRAM does it, per the spec: data-check-string is
 * every field except `hash` (the Ed25519 `signature` field stays in the
 * string, exactly like the canonical validator), sorted alphabetically, and
 * the secret key is HMAC-SHA256(bot_token, "WebAppData").
 */
function signInitData(fields: Record<string, string>, token: string): string {
  const pairs = Object.entries(fields)
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`);
  const dataCheckString = pairs.sort().join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) params.set(key, value);
  params.set("hash", hash);
  return params.toString();
}

const nowSeconds = Math.floor(Date.now() / 1000);
function baseFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    auth_date: String(nowSeconds),
    query_id: "AAF2R15AAAAnVn1C56789012",
    user: JSON.stringify({ id: 777000, first_name: "KAMI", username: "kami" }),
    ...overrides,
  };
}

describe("telegram mini app · initData verification", () => {
  it("accepts the exact string Telegram signs", async () => {
    const valid = await verifyTelegramInitData(signInitData(baseFields(), TOKEN), TOKEN);
    assert.equal(valid, true);
  });

  it("verifies even when the fields arrive out of order (sorted before hashing)", async () => {
    const fields = baseFields();
    const signed = signInitData(fields, TOKEN);
    // Rebuild the same query string in a scrambled order.
    const reversed = signed
      .split("&")
      .reverse()
      .join("&");
    assert.notEqual(reversed, signed);
    assert.equal(await verifyTelegramInitData(reversed, TOKEN), true);
  });

  it("refuses a tampered field", async () => {
    const forged = new URLSearchParams(signInitData(baseFields(), TOKEN));
    forged.set("user", JSON.stringify({ id: 666, first_name: "who?" }));
    const valid = await verifyTelegramInitData(forged.toString(), TOKEN);
    assert.equal(valid, false);
  });

  it("refuses a signature made with a different bot token", async () => {
    const valid = await verifyTelegramInitData(signInitData(baseFields(), OTHER_TOKEN), TOKEN);
    assert.equal(valid, false);
  });

  it("refuses a missing or malformed hash", async () => {
    const fields = baseFields();
    const hashed = new URLSearchParams(signInitData(fields, TOKEN));
    hashed.delete("hash");
    assert.equal(await verifyTelegramInitData(hashed.toString(), TOKEN), false);
    assert.equal(await verifyTelegramInitData(hashed.toString() + "&hash=zzz", TOKEN), false);
    assert.equal(await verifyTelegramInitData("", TOKEN), false);
  });

  it("refuses stale initData but accepts a fresh one", async () => {
    const stale = await verifyTelegramInitData(
      signInitData(baseFields({ auth_date: String(nowSeconds - TELEGRAM_INIT_DATA_MAX_AGE_SECONDS - 60) }), TOKEN),
      TOKEN,
      { now: nowSeconds },
    );
    assert.equal(stale, false);

    const edge = await verifyTelegramInitData(
      signInitData(baseFields({ auth_date: String(nowSeconds - TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) }), TOKEN),
      TOKEN,
      { now: nowSeconds },
    );
    assert.equal(edge, true, "exactly max-age old is still fresh");
  });

  it("keeps the modern Ed25519 signature field inside the HMAC string (canonical behaviour)", async () => {
    const withSignature = await verifyTelegramInitData(
      signInitData(baseFields({ signature: "c29tZS1iYXNlNjR1cmwtc2ln" }), TOKEN),
      TOKEN,
    );
    assert.equal(withSignature, true, "real initData carries a signature field — it must verify");
  });

  it("refuses garbage timestamps", async () => {
    const valid = await verifyTelegramInitData(
      signInitData(baseFields({ auth_date: "not-a-unix-time" }), TOKEN),
      TOKEN,
    );
    assert.equal(valid, false);
  });
});

describe("telegram mini app · request guard", () => {
  function request(initData: string | undefined) {
    const headers = new Headers();
    if (initData !== undefined) headers.set(TELEGRAM_INIT_DATA_HEADER, initData);
    return new Request("http://localhost/api/accounts", { headers });
  }

  it("lets a request without the header through (desktop / LAN context)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    await assertTelegramAuth(request(undefined)); // resolves silently
  });

  it("skips verification entirely when no bot token is configured", async () => {
    const saved = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    try {
      await assertTelegramAuth(request("garbage")); // even garbage passes
    } finally {
      if (saved) process.env.TELEGRAM_BOT_TOKEN = saved;
    }
  });

  it("accepts a request carrying a real Telegram signature", async () => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    await assertTelegramAuth(request(signInitData(baseFields(), TOKEN)));
  });

  it("401s a forged header before any business logic would run", async () => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    await assert.rejects(
      () => assertTelegramAuth(request(signInitData(baseFields(), OTHER_TOKEN))),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.code, "TELEGRAM_AUTH_INVALID");
        return true;
      },
    );
  });
});
