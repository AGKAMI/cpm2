// Greeting + quick access + Your games — mirrors the reference store's home.
// The balance/wallet card is intentionally NOT faked: this app stores no USDT or
// Stars balance, so it ships without one until a wallet feature exists.
import { useEffect, useState } from "react";
import Link from "next/link";
import { vantaApi } from "@/lib/store/client";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function GarageLead() {
  const [profile, setProfile] = useState<{
    displayName?: string;
    username?: string;
    photoUrl?: string;
  } | null>(null);

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

  const name = profile?.displayName || "there";
  const quick = [
    { label: "CPM 2", href: "/store/categories?game=cpm2", glyph: "\u{1F3CE}" },
    { label: "CPM 1", href: "/store/categories?game=cpm1", glyph: "\u{1F6A5}" },
    { label: "Cars", href: "/store/categories?game=cpm2", glyph: "\u{1F697}" },
    { label: "Support", href: "/store/support", glyph: "\u{1F3E7}" },
  ];
  const games = [
    {
      title: "Car Parking Multiplayer 2",
      sub: "Ready-to-drive builds, limited editions, One of One",
      href: "/store/categories?game=cpm2",
      glyph: "\u{1F3CE}",
    },
    {
      title: "Car Parking Multiplayer",
      sub: "Accounts, flags, security, police, premium cars, mods",
      href: "/store/categories?game=cpm1",
      glyph: "\u{1F6A5}",
    },
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
          <p className="truncate text-sm font-semibold text-foreground">
            {name}
            {profile?.username ? (
              <span className="ml-2 text-xs font-normal text-ink-faint">@{profile.username}</span>
            ) : null}
          </p>
        </div>
      </div>

      {/* Quick access */}
      <div className="grid grid-cols-4 gap-2">
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

      {/* Your games */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Your games</h2>
        <div className="grid gap-2">
          {games.map((g) => (
            <Link
              key={g.title}
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
    </section>
  );
}
