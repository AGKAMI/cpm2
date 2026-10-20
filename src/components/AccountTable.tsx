"use client";

import type { AccountSummary } from "@/lib/types";
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
}: AccountTableProps) {
  const archived = mode === "archived";

  return (
    <>
      {/* Desktop: dense fleet table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1120px] border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="label-caps w-12 px-4 py-3 text-left">#</th>
              <th className="label-caps px-4 py-3 text-left">
                <SortButton label="Account" active={sortKey === "email"} dir={sortDir} onClick={() => onSort("email")} />
              </th>
              <th className="label-caps px-4 py-3 text-left">Password</th>
              <th className="label-caps px-4 py-3 text-right">
                <SortButton label="Cash" active={sortKey === "cash"} dir={sortDir} onClick={() => onSort("cash")} align="right" />
              </th>
              <th className="label-caps px-4 py-3 text-right">
                <SortButton label="Coins" active={sortKey === "coins"} dir={sortDir} onClick={() => onSort("coins")} align="right" />
              </th>
              <th className="label-caps w-[260px] px-4 py-3 text-left">
                <SortButton label="Cars / Capacity" active={sortKey === "cars"} dir={sortDir} onClick={() => onSort("cars")} />
              </th>
              <th className="label-caps px-4 py-3 text-left">Updated</th>
              <th className="label-caps px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account, index) => (
              <tr
                key={account.id}
                className={`group border-b border-white/5 transition-colors hover:bg-white/[0.03] ${
                  busyId === account.id ? "opacity-60" : ""
                }`}
              >
                <td className="num px-4 py-3 text-[11px] text-ash-600">
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td className="px-4 py-3">
                  <p className="num truncate text-[13px] text-ash-100">{account.email}</p>
                  {account.notes ? (
                    <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-ash-600">{account.notes}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <PasswordCell accountId={account.id} />
                </td>
                <td className="px-4 py-3">
                  <Stepper
                    value={account.cash}
                    tone="text-mint-glow"
                    step={STEPS.cash}
                    disabled={busyId === account.id || archived}
                    onMinus={() => onAdjust(account, "cash", -STEPS.cash)}
                    onPlus={() => onAdjust(account, "cash", STEPS.cash)}
                  />
                </td>
                <td className="px-4 py-3">
                  <Stepper
                    value={account.coins}
                    tone="text-amber-glow"
                    step={STEPS.coins}
                    disabled={busyId === account.id || archived}
                    onMinus={() => onAdjust(account, "coins", -STEPS.coins)}
                    onPlus={() => onAdjust(account, "coins", STEPS.coins)}
                  />
                </td>
                <td className="px-4 py-3">
                  <CapacityGauge cars={account.cars} capacity={account.capacity} />
                  {archived ? null : (
                    <button
                      type="button"
                      onClick={() => onBuySlot(account)}
                      className="mt-1.5 font-display text-[10px] uppercase tracking-[0.18em] text-ash-600 transition hover:text-amber-glow"
                    >
                      + buy slot (100c)
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-[11px] text-ash-500">{relativeTime(account.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {archived ? (
                      <IconAction
                        label="Restore account"
                        onClick={() => onRestore?.(account)}
                        icon={
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
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
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                              <path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          }
                        />
                        <IconAction
                          label="Archive account"
                          danger
                          onClick={() => onDelete(account)}
                          icon={
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
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
            className={`panel-tight rounded-xl p-4 ${busyId === account.id ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="num truncate text-[13px] text-ash-100">{account.email}</p>
                {account.notes ? (
                  <p className="mt-0.5 truncate text-[11px] text-ash-600">{account.notes}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                {archived ? (
                  <IconAction
                    label="Restore account"
                    onClick={() => onRestore?.(account)}
                    icon={
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
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
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                    <IconAction
                      label="Archive account"
                      danger
                      onClick={() => onDelete(account)}
                      icon={
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
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

            <dl className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <dt className="label-caps">Cash</dt>
                <dd className="num mt-1 text-[13px] text-mint-glow">{formatNumber(account.cash)}</dd>
              </div>
              <div>
                <dt className="label-caps">Coins</dt>
                <dd className="num mt-1 text-[13px] text-amber-glow">{formatNumber(account.coins)}</dd>
              </div>
              <div>
                <dt className="label-caps">Updated</dt>
                <dd className="mt-1 text-[11px] text-ash-500">{relativeTime(account.updatedAt)}</dd>
              </div>
            </dl>

            <div className="mt-3">
              <CapacityGauge cars={account.cars} capacity={account.capacity} />
            </div>

            {archived ? null : (
              <button
                type="button"
                onClick={() => onBuySlot(account)}
                className="mt-3 w-full rounded-lg border border-amber-glow/30 py-2 font-display text-[10px] uppercase tracking-[0.2em] text-amber-glow transition hover:bg-amber-glow/10"
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
      className={`inline-flex items-center gap-1 transition hover:text-amber-glow ${
        align === "right" ? "flex-row-reverse" : ""
      } ${active ? "text-amber-glow" : ""}`}
    >
      {label}
      <span
        className={`text-[9px] transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
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
      <span className={`num min-w-[74px] text-right text-[13px] font-medium ${tone}`}>
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
      className="grid h-6 w-6 place-items-center rounded border border-white/10 text-[13px] leading-none text-ash-500 opacity-60 transition hover:border-amber-glow/40 hover:text-amber-glow hover:opacity-100 disabled:opacity-30"
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
      className={`grid h-8 w-8 place-items-center rounded-lg border border-transparent transition ${
        danger
          ? "text-ash-600 hover:border-red-glow/40 hover:bg-red-glow/10 hover:text-red-glow"
          : "text-ash-500 hover:border-white/12 hover:bg-white/5 hover:text-amber-glow"
      }`}
    >
      {icon}
    </button>
  );
}
