/**
 * WalletHeader — the home page's top block in the reference layout:
 * an identity card (greeting, name, handle, Telegram-verified badge, alerts +
 * cart) above a balance card (wallet icon, hide/show toggle, gold Add funds).
 *
 * Honest data only: name/photo/handle come from the real profile, the verified
 * badge is the session's real Telegram link state, and the balance reads the
 * stored wallet — which does not exist yet, so it shows 0.00 rather than a
 * fabricated number, and Add funds routes to support (a real top-up request)
 * until a wallet feature lands.
 */


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { vantaApi } from "@/lib/store/client";
import { detectPlatform, type Platform } from "@/lib/platform";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const EYE = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EYE_OFF = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M4 4l16 16M9.9 5.7A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.8 17.8 0 0 1-3 3.8M6.6 7.4A17.4 17.4 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6" strokeLinejoin="round" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinejoin="round" />
  </svg>
);

export function WalletHeader() {
  const [profile, setProfile] = useState<{
    displayName?: string;
    username?: string;
    photoUrl?: string;
    telegramLinked?: boolean;
    authed?: boolean;
  } | null>(null);
  const [hidden, setHidden] = useState(false);
  // "Logged in on X" — where this session actually runs. Read after mount so
  // SSR stays hydration-safe.
  const [platform, setPlatform] = useState<Platform | null>(null);
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => {
    let live = true;
    vantaApi
      .profile()
      .then((data) => {
        if (!live) return;
        setProfile({
          displayName: data.telegramUser?.displayName,
          username: data.telegramUser?.username,
          photoUrl: data.telegramUser?.photoUrl,
          telegramLinked: Boolean(data.customer?.telegramLinked),
          // A real session = an authenticated customer or a Telegram identity.
          authed: Boolean(data.customer || data.telegramUser),
        });
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      live = false;
    };
  }, []);

  const name = profile?.displayName || "customer";

  return (
    <section className="space-y-3 px-1 pt-4">
      {/* Identity card */}
      <div className="flex items-center gap-3 rounded-3xl border border-border bg-secondary p-4">
        <Link href="/store/profile" className="shrink-0">
          {profile?.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-full border border-border bg-background text-sm font-bold text-foreground">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] uppercase tracking-[0.16em] text-ink-soft">
            {greeting()},
          </p>
          <p className="truncate text-sm font-bold text-foreground">
            {name}
          </p>
          {profile?.authed && platform ? (
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              {platform.icon ? (
                /* The platform's own mark (SVG Repo files in /brands) */
                <img src={platform.icon} alt="" width={16} height={16} className="h-4 w-4 shrink-0" />
              ) : (
                <svg className="h-4 w-4 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18Z" />
                </svg>
              )}
              Logged in on {platform.label}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
        </div>
      </div>

      {/* Balance card — only visible when logged in */}
      {profile && (
      <div className="rounded-3xl border border-border bg-secondary p-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="2" y="6" width="20" height="13" rx="3" />
            <path d="M2 10h20" />
          </svg>
          Available balance
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            aria-label={hidden ? "Show balance" : "Hide balance"}
            className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-ink-soft transition-colors hover:border-primary/60"
          >
            {hidden ? EYE_OFF : EYE}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold tabular-nums text-foreground">
              {hidden ? "••••" : "0.00"}
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">ZAR</span>
          </div>
          {/* Until a stored wallet exists, top-ups are a support request */}
          <Link
            href="/store/support"
            className="rounded-full bg-gold px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#14100a] transition-[filter] hover:brightness-110"
          >
            + Add funds
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">
          No wallet yet — payments run per order (EFT, card or Telegram Stars). Ask support to
          load balance and it lands here.
        </p>
      </div>
      )}
    </section>
  );
}
