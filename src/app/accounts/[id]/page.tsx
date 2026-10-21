"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useFleet } from "@/components/FleetProvider";
import { useShell } from "@/components/AppShell";
import { CapacityGauge } from "@/components/CapacityGauge";
import { PasswordCell } from "@/components/PasswordCell";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Button } from "@/components/ui/Button";
import { LIMITS, formatNumber } from "@/lib/constants";

const STEPS = { cash: 1_000_000, coins: 1_000, cars: 1 } as const;

export default function AccountPage() {
  const params = useParams<{ id: string }>();
  const fleet = useFleet();
  const shell = useShell();

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
    return (
      <div className="panel rounded-[4px] px-6 py-16 text-center">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/fleet" className="num text-[10px] text-ink-faint hover:text-racing">
            ← fleet
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className="plate">
              <span className="plate-text num text-[13px]">{account.email}</span>
            </span>
            {archived ? (
              <span className="rounded-[2px] border border-oxblood/40 px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-oxblood">
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
              <Button variant="outline" size="sm" onClick={() => shell.openSlotPurchase(account)}>
                + Buy slot · 100c
              </Button>
              <Button
                variant="danger"
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
        <section className="panel rounded-[4px] p-5 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="label-caps">Balances</h2>
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

          <div className="mt-6 border-t border-ink/10 pt-4">
            <h3 className="label-caps">Garage</h3>
            <div className="mt-3">
              <CapacityGauge cars={account.cars} capacity={account.capacity} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <Fact label="Base slots" value={String(LIMITS.BASE_CAR_SLOTS)} />
              <Fact label="Purchased" value={String(account.slots)} tone="text-brass" />
              <Fact label="Capacity" value={String(account.capacity)} tone="text-racing" />
              <Fact label="Slot value" value={`${formatNumber(slotValue)} coins`} tone="text-brass" />
            </dl>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="panel rounded-[4px] p-5">
            <h2 className="label-caps mb-4">Credentials</h2>
            <PasswordCell accountId={account.id} />
            <p className="mt-3 text-[11px] leading-snug text-ink-faint">
              Reveals are written to the activity log and the password re-masks itself after 10 seconds.
            </p>
          </section>

          <section className="panel rounded-[4px] p-5">
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
                <dd className="num text-[12px] text-blueprint">{formatNumber(account.coinsSpentOnCars)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-t border-ink/10 pt-2">
                <dt className="text-[12px] font-semibold text-ink">Spendable</dt>
                <dd className="num text-[12px] font-semibold text-racing">{formatNumber(spendable)}</dd>
              </div>
            </dl>
            {!archived ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full justify-center"
                onClick={() => shell.openSlotPurchase(account)}
                disabled={spendable < LIMITS.SLOT_COST_COINS}
              >
                {spendable < LIMITS.SLOT_COST_COINS
                  ? `Need ${LIMITS.SLOT_COST_COINS} coins to buy a slot`
                  : `+ Buy slot · ${LIMITS.SLOT_COST_COINS} coins`}
              </Button>
            ) : null}
          </section>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="label-caps">History</h2>
          <span className="num text-[10px] text-ink-faint">
            {history.length} {history.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        {history.length === 0 ? (
          <div className="panel rounded-[4px] px-6 py-10 text-center text-sm text-ink-faint">
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
        <span className={`num min-w-[92px] text-right text-[15px] font-semibold ${tone}`}>
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
