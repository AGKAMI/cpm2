"use client";

import Link from "next/link";
import type { AccountSummary, TrophySummary } from "@/lib/types";
import { formatNumber } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { CapacityGauge } from "@/components/CapacityGauge";
import { PasswordCell } from "@/components/PasswordCell";

export type SortKey = "email" | "cash" | "coins" | "cars" | "updated";

type AccountTableProps = {
  accounts: AccountSummary[];
  busyId: number | null;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onEdit: (account: AccountSummary) => void;
  onBuySlot: (account: AccountSummary) => void;
  onDelete: (account: AccountSummary) => void;
  onRestore?: (account: AccountSummary) => void;
  onAdjust: (account: AccountSummary, field: "cash" | "coins" | "cars", delta: number) => void;
  mode?: "active" | "archived";
  selectable?: boolean;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  onToggleAll?: () => void;
  trophies?: Record<number, TrophySummary>;
};

const STEPS = { cash: 1_000_000, coins: 1_000, cars: 1 } as const;

export function AccountTable({
  accounts,
  busyId,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onBuySlot,
  onDelete,
  onRestore,
  onAdjust,
  mode = "active",
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
  trophies = {},
}: AccountTableProps) {
  const archived = mode === "archived";
  const allSelected = selectable && accounts.length > 0 && accounts.every((a) => selectedIds.includes(a.id));

  return (
    <>
      {/* Desktop: dense fleet table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="rule-double">
              {selectable ? (
                <th className="w-9 px-2.5 py-3 text-left">
                  <label className="inline-flex h-6 w-6 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => onToggleAll?.()}
                      aria-label="Select every account"
                        className="h-3.5 w-3.5 accent-racing"
                    />
                  </label>
                </th>
              ) : null}
              <th className="label-caps w-12 px-2.5 py-3 text-left">#</th>
              <th className="label-caps px-2.5 py-3 text-left">
                <SortButton label="Account" active={sortKey === "email"} dir={sortDir} onClick={() => onSort("email")} />
              </th>
              <th className="label-caps px-2.5 py-3 text-left">Password</th>
              <th className="label-caps px-2.5 py-3 text-right">
                <SortButton label="Cash" active={sortKey === "cash"} dir={sortDir} onClick={() => onSort("cash")} align="right" />
              </th>
              <th className="label-caps px-2.5 py-3 text-right">
                <SortButton label="Coins" active={sortKey === "coins"} dir={sortDir} onClick={() => onSort("coins")} align="right" />
              </th>
              <th className="label-caps w-[190px] px-2.5 py-3 text-left">
                <SortButton label="Cars / Capacity" active={sortKey === "cars"} dir={sortDir} onClick={() => onSort("cars")} />
              </th>
              <th className="label-caps w-[96px] px-2.5 py-3 text-left">Trophies</th>
              <th className="label-caps px-2.5 py-3 text-left">Updated</th>
              <th className="label-caps px-2.5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account, index) => (
              <tr
                key={account.id}
                className={`group border-b border-ink/10 transition-colors hover:bg-ink/[0.025] ${
                  busyId === account.id ? "opacity-60" : ""
                }`}
              >
                {selectable ? (
                  <td className="px-2.5 py-3">
                    <label className="inline-flex h-6 w-6 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(account.id)}
                        onChange={() => onToggleSelect?.(account.id)}
                        aria-label={`Select ${account.email}`}
                      className="h-3.5 w-3.5 accent-racing"
                      />
                    </label>
                  </td>
                ) : null}
                <td className="num px-2.5 py-3 text-[11px] text-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td className="px-2.5 py-3">
                  <Link href={`/accounts/${account.id}`} className="inline-block max-w-[210px] hover:opacity-80">
                    <span className="plate max-w-[210px]">
                      <span className="plate-text num text-[12px]">{account.email}</span>
                    </span>
                  </Link>
                  {account.notes ? (
                    <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-ink-faint">{account.notes}</p>
                  ) : null}
                </td>
                <td className="px-2.5 py-3">
                  <PasswordCell accountId={account.id} />
                </td>
                <td className="px-2.5 py-3">
                  <Stepper
                    value={account.cash}
                    tone="text-ink"
                    step={STEPS.cash}
                    disabled={busyId === account.id || archived}
                    onMinus={() => onAdjust(account, "cash", -STEPS.cash)}
                    onPlus={() => onAdjust(account, "cash", STEPS.cash)}
                  />
                </td>
                <td className="px-2.5 py-3">
                  <Stepper
                    value={account.coins}
                    tone="text-racing"
                    step={STEPS.coins}
                    disabled={busyId === account.id || archived}
                    onMinus={() => onAdjust(account, "coins", -STEPS.coins)}
                    onPlus={() => onAdjust(account, "coins", STEPS.coins)}
                  />
                </td>
                <td className="px-2.5 py-3">
                  <CapacityGauge cars={account.cars} capacity={account.capacity} baseSlots={account.baseSlots} />
                  {archived ? null : (
                    <button
                      type="button"
                      onClick={() => onBuySlot(account)}
                      className="mt-1.5 inline-flex min-h-[24px] cursor-pointer items-center font-sans text-[11px] font-medium text-ink-faint transition hover:text-racing"
                    >
                      + buy slot (100c)
                    </button>
                  )}
                </td>
                <td className="px-2.5 py-3">
                  <TrophyTally summary={trophies[account.id]} />
                </td>
                <td className="px-2.5 py-3 text-[11px] text-ink-faint">{relativeTime(account.updatedAt)}</td>
                <td className="px-2.5 py-3">
                  <div className="flex items-center justify-end gap-2.5">
                    {archived ? (
                      <IconAction
                        label="Restore account"
                        onClick={() => onRestore?.(account)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                            <path d="M4 12a8 8 0 101.6-5.6" strokeLinecap="round" />
                            <path d="M4 4.5V11h6.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        }
                      />
                    ) : (
                      <>
                        <IconAction
                          label="Edit account"
                          onClick={() => onEdit(account)}
                          icon={
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                              <path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          }
                        />
                        <IconAction
                          label="Archive account"
                          danger
                          onClick={() => onDelete(account)}
                          icon={
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                              <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          }
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet: stacked cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {accounts.map((account) => (
          <article
            key={account.id}
            className={`panel-tight rounded-[18px] p-4 ${busyId === account.id ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/accounts/${account.id}`} className="inline-block hover:opacity-80">
                  <span className="plate">
                    <span className="plate-text num text-[12px]">{account.email}</span>
                  </span>
                </Link>
                {account.notes ? (
                  <p className="mt-0.5 truncate text-[12px] text-ink-faint">{account.notes}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2.5">
                {archived ? (
                  <IconAction
                    label="Restore account"
                    onClick={() => onRestore?.(account)}
                    icon={
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                        <path d="M4 12a8 8 0 101.6-5.6" strokeLinecap="round" />
                        <path d="M4 4.5V11h6.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  />
                ) : (
                  <>
                    <IconAction
                      label="Edit account"
                      onClick={() => onEdit(account)}
                      icon={
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                          <path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                    <IconAction
                      label="Archive account"
                      danger
                      onClick={() => onDelete(account)}
                      icon={
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                          <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                  </>
                )}
              </div>
            </div>

            <div className="mt-3">
              <PasswordCell accountId={account.id} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
              <div>
                <dt className="label-caps">Cash</dt>
                <dd className="num mt-1 text-[13px] text-ink">{formatNumber(account.cash)}</dd>
              </div>
              <div>
                <dt className="label-caps">Coins</dt>
                <dd className="num mt-1 text-[13px] text-ink">{formatNumber(account.coins)}</dd>
              </div>
              <div>
                <dt className="label-caps">Trophies</dt>
                <dd className="mt-1 text-[12px]">
                  <TrophyTally summary={trophies[account.id]} />
                </dd>
              </div>
              <div>
                <dt className="label-caps">Updated</dt>
                <dd className="mt-1 text-[12px] text-ink-faint">{relativeTime(account.updatedAt)}</dd>
              </div>
            </dl>

            <div className="mt-3">
              <CapacityGauge cars={account.cars} capacity={account.capacity} baseSlots={account.baseSlots} />
            </div>

            {archived ? null : (
              <button
                type="button"
                onClick={() => onBuySlot(account)}
                className="mt-3 w-full cursor-pointer rounded-full border border-racing/35 py-2 font-sans text-[11px] font-semibold text-racing transition-colors hover:bg-racing hover:text-paper"
              >
                + Buy car slot · 100 coins
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[24px] cursor-pointer items-center gap-1 transition hover:text-racing ${
        align === "right" ? "flex-row-reverse" : ""
      } ${active ? "text-racing" : ""}`}
    >
      {label}
      <span
        className={`text-[9px] transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          {dir === "asc" ? (
            <path d="M8 14l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </span>
    </button>
  );
}

function Stepper({
  value,
  tone,
  step,
  disabled,
  onMinus,
  onPlus,
}: {
  value: number;
  tone: string;
  step: number;
  disabled: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <StepButton label={`-${step}`} onClick={onMinus} disabled={disabled}>
        −
      </StepButton>
      <span className={`num min-w-[62px] text-right text-[13px] font-medium ${tone}`}>
        {formatNumber(value)}
      </span>
      <StepButton label={`+${step}`} onClick={onPlus} disabled={disabled}>
        +
      </StepButton>
    </div>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-ink/12 text-[13px] leading-none text-ink-faint transition-colors hover:border-racing/50 hover:bg-racing/10 hover:text-racing active:scale-95 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function IconAction({
  label,
  onClick,
  icon,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-transparent transition-colors ${
        danger
          ? "text-ink-faint hover:border-oxblood/40 hover:bg-oxblood/10 hover:text-oxblood"
          : "text-ink-faint hover:border-ink/20 hover:bg-ink/5 hover:text-racing"
      }`}
    >
      {icon}
    </button>
  );
}

/** Compact G/S/B tally for the fleet table. */
function TrophyTally({ summary }: { summary?: TrophySummary }) {
  if (!summary || summary.total === 0) {
    return <span className="num text-[11px] text-ink-faint">—</span>;
  }
  return (
    <span className="num flex items-center gap-2 text-[11px]">
      {summary.gold > 0 ? <span className="text-brass">{summary.gold}G</span> : null}
      {summary.silver > 0 ? <span className="text-silver">{summary.silver}S</span> : null}
      {summary.bronze > 0 ? <span className="text-bronze">{summary.bronze}B</span> : null}
    </span>
  );
}
