"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useFleet } from "@/components/FleetProvider";
import { useShell } from "@/components/AppShell";
import { CapacityGauge } from "@/components/CapacityGauge";
import { PasswordCell } from "@/components/PasswordCell";
import { ActivityFeed } from "@/components/ActivityFeed";
import { GaragePanel } from "@/components/GaragePanel";
import { TrophyCabinet } from "@/components/TrophyCabinet";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import { LIMITS, GARAGE_RULES, formatNumber } from "@/lib/constants";

const STEPS = { cash: 1_000_000, coins: 1_000, cars: 1 } as const;

export default function AccountPage() {
  const params = useParams<{ id: string }>();
  const fleet = useFleet();
  const shell = useShell();
  const toast = useToast();

  const id = Number(params.id);
  const account = useMemo(
    () => fleet.accounts.find((item) => item.id === id) ?? fleet.archived.find((item) => item.id === id),
    [fleet.accounts, fleet.archived, id],
  );

  const history = useMemo(
    () => fleet.events.filter((event) => event.accountId === id),
    [fleet.events, id],
  );

  if (!account) {
    // FleetProvider loads accounts asynchronously — while it's still
    // fetching, show a loading plate instead of "Account not found".
    if (fleet.loading) {
      return (
        <div className="panel rounded-[20px] px-6 py-16 text-center">
          <p className="num text-[11px] uppercase tracking-[0.2em] text-ink-faint">loading accountâ€¦</p>
        </div>
      );
    }
    return (
      <div className="panel rounded-[20px] px-6 py-16 text-center">
        <p className="font-sans text-[13px] font-semibold tracking-[-0.01em] text-ink">
          Account not found
        </p>
        <p className="mt-2 text-sm text-ink-faint">
          It may have been archived away, or the link is stale.
        </p>
        <Link href="/fleet" className="num mt-5 inline-block text-[11px] text-racing hover:underline">
          ← back to the fleet
        </Link>
      </div>
    );
  }

  const archived = account.archived;
  const freeCoins = Math.max(0, account.coins);
  const slotValue = account.slotsValue;
  const spendable = Math.max(0, freeCoins - slotValue);

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        folio="F-05"
        title={account.email.split("@")[0] || "Account"}
        meta={
          archived
            ? "archived · balances intact"
            : `capacity ${account.cars}/${account.capacity} · ${formatNumber(account.coins)} coins`
        }
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/fleet" className="num text-[10px] text-ink-faint hover:text-racing">
            ← fleet
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <span className="plate">
              <span className="plate-text num text-[13px]">{account.email}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(account.email);
                toast.success("Email copied", "It is on your clipboard — paste it wherever you need it.");
              }}
              title="Copy email"
              aria-label="Copy email"
              className="square-btn h-7 w-7"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2.5" />
                <path d="M15 5.5A2.5 2.5 0 0012.5 3h-7A2.5 2.5 0 005.5 15" strokeLinecap="round" />
              </svg>
            </button>
            {archived ? (
              <span className="rounded-full border border-oxblood px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-oxblood">
                Archived
              </span>
            ) : null}
          </div>
          <p className="num mt-2 text-[10px] text-ink-faint">
            on the books since {new Date(account.createdAt).toLocaleDateString()} · last touched{" "}
            {new Date(account.updatedAt).toLocaleString()}
          </p>
          {account.notes ? (
            <p className="mt-2 max-w-[520px] text-[13px] text-ink-soft">{account.notes}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shell.openEditAccount(account)}>
            Edit
          </Button>
          {archived ? (
            <Button variant="primary" size="sm" onClick={() => void fleet.restoreAccount(account)}>
              Restore
            </Button>
          ) : (
            <>
              {GARAGE_RULES[account.game].hasSlots ? (
                <Button variant="outline" size="sm" onClick={() => shell.openSlotPurchase(account)}>
                  + Unlock 21st slot · 100c
                </Button>
              ) : null}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  void shell
                    .confirm({
                      title: "Archive this account?",
                      message: `${account.email} is filed away with every balance intact. You can restore it from the archived view at any time.`,
                      confirmLabel: "Archive",
                    })
                    .then((ok) => {
                      if (ok) void fleet.archiveAccount(account);
                    });
                }}
              >
                Archive
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel rounded-[20px] p-5 lg:col-span-2 min-w-0">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="panel-title">Balances</h2>
            <span className="num text-[10px] text-ink-faint">steppers write straight to the ledger</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Balance
              label="Cash"
              value={account.cash}
              tone="text-ink"
              max={LIMITS.MAX_CASH}
              disabled={archived}
              onMinus={() => void fleet.adjust(account, "cash", -STEPS.cash)}
              onPlus={() => void fleet.adjust(account, "cash", STEPS.cash)}
            />
            <Balance
              label="Coins"
              value={account.coins}
              tone="text-racing"
              max={LIMITS.MAX_COINS}
              disabled={archived}
              onMinus={() => void fleet.adjust(account, "coins", -STEPS.coins)}
              onPlus={() => void fleet.adjust(account, "coins", STEPS.coins)}
            />
            <Balance
              label="Cars"
              value={account.cars}
              tone="text-ink"
              max={account.capacity}
              disabled={archived}
              onMinus={() => void fleet.adjust(account, "cars", -STEPS.cars)}
              onPlus={() => void fleet.adjust(account, "cars", STEPS.cars)}
            />
          </div>

          <div className="mt-6 border-t border-ink pt-6">
            <h3 className="panel-title">Garage capacity</h3>
            <div className="mt-3">
              <CapacityGauge
                cars={account.cars}
                capacity={account.capacity}
                baseSlots={account.baseSlots}
                game={account.game}
              />
            </div>
            {GARAGE_RULES[account.game].hasSlots ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <Fact label="Base slots" value={String(account.baseSlots)} />
                <Fact label="Coin slot" value={String(account.slots)} tone="text-brass" />
                <Fact
                  label="New garage"
                  value={account.newGarage ? `+${LIMITS.NEW_GARAGE_SLOTS}` : "—"}
                  tone="text-brass"
                />
                <Fact label="Capacity" value={String(account.capacity)} tone="text-racing" />
              </dl>
            ) : (
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                <Fact label="Car slots" value="none" />
                <Fact label="Models in game" value={String(account.capacity)} tone="text-racing" />
                <Fact label="Per model" value="one only" tone="text-brass" />
              </dl>
            )}
            <p className="mt-3 text-[11px] leading-snug text-ink-faint">
              {GARAGE_RULES[account.game].hasSlots
                ? `CPM2 garage: ${LIMITS.BASE_CAR_SLOTS} free slots, the 21st for ${LIMITS.SLOT_COST_COINS} coins, plus ${LIMITS.NEW_GARAGE_SLOTS} more with the ${LIMITS.NEW_GARAGE_PRICE} garage.`
                : "CPM1 has no car slots — every model in the game can be owned, but only one of each."}
            </p>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="panel rounded-[20px] p-5">
            <h2 className="label-caps mb-4">Credentials</h2>
            <PasswordCell accountId={account.id} />
            <p className="mt-3 text-[11px] leading-snug text-ink-faint">
              Reveals are written to the activity log and the password re-masks itself after 10 seconds.
            </p>
          </section>

          <section className="panel rounded-[20px] p-5">
            <h2 className="label-caps mb-4">Coin ledger</h2>
            <dl className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[12px] text-ink-soft">Balance</dt>
                <dd className="num text-[12px] text-ink">{formatNumber(freeCoins)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[12px] text-ink-soft">Locked in slots</dt>
                <dd className="num text-[12px] text-brass">{formatNumber(slotValue)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[12px] text-ink-soft">Spent on cars</dt>
                <dd className="num text-[12px] text-brass">{formatNumber(account.coinsSpentOnCars)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-t border-ink pt-2">
                <dt className="text-[12px] font-semibold text-ink">Spendable</dt>
                <dd className="num text-[12px] font-semibold text-racing">{formatNumber(spendable)}</dd>
              </div>
            </dl>
            {!archived ? (
              <p className="mt-4 border-t border-ink pt-3 text-[11px] leading-snug text-ink-faint">
                {!GARAGE_RULES[account.game].hasSlots
                  ? "CPM1 has no car slots — there is nothing to buy, every model in the game fits once."
                  : spendable >= LIMITS.SLOT_COST_COINS
                    ? `${formatNumber(spendable)} coins are spendable — “+ Unlock 21st slot” above turns them into garage space.`
                    : `You need ${LIMITS.SLOT_COST_COINS} coins to unlock the 21st slot for this account.`}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <GaragePanel
        key={account.id}
        account={account}
        readOnly={archived}
        onChanged={() => void fleet.refresh(true)}
      />

      <section className="panel rounded-[20px] p-5">
        <TrophyCabinet accountId={account.id} readOnly={archived} onChanged={() => void fleet.refresh(true)} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="panel-title">History</h2>
          <span className="num text-[10px] text-ink-faint">
            {history.length} {history.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        {history.length === 0 ? (
          <div className="panel rounded-[20px] px-6 py-10 text-center text-sm text-ink-faint">
            No entries for this account yet.
          </div>
        ) : (
          <ActivityFeed events={history} />
        )}
      </section>
    </div>
  );
}

function Balance({
  label,
  value,
  tone,
  max,
  disabled,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  tone: string;
  max: number;
  disabled: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div>
      <span className="label-caps">{label}</span>
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onMinus}
          disabled={disabled || value <= 0}
          aria-label={`Reduce ${label.toLowerCase()}`}
          className="square-btn h-6 w-6"
        >
          −
        </button>
        <span className={`num min-w-[92px] text-right text-[19px] font-semibold tracking-[-0.03em] ${tone}`}>
          {formatNumber(value)}
        </span>
        <button
          type="button"
          onClick={onPlus}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="square-btn h-6 w-6"
        >
          +
        </button>
      </div>
      <p className="num mt-1 text-right text-[10px] text-ink-faint">max {formatNumber(max)}</p>
    </div>
  );
}

function Fact({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className={`num mt-1 text-[13px] ${tone}`}>{value}</dd>
    </div>
  );
}
