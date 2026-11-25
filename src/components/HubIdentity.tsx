/**
 * HubIdentity — the hub's identity row: greeting + REAL profile (name, avatar).
 *
 * The profile comes from the API, not a hardcode — every customer sees their
 * own name, never a fixed "AG KAMI". No @handle under the name (that was the
 * redundancy KAMI flagged), and no balance card: the app stores no wallet.
 */


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { vantaApi } from "@/lib/store/client";

export function HubIdentity() {
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
        /* non-fatal — renders anonymous */
      });
    return () => {
      live = false;
    };
  }, []);

  const name = profile?.displayName || "customer";

  return (
    <Link href="/store/profile" className="flex min-w-0 flex-1 items-center gap-3">
      {profile?.photoUrl ? (
        <img
          src={profile.photoUrl}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-secondary text-sm font-bold text-foreground">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{name}</p>
      </div>
    </Link>
  );
}
