"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";

/**
 * The lock screen. Full-screen overlay (the app shell sits underneath but is
 * unreachable — every page and API call is gated by src/proxy.ts).
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
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      // Yield one tick first so the checking plate paints before any state flip.
      await Promise.resolve();

      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) {
        // Plain browser — straight to the password form.
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
        // AUTH_CLAIM_REQUIRED (or anything else) → the one-time claim form.
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
        setMessage(body?.error?.message ?? "That did not work — try again.");
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
        <div className="panel w-full max-w-[380px] rounded-[24px] p-7 text-center">
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
      <form onSubmit={submit} className="panel w-full max-w-[380px] rounded-[24px] p-7">
        <ShieldIcon />
        <h1 className="mt-4 font-display text-[22px] text-ink">CPM Fleet</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          {window.Telegram?.WebApp?.initData
            ? "Enter the console password once to claim this console for your Telegram account."
            : "Enter the console password to open the ledger."}
        </p>

        <div className="mt-5">
          <Field label="Console password" error={message || undefined} htmlFor="login-password">
            <div className="relative">
              <TextInput
                id="login-password"
                type={reveal ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={window.Telegram?.WebApp?.initData ? "off" : "current-password"}
                autoFocus
                className="pr-12"
                invalid={Boolean(message)}
              />
              <button
                type="button"
                onClick={() => setReveal((value) => !value)}
                aria-label={reveal ? "Hide the password" : "Show the password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1.5 text-ink-faint transition-colors hover:text-ink"
              >
                {reveal ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </Field>
        </div>

        <Button type="submit" variant="primary" size="md" className="mt-5 w-full justify-center" disabled={busy || !password}>
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
      </form>
    </Overlay>
  );
}

function enter() {
  window.location.replace("/");
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 px-4 backdrop-blur-xl">
      {children}
    </div>
  );
}

function ShieldIcon() {
  return (
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-racing/30 bg-racing/10 text-racing">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
        <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" strokeLinecap="round" />
        <path d="M12 14.5v2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5c1.7 0 3.2.5 4.5 1.2M21.5 12S18 18.5 12 18.5c-1.7 0-3.2-.5-4.5-1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20 20 4" strokeLinecap="round" />
    </svg>
  );
}
