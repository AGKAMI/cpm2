"use client";

import { useEffect, useState } from "react";
import { useFleet } from "@/components/FleetProvider";
import { GuestGate } from "@/components/GuestGate";
import { useShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { ThemeGallery } from "@/components/ThemeGallery";
import { Button } from "@/components/ui/Button";
import { LIMITS, formatNumber } from "@/lib/constants";
import { carsForGame } from "@/lib/car-catalog";

const SHORTCUTS = [
  { keys: "N", action: "New account" },
  { keys: "/", action: "Search the fleet" },
  { keys: "G then 1", action: "Go to the CPM1 register" },
  { keys: "G then 2", action: "Go to the CPM2 register" },
  { keys: "G then T", action: "Go to the trade desk" },
  { keys: "G then S", action: "Go to settings" },
  { keys: "?", action: "Show the shortcut list" },
  { keys: "Esc", action: "Close a dialog" },
];

export default function SettingsPage() {
  const fleet = useFleet();
  const shell = useShell();
  const [ownerLabel, setOwnerLabel] = useState("checking…");

  // Whose Telegram account owns this console (read-only display; the binding
  // itself only ever happens through the login screen's claim flow).
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/owner");
        const body = (await response.json().catch(() => null)) as
          | { owner?: { userId: number | null } }
          | null;
        const id = body?.owner?.userId;
        setOwnerLabel(id === null || id === undefined ? "not claimed yet" : `telegram id ${id}`);
      } catch {
        setOwnerLabel("unknown");
      }
    })();
  }, []);

  async function lockConsole() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Full reload on purpose: the whole app must re-render unauthenticated.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  return (
    <GuestGate>
      <div className="flex flex-col gap-4">
      <PageHeading folio="F-04" title="Settings" meta="limits · backup · appearance" />
      <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel rounded-[20px] p-5">
        <h2 className="panel-title mb-4">Game limits</h2>
        <dl className="flex flex-col">
          <Row label="Cash per account" value={formatNumber(LIMITS.MAX_CASH)} />
          <Row label="Coins per account" value={formatNumber(LIMITS.MAX_COINS)} />
          <Row label="CPM1 car slots" value="none · one of each model" />
          <Row label="CPM1 garage size" value={`every model in the game (${carsForGame("cpm1").length})`} />
          <Row label="CPM2 base slots" value={`${LIMITS.BASE_CAR_SLOTS} free · editable per account`} />
          <Row label="CPM2 21st slot" value={`${LIMITS.SLOT_COST_COINS} coins (one per account)`} />
          <Row label="CPM2 new garage" value={`${LIMITS.NEW_GARAGE_PRICE} · +${LIMITS.NEW_GARAGE_SLOTS} slots`} />
        </dl>
        <p className="mt-4 text-[11px] leading-snug text-aether-text-faint">
          CPM1 has no slots at all: every model in the game can be owned, but only one of each. CPM2 is
          slot-based — {LIMITS.BASE_CAR_SLOTS} free slots, the 21st bought for {LIMITS.SLOT_COST_COINS}{" "}
          coins, and {LIMITS.NEW_GARAGE_SLOTS} more slots with the {LIMITS.NEW_GARAGE_PRICE} garage.
        </p>
      </section>

      <section className="panel rounded-[20px] p-5">
        <h2 className="panel-title mb-4">Where the data lives</h2>
        <dl className="flex flex-col">
          <Row label="Database" value="data/cpm2.db" mono />
          <Row label="Encryption key" value="data/.secret-key" mono />
          <Row label="Accounts" value={String(fleet.accounts.length)} />
          <Row label="Archived" value={String(fleet.archived.length)} />
          <Row label="Log entries" value={String(fleet.events.length)} />
        </dl>
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="text-[12px] leading-relaxed text-ink-soft">
            The <span className="num">data/</span> folder is the whole ledger — the database and the key that
            decrypts the passwords. Copy the folder to back it up. Losing the key means losing every stored
            password.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={shell.openExport}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 4v10M12 4l-3.5 3.5M12 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 19h14" strokeLinecap="round" />
              </svg>
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={shell.openImport}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 14V4M12 14l-3.5-3.5M12 14l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 19h14" strokeLinecap="round" />
              </svg>
              Import
            </Button>
          </div>
        </div>
      </section>

      <section className="panel rounded-[20px] p-5 lg:col-span-2">
        <h2 className="panel-title mb-4">Appearance</h2>
        <ThemeGallery />
      </section>

      <section className="panel rounded-[20px] p-5">
        <h2 className="panel-title mb-4">Access</h2>
        <dl className="flex flex-col">
          <Row label="Console lock" value="password + owner-bound Telegram" />
          <Row label="Telegram owner" value={ownerLabel} mono={ownerLabel !== "not claimed yet"} />
        </dl>
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="text-[12px] leading-relaxed text-ink-soft">
            Only your Telegram account can open the console from the bot — anyone else who finds it sees
            a locked screen. The browser asks for the console password instead.
          </p>
          <Button
            variant="danger"
            size="sm"
            className="mt-3"
            onClick={lockConsole}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" />
              <path d="M12 3v12" strokeLinecap="round" />
            </svg>
            Sign out
          </Button>
        </div>
      </section>

      <section className="panel rounded-[20px] p-5">
        <h2 className="panel-title mb-4">Keyboard</h2>
        <dl className="flex flex-col">
          {SHORTCUTS.map((item) => (
            <div
              key={item.keys}
              className="flex items-baseline justify-between gap-4 border-b border-mix(in srgb, var(--aether-text) 8%, transparent) py-2 last:border-0"
            >
              <dt className="text-[12px] text-aether-text-soft">{item.action}</dt>
              <dd className="num rounded-full border border-mix(in srgb, var(--aether-text) 15%, transparent) bg-mix(in srgb, var(--aether-text) 5%, transparent) px-1.5 py-0.5 text-[11px] text-aether-text backdrop-blur-md">
                {item.keys}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      </div>
    </div>
    </GuestGate>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink/8 py-2 last:border-0">
      <dt className="text-[12px] text-ink-soft">{label}</dt>
      <dd className={`text-[12px] text-ink ${mono ? "num" : ""}`}>{value}</dd>
    </div>
  );
}
