"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Guest gate: wraps pages that require a signed-in account.
 *
 * When no session exists, the page is blurred behind a panel that tells the
 * guest they can only use the trade calculator until they sign in. When signed
 * in, children render normally.
 *
 * This is client-side only — the proxy already redirects unauthenticated
 * requests to /login, but we keep guests on the page and blur it instead so
 * they can see what they're missing and tap straight into sign in.
 */
export function GuestGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/owner");
        if (!cancelled) setAuthed(response.ok);
      } catch {
        if (!cancelled) setAuthed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-mix(in srgb, var(--aether-glass) 85%, transparent) px-4 backdrop-blur-xl">
        <div className="w-full max-w-[380px] rounded-[24px] p-7 text-center">
          <span className="aether-accent text-[11px] uppercase tracking-[0.25em] font-semibold block mb-3">
            accounts only
          </span>
          <h1 className="font-display text-[24px] leading-none text-aether-text mb-2">
            Sign in to manage your fleet
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-aether-text-soft mb-6">
            The trade calculator is open to anyone, but the account register,
            garages, trophies and export stay behind a sign in.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              onClick={() => router.push(`/auth?from=${encodeURIComponent(window.location.pathname)}`)}
            >
              Sign in or create account →
            </Button>
          </div>
          <p className="mt-5 text-[11px] text-aether-text-faint">
            Already signed in? Refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
