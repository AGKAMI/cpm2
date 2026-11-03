"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AetherInput } from "@/components/ui/AetherInput";

type Mode = "signin" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { code?: string; message?: string } }
            | null;
          setError(body?.error?.message ?? "Sign in failed — try again.");
          return;
        }
      } else {
        if (password !== confirmPassword) {
          setError("Passwords don't match — try again.");
          return;
        }
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            confirmPassword,
          }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { code?: string; message?: string; fields?: Record<string, string> } }
            | null;
          setError(
            body?.error?.message ??
              (body?.error?.fields ? Object.values(body.error.fields).join(" ") : ""),
          );
          return;
        }
      }
      // Session cookie is set by the server — reload so the shell picks it up.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch {
      setError("Cannot reach the server. Is it still running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-env(safe-area-inset-bottom))] items-center justify-center bg-aether-paper px-4 pb-6">
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center gap-3 mb-6">
          <span className="aether-accent text-[10px] uppercase tracking-[0.25em] font-semibold">
            cpm fleet
          </span>
          <h1 className="font-display text-[26px] leading-none text-aether-text">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-[12px] leading-relaxed text-aether-text-soft text-center">
            {mode === "signin"
              ? "Enter your email and password to open your ledger."
              : "New to the fleet? Register your email and set a password."}
          </p>
        </div>

        <div className="panel rounded-[24px] p-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="auth-email" error={error && mode === "signin" ? undefined : undefined}>
              <AetherInput
                id="auth-email"
                type="email"
                autoComplete={mode === "signin" ? "email" : "new-email"}
                placeholder="driver@cpm2.gg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className={Boolean(error) ? "border-aether-accent/50 focus:border-aether-accent" : ""}
              />
            </Field>

            <Field label="Password" htmlFor="auth-password">
              <AetherInput
                id="auth-password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={Boolean(error) ? "border-aether-accent/50 focus:border-aether-accent" : ""}
              />
            </Field>

            {mode === "register" && (
              <Field label="Confirm password" htmlFor="auth-confirm">
                <AetherInput
                  id="auth-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={Boolean(error) ? "border-aether-accent/50 focus:border-aether-accent" : ""}
                />
              </Field>
            )}

            {error && (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-aether-accent">
                <svg
                  viewBox="0 0 24 24"
                  className="mt-px h-3.5 w-3.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5v5.5M12 16.2v.1" strokeLinecap="round" />
                </svg>
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="mt-2 w-full justify-center"
              disabled={busy || !email || !password || (mode === "register" && !confirmPassword)}
            >
              {busy ? (mode === "signin" ? "Signing in…" : "Creating…") : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "register" : "signin")}
            className="num text-[12px] underline underline-offset-4 hover:text-aether-accent transition-colors"
          >
            {mode === "signin" ? "Don't have an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <a
            href="/login"
            className="num text-[11px] text-aether-text-faint hover:text-aether-text transition-colors underline underline-offset-4"
          >
            Console lock screen
          </a>
        </div>
      </div>
    </div>
  );
}
