"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";

/**
 * The lock screen. Full-screen overlay (the app shell sits underneath but is
 * unreachable â€” every page and API call is gated by src/proxy.ts).
 *
 * Inside Telegram this page drives itself: it sends the signed initData
 * immediately; the first ever login asks for the console password once to
 * CLAIM the console for that Telegram account, after which Telegram opens
 * straight in. A different Telegram account sees the locked plate.
 * In a normal browser it is a plain password form.
 */

type Phase = "checking" | "password" | "locked" | "error";

export default function LoginPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      // Yield one tick first so the checking plate paints before any state flip.
      await Promise.resolve();

      // Inside a Telegram webview the SDK can land a beat after hydration â€”
      // wait for it briefly rather than mis-detecting as a plain browser.
      // A real browser never grows a window.Telegram, so it falls through
      // instantly to the password form.
      let initData = window.Telegram?.WebApp?.initData;
      if (!initData && /telegram/i.test(navigator.userAgent)) {
        for (let waited = 0; waited < 25 && !initData; waited += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 100));
          initData = window.Telegram?.WebApp?.initData;
        }
      }
      if (!initData) {
        // Plain browser â€” straight to the password form.
        setPhase("password");
        return;
      }

      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (response.ok) {
          enter();
          return;
        }
        const body = (await response.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        if (body?.error?.code === "TELEGRAM_NOT_OWNER") {
          setPhase("locked");
          setMessage(body.error.message ?? "This console belongs to another Telegram account.");
          return;
        }
        // AUTH_CLAIM_REQUIRED (or anything else) â†’ the one-time claim form.
        setPhase("password");
        setMessage(body?.error?.code === "AUTH_CLAIM_REQUIRED" ? "" : (body?.error?.message ?? ""));
      } catch {
        setPhase("password");
      }
    })();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const initData = window.Telegram?.WebApp?.initData;
      const response = await fetch(
        initData ? "/api/auth/telegram" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initData ? { initData, password } : { password }),
        },
      );
      if (response.ok) {
        enter();
        return;
      }
      const body = (await response.json().catch(() => null)) as
        | { error?: { code?: string; message?: string } }
        | null;
      if (body?.error?.code === "TELEGRAM_NOT_OWNER") {
        setPhase("locked");
        setMessage(body.error.message ?? "This console belongs to another Telegram account.");
      } else {
        setMessage(body?.error?.message ?? "That did not work â€” try again.");
      }
    } catch {
      setMessage("Cannot reach the console server. Is it still running?");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "checking") {
    return (
      <Overlay>
        <p className="num text-[11px] uppercase tracking-[0.2em] text-ink-faint">checking the key…</p>
      </Overlay>
    );
  }

  if (phase === "locked") {
    return (
      <Overlay>
        <div className="panel w-full max-w-[380px] rounded-[28px] p-8 sm:p-10 text-center">
          <ShieldIcon />
          <h1 className="mt-4 font-display text-[22px] text-ink">Locked</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{message}</p>
          <p className="num mt-4 text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            cpm fleet · single-owner console
          </p>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <form onSubmit={submit} className="panel w-full max-w-[380px] rounded-[28px] p-8 sm:p-10">
        <ShieldIcon />
        <h1 className="mt-4 font-display text-[22px] text-ink">CPM Fleet</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          Enter the console password to claim this console for your Telegram account.
        </p>

        <div className="mt-5">
          <Field label="Console password" error={message || undefined} htmlFor="login-password">
            <div className="relative">
              <TextInput
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                autoFocus
                className="pr-4"
                invalid={Boolean(message)}
              />
            </div>
          </Field>
        </div>

        <Button type="submit" variant="primary"  className="mt-6 w-full justify-center" disabled={busy || !password}>
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
        <p className="mt-4 text-[11px] text-center text-ink-soft">
          Not KAMI? <a href="/auth" className="underline underline-offset-4 hover:text-racing transition-colors">Player sign in →</a>
        </p>
      </form>
    </Overlay>
  );
}

function enter() {
  window.location.replace("/");
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}

function ShieldIcon() {
  return (
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-racing bg-racing text-racing">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
        <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" strokeLinecap="round" />
        <path d="M12 14.5v2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
