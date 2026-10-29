"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "@/lib/client";
import { useToast } from "@/components/ui/Toaster";

const REMASK_MS = 10_000;

/** True on devices with a real hover capability (desktop), not touch screens. */
let supportsHover: boolean | null = null;
function hoverCapable(): boolean {
  if (supportsHover === null) {
    supportsHover =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }
  return supportsHover;
}

export function PasswordCell({ accountId }: { accountId: number }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [consentPassword, setConsentPassword] = useState("");
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentEarned, setConsentEarned] = useState(false);
  const deadline = useRef<number | null>(null);
  // Set when the current reveal came from a hover (so leaving the button hides it).
  const revealedViaHover = useRef(false);
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
        deadline.current = null;
        revealedViaHover.current = false;
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [revealed]);

  /** Re-enter the console password to earn a 5-minute reveal consent cookie. */
  async function earnConsent(): Promise<void> {
    setConsentBusy(true);
    try {
      const response = await fetch("/api/auth/reveal-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: consentPassword }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        throw new ApiRequestError(
          body?.error?.message ?? "Wrong console password.",
          response.status,
          body?.error?.code ?? "AUTH_INVALID",
        );
      }
      setConsentEarned(true);
    } finally {
      setConsentBusy(false);
    }
  }

  async function reveal(): Promise<string> {
    const result = await api.reveal(accountId);
    deadline.current = Date.now() + REMASK_MS;
    setRevealed(result.password);
    setSecondsLeft(Math.ceil(REMASK_MS / 1000));
    revealedViaHover.current = false; // explicit reveal is persistent, not hover-driven
    setConsentEarned(true);
    return result.password;
  }

  /** Prompted path: earn consent with the console password, then reveal. */
  async function revealWithConsent(): Promise<void> {
    if (!consentPassword.trim()) {
      toast.error("Console password needed", "Enter the console password to unlock stored passwords.");
      return;
    }
    setBusy(true);
    try {
      await earnConsent();
      await reveal();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "AUTH_INVALID") {
        toast.error("Wrong console password", "Try again.");
        return;
      }
      toast.error(
        "Password locked",
        err instanceof ApiRequestError ? err.message : "Could not unlock stored passwords.",
      );
    } finally {
      setBusy(false);
    }
  }

  /** Hover reveal (desktop only): reveal on enter, hide on leave. */
  function onRevealMouseEnter() {
    if (!hoverCapable() || revealed || !consentEarned) return;
    revealedViaHover.current = true;
    void reveal();
  }

  function onRevealMouseLeave() {
    if (!hoverCapable() || !revealedViaHover.current) return;
    revealedViaHover.current = false;
    if (revealed) {
      setRevealed(null);
      setSecondsLeft(0);
      deadline.current = null;
    }
  }

  /** Click the eye: toggle reveal (persistent, 10s auto-remask) or hide. */
  async function onRevealClick(): Promise<void> {
    if (revealed) {
      setRevealed(null);
      setSecondsLeft(0);
      deadline.current = null;
      revealedViaHover.current = false;
      return;
    }
    if (consentEarned) {
      await reveal();
      return;
    }
    await revealWithConsent();
  }

  async function onCopy(): Promise<void> {
    if (!revealed) {
      if (consentEarned) {
        await reveal();
      } else {
        await revealWithConsent();
      }
      if (!revealed) return;
    }
    try {
      await navigator.clipboard.writeText(revealed!);
      toast.success("Password copied", "It is on your clipboard — paste it wherever you need it.");
    } catch (err) {
      toast.error(
        "Copy failed",
        err instanceof Error ? err.message : "Clipboard access was blocked by the browser.",
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
        onMouseEnter={onRevealMouseEnter}
        onMouseLeave={onRevealMouseLeave}
        onClick={onRevealClick}
        disabled={busy || consentBusy}
        title={revealed ? "Hide password" : "Reveal password (auto-hides after 10s)"}
        aria-label={revealed ? "Hide password" : "Reveal password"}
        className="square-btn h-7 w-7 disabled:opacity-40"
      >
        {revealed ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M3 3l18 18" strokeLinecap="round" />
            <path d="M10.6 10.7a2 2 0 002.8 2.8" strokeLinecap="round" />
            <path d="M9.4 5.4A9.6 9.6 0 0112 5c5 0 9 4.5 9 7 0 .9-.5 1.9-1.4 3M6.3 6.4C4.2 7.8 3 9.9 3 12c0 2.5 4 7 9 7 1.2 0 2.3-.2 3.3-.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        )}
      </button>
      {!revealed ? (
        <div className="flex items-center gap-1">
          <input
            type="password"
            placeholder="console password"
            value={consentPassword}
            onChange={(event) => setConsentPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void revealWithConsent();
            }}
            autoComplete="current-password"
            className="field-rule num w-32 px-2 py-1 text-[11px]"
          />
          <button
            type="button"
            onClick={revealWithConsent}
            disabled={consentBusy}
            className="square-btn h-7 w-7 disabled:opacity-40"
            aria-label="Unlock stored passwords"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M3 3l18 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onCopy}
        disabled={busy || consentBusy}
        title="Copy password"
        aria-label="Copy password"
        className="square-btn h-7 w-7"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M15 5.5A2.5 2.5 0 0012.5 3h-7A2.5 2.5 0 005.5 15" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
