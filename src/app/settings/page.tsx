"use client";

import { useEffect, useState } from "react";
import { useFleet } from "@/components/FleetProvider";
import { PageHeading } from "@/components/PageHeading";
import { ThemeGallery } from "@/components/ThemeGallery";
import { Button } from "@/components/ui/Button";
import { LIMITS, formatNumber } from "@/lib/constants";

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
  const [ownerLabel, setOwnerLabel] = useState("checking…");

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
      window.location.assign("/login");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading folio="F-04" title="Settings" meta="limits · backup · appearance" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel rounded-[24px] p-6 sm:p-8">
          <h2 className="panel-title mb-4">Game limits</h2>
          <dl className="flex flex-col">
            <Row label="Cash per account" value={formatNumber(LIMITS.MAX_CASH)} />
            <Row label="Coins per account" value={formatNumber(LIMITS.MAX_COINS)} />
            <Row label="CPM2 base slots" value={`${LIMITS.BASE_CAR_SLOTS} free · editable per account`} />
            <Row label="CPM2 21st slot" value={`${LIMITS.SLOT_COST_COINS} coins (one per account)`} />
            <Row label="CPM2 new garage" value={`${LIMITS.NEW_GARAGE_PRICE} · +${LIMITS.NEW_GARAGE_SLOTS} slots`} />
          </dl>
        </section>

        <section className="panel rounded-[24px] p-6 lg:col-span-2">
          <h2 className="panel-title mb-4">Appearance</h2>
          <ThemeGallery />
        </section>

        <section className="panel rounded-[24px] p-6 sm:p-8">
          <h2 className="panel-title mb-4">Access</h2>
          <dl className="flex flex-col">
            <Row label="Console lock" value="password + owner-bound Telegram" />
            <Row label="Telegram owner" value={ownerLabel} mono={ownerLabel !== "not claimed yet"} />
          </dl>
          <div className="mt-6 border-t border-ink pt-6">
            <p className="text-[12px] leading-relaxed text-ink-soft">
              Only your Telegram account can open the console from the bot — anyone else who finds it sees
              a locked screen. The browser asks for the console password instead.
            </p>
            <Button variant="destructive" size="sm" className="mt-4" onClick={lockConsole}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v4" />
                <polyline points="7 7 12 12 7 17" />
                <line x1="12" x2="17" y1="12" y2="12" />
              </svg>
              Sign out
            </Button>
          </div>
        </section>

        <section className="panel rounded-[24px] p-6 sm:p-8">
          <h2 className="panel-title mb-4">Accounts</h2>
          <dl className="flex flex-col">
            <Row label="Total accounts" value={String(fleet.accounts.length)} />
          </dl>
        </section>

        <section className="panel rounded-[24px] p-6 sm:p-8 hidden sm:block">
          <h2 className="panel-title mb-4">Keyboard</h2>
          <dl className="flex flex-col">
            {SHORTCUTS.map((item) => (
              <div key={item.keys} className="flex items-baseline justify-between gap-4 border-b border-ink py-2 last:border-0">
                <dt className="text-[12px] text-ink-soft">{item.action}</dt>
                <dd className="num rounded-full border border-ink bg-ink px-1.5 py-0.5 text-[11px] text-ink">{item.keys}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink py-2 last:border-0">
      <dt className="text-[12px] text-ink-soft">{label}</dt>
      <dd className={`text-[12px] text-ink ${mono ? "num" : ""}`}>{value}</dd>
    </div>
  );
}
