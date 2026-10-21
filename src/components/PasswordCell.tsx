"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "@/lib/client";
import { useToast } from "@/components/ui/Toaster";

const REMASK_MS = 10_000;

export function PasswordCell({ accountId }: { accountId: number }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const deadline = useRef<number | null>(null);
  const toast = useToast();

  // Auto-remask: the password only stays on screen for 10 seconds.
  useEffect(() => {
    if (revealed === null) return;
    const timer = setInterval(() => {
      const remaining = (deadline.current ?? 0) - Date.now();
      if (remaining <= 0) {
        clearInterval(timer);
        setRevealed(null);
        setSecondsLeft(0);
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [revealed]);

  async function reveal(): Promise<string> {
    const result = await api.reveal(accountId);
    deadline.current = Date.now() + REMASK_MS;
    setRevealed(result.password);
    setSecondsLeft(Math.ceil(REMASK_MS / 1000));
    return result.password;
  }

  async function toggle() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setBusy(true);
    try {
      await reveal();
    } catch (err) {
      toast.error(
        "Password locked",
        err instanceof ApiRequestError ? err.message : "Could not decrypt the stored password.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      const value = revealed ?? (await reveal());
      await navigator.clipboard.writeText(value);
      toast.success("Password copied", "It is on your clipboard — paste it wherever you need it.");
    } catch (err) {
      toast.error(
        "Copy failed",
        err instanceof ApiRequestError ? err.message : "Clipboard access was blocked by the browser.",
      );
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="num max-w-[150px] truncate border-b border-dashed border-ink/25 px-1 pb-0.5 text-[12px] tracking-[0.16em] text-ink">
        {revealed ?? "••••••••"}
      </code>
      {revealed ? (
        <span className="num rounded-full border border-racing/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-racing">
          {secondsLeft}s
        </span>
      ) : null}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={revealed ? "Hide password" : "Reveal password (auto-hides after 10s)"}
        aria-label={revealed ? "Hide password" : "Reveal password"}
        className="square-btn h-7 w-7 disabled:opacity-40"
      >
        {revealed ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 3l18 18" strokeLinecap="round" />
            <path d="M10.6 10.7a2 2 0 002.8 2.8" strokeLinecap="round" />
            <path d="M9.4 5.4A9.6 9.6 0 0112 5c5 0 9 4.5 9 7 0 .9-.5 1.9-1.4 3M6.3 6.4C4.2 7.8 3 9.9 3 12c0 2.5 4 7 9 7 1.2 0 2.3-.2 3.3-.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={copy}
        title="Copy password"
        aria-label="Copy password"
        className="square-btn h-7 w-7"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M15 5.5A2.5 2.5 0 0012.5 3h-7A2.5 2.5 0 005.5 15" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
