"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/Button";

export type FleetFilter = "all" | "full" | "slots" | "cash-cap" | "coin-cap";

const FILTERS: { key: FleetFilter; label: string }[] = [
  { key: "all", label: "All accounts" },
  { key: "full", label: "Garage full" },
  { key: "slots", label: "Has extra slots" },
  { key: "cash-cap", label: "Cash at cap" },
  { key: "coin-cap", label: "Coins at cap" },
];

type FleetToolbarProps = {
  query: string;
  onQuery: (value: string) => void;
  filter: FleetFilter;
  onFilter: (value: FleetFilter) => void;
  archivedCount: number;
  showArchived: boolean;
  onShowArchived: (value: boolean) => void;
  onRefresh: () => void;
  searchRef?: RefObject<HTMLInputElement | null>;
};

export function FleetToolbar({
  query,
  onQuery,
  filter,
  onFilter,
  archivedCount,
  showArchived,
  onShowArchived,
  onRefresh,
  searchRef,
}: FleetToolbarProps) {
  return (
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="min-w-[200px] flex-1">
        <span className="label-caps">Search register</span>
        <div className="relative mt-1">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" strokeLinecap="round" />
          </svg>
          <input
            id="fleet-search"
            ref={searchRef}
            name="q"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="email or notes — press / "
            aria-label="Search accounts"
            autoComplete="off"
            spellCheck={false}
            className="field-rule num pl-10 text-[13px]"
          />
        </div>
      </div>

      <label className="block">
        <span className="label-caps">Filter</span>
          <select
            name="filter"
            value={filter}
            onChange={(event) => onFilter(event.target.value as FleetFilter)}
            className="glass-control mt-1 block h-10 cursor-pointer rounded-[12px] px-3 font-sans text-[12px] font-medium text-ink-soft hover:border-ink/20 focus:border-racing"
          >
          {FILTERS.map((item) => (
            <option key={item.key} value={item.key} className="bg-paper-raised text-ink">
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="label-caps">View</span>
        <div className="mt-1 flex items-center gap-1">
          <Button
            variant={showArchived ? "subtle" : "primary"}
            size="sm"
            onClick={() => onShowArchived(false)}
          >
            Active
          </Button>
          <Button
            variant={showArchived ? "primary" : "subtle"}
            size="sm"
            onClick={() => onShowArchived(true)}
          >
            Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        title="Refresh"
        aria-label="Refresh fleet"
        className="square-btn mb-0.5 h-9 w-9"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 11a8 8 0 10-1.6 5.6" strokeLinecap="round" />
          <path d="M20 4.5V11h-6.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
