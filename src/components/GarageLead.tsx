/**
 * GarageLead — the home lead: greeting + quick access + your OWNED games.
 *
 * "Your games" lists games the customer has actually bought in (from their
 * order history), NOT a second copy of the catalogue links — quick access is
 * the browsing shorthand, Your games is ownership. A visitor with no orders
 * (or no session) sees no Your games section at all rather than a fake one.
 *
 * The balance/wallet card is intentionally absent: this app stores no USDT or
 * Stars balance, so none is rendered until a wallet feature exists.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { vantaApi } from "@/lib/store/client";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type OwnedGame = { game: "cpm1" | "cpm2"; title: string; sub: string; href: string; glyph: string };

const GAME_META: Record<string, { title: string; sub: string; glyph: string }> = {
  cpm2: {
    title: "Car Parking Multiplayer 2",
    sub: "Ready-to-drive builds, limited editions, One of One",
    glyph: "\u{1F3CE}",
  },
  cpm1: {
    title: "Car Parking Multiplayer",
    sub: "Accounts, flags, security, police, premium cars, mods",
    glyph: "\u{1F6A5}",
  },
};

export function GarageLead() {
  const [profile, setProfile] = useState<{
    displayName?: string;
    username?: string;
    photoUrl?: string;
  } | null>(null);
  const [owned, setOwned] = useState<OwnedGame[] | null>(null);

  useEffect(() => {
    let live = true;
    vantaApi
      .profile()
      .then((data) => {
        if (live && data.telegramUser) {
          setProfile({
            displayName: data.telegramUser.displayName,
            username: data.telegramUser.username,
            photoUrl: data.telegramUser.photoUrl,
          });
        }
      })
      .catch(() => {
        /* profile is non-fatal — the row still renders anonymous */
      });
    return () => {
      live = false;
    };
  }, []);

  // Owned games — derived from the customer's real order history.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [orders, products] = await Promise.all([
          fetch("/api/store/orders").then((r) => (r.ok ? r.json() : null)),
          vantaApi.products({}),
        ]);
        if (!live) return;
        const list = orders?.orders ?? [];
        if (!Array.isArray(list) || list.length === 0) {
          setOwned([]); // no purchases — no owned games
          return;
        }
        const gameOf = new Map<number, string>();
        for (const p of products.products ?? []) {
          if (p.game === "cpm1" || p.game === "cpm2") gameOf.set(p.id, p.game);
        }
        const games = new Set<string>();
        for (const o of list) {
          const g = gameOf.get(Number(o.productId));
          if (g === "cpm1" || g === "cpm2") games.add(g);
        }
        setOwned(
          [...games].map((g) => ({
            game: g as "cpm1" | "cpm2",
            title: GAME_META[g].title,
            sub: GAME_META[g].sub,
            href: `/store/categories?game=${g}`,
            glyph: GAME_META[g].glyph,
          })),
        );
      } catch {
        if (live) setOwned([]);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const name = profile?.displayName || "there";
  // Quick access = distinct browsing destinations only. No "Cars" tile — it
  // pointed at the same CPM2 catalogue, which is exactly the redundancy this
  // replaces.
  const quick = [
    { label: "CPM 2", href: "/store/categories?game=cpm2", glyph: "\u{1F3CE}" },
    { label: "CPM 1", href: "/store/categories?game=cpm1", glyph: "\u{1F6A5}" },
    { label: "Support", href: "/store/support", glyph: "\u{1F3E7}" },
  ];

  return (
    <section className="px-4 pt-4 pb-2 space-y-4">
      {/* Greeting + identity */}
      <div className="flex items-center gap-3">
        <Link href="/store/profile" className="shrink-0">
          {profile?.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-sm font-bold text-foreground">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-soft">{greeting()},</p>
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        </div>
      </div>

      {/* Quick access — browsing shorthand */}
      <div className="grid grid-cols-3 gap-2">
        {quick.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background py-3 transition-colors hover:border-accent"
          >
            <span className="text-xl">{q.glyph}</span>
            <span className="text-[11px] font-medium text-foreground">{q.label}</span>
          </Link>
        ))}
      </div>

      {/* Your games — OWNERSHIP only; hidden without purchases (no fake list) */}
      {owned && owned.length > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Your games</h2>
          <div className="grid gap-2">
            {owned.map((g) => (
              <Link
                key={g.game}
                href={g.href}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xl">
                  {g.glyph}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{g.title}</p>
                  <p className="truncate text-xs text-ink-soft">{g.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
