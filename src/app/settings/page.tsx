"use client";

import { useFleet } from "@/components/FleetProvider";
import { useTheme } from "@/hooks/useTheme";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { LIMITS, formatNumber } from "@/lib/constants";

const SHORTCUTS = [
  { keys: "N", action: "New account" },
  { keys: "/", action: "Search the fleet" },
  { keys: "E", action: "Export the fleet" },
  { keys: "G then F", action: "Go to fleet" },
  { keys: "G then A", action: "Go to activity" },
  { keys: "G then S", action: "Go to settings" },
  { keys: "?", action: "Show the shortcut list" },
  { keys: "Esc", action: "Close a dialog" },
];

export default function SettingsPage() {
  const fleet = useFleet();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading folio="F-04" title="Settings" meta="limits · backup · appearance" />
      <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel rounded-[14px] p-5">
        <h2 className="label-caps mb-4">Game limits</h2>
        <dl className="flex flex-col">
          <Row label="Cash per account" value={formatNumber(LIMITS.MAX_CASH)} />
          <Row label="Coins per account" value={formatNumber(LIMITS.MAX_COINS)} />
          <Row label="Base car slots" value={String(LIMITS.BASE_CAR_SLOTS)} />
          <Row label="Extra slots per account" value={`${LIMITS.MAX_PURCHASED_SLOTS} (max ${LIMITS.BASE_CAR_SLOTS + LIMITS.MAX_PURCHASED_SLOTS} cars)`} />
          <Row label="Price of an extra slot" value={`${LIMITS.SLOT_COST_COINS} coins`} />
        </dl>
        <p className="mt-4 text-[11px] leading-snug text-ink-faint">
          Slots can only be bought — the tracker charges the coins for you. A PATCH that tries to raise the slot
          count is rejected with <span className="num">SLOTS_PURCHASE_ONLY</span>.
        </p>
      </section>

      <section className="panel rounded-[14px] p-5">
        <h2 className="label-caps mb-4">Where the data lives</h2>
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
          <p className="num mt-3 text-[10px] text-ink-faint">
            Use the Export and Import buttons in the header to move a fleet in or out.
          </p>
        </div>
      </section>

      <section className="panel rounded-[14px] p-5">
        <h2 className="label-caps mb-4">Appearance</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={theme === "paper" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTheme("paper")}
          >
            Paper
          </Button>
          <Button
            variant={theme === "night" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTheme("night")}
          >
            Night
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-ink-faint">
          Paper is for daylight; night is the same ledger lit from the dash. The choice is remembered on this
          machine.
        </p>
      </section>

      <section className="panel rounded-[14px] p-5">
        <h2 className="label-caps mb-4">Keyboard</h2>
        <dl className="flex flex-col">
          {SHORTCUTS.map((item) => (
            <div
              key={item.keys}
              className="flex items-baseline justify-between gap-4 border-b border-ink/8 py-2 last:border-0"
            >
              <dt className="text-[12px] text-ink-soft">{item.action}</dt>
              <dd className="num rounded-full border border-ink/15 bg-paper-sunken px-1.5 py-0.5 text-[11px] text-ink">
                {item.keys}
              </dd>
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
    <div className="flex items-baseline justify-between gap-4 border-b border-ink/8 py-2 last:border-0">
      <dt className="text-[12px] text-ink-soft">{label}</dt>
      <dd className={`text-[12px] text-ink ${mono ? "num" : ""}`}>{value}</dd>
    </div>
  );
}
