"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Guest gate: wraps pages that require a signed-in account.
 *
 * When no session exists, the page's own content is blurred and inert, with a
 * sign-in panel floating over it. Critically this stays *inside* the page
 * content area — the header nav, the mobile dock and the trade desk remain
 * fully usable, because guests are still allowed to browse the trade desk and
 * theme settings without an account.
 *
 * This is client-side only; the proxy handles the API-level 401s. We keep
 * guests on the page so they can see what they're missing and tap straight
 * into sign in.
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
      <div className="relative min-h-[320px]">
        {/* The register content stays mounted but blurred, inert and
            unclickable — the nav above it is untouched, so the guest can
            still switch to the trade desk or another page. */}
        <div inert={true} aria-hidden="true" className="pointer-events-none select-none blur-[7px]">
          {children}
        </div>
        <div className="absolute inset-x-0 top-0 flex items-start justify-center px-4 pt-8">
          <div className="panel w-full max-w-[380px] rounded-[24px] p-7 text-center">
            <span className="racing text-[11px] uppercase tracking-[0.25em] font-semibold block mb-3">
              accounts only
            </span>
            <h1 className="font-display text-[24px] leading-none text-ink mb-2">
              Sign in to manage your fleet
            </h1>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft mb-6">
              The trade calculator is open to anyone, but the account register,
              garages, trophies and export stay behind a sign in.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center"
                onClick={() => router.push(`/auth?from=${encodeURIComponent(path())}`)}
              >
                Sign in or create account
              </Button>
              <Button
                variant="ghost"
                size="md"
                className="w-full justify-center"
                onClick={() => router.push("/trade")}
              >
                Browse the trade desk instead
              </Button>
            </div>
            <p className="mt-5 text-[11px] text-ink-faint">
              Already signed in? Refresh the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** The current path, readable only in the browser (client component). */
function path() {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}
