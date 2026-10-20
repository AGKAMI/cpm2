"use client";

import type { RefObject } from "react";

export type FleetFilter = "all" | "full" | "slots" | "cash-cap" | "coin-cap";
export type ConsoleTab = "fleet" | "archived" | "log";

const FILTERS: { key: FleetFilter; label: string }[] = [
  { key: "all", label: "All accounts" },
  { key: "full", label: "Garage full" },
  { key: "slots", label: "Has extra slots" },
  { key: "cash-cap", label: "Cash at cap" },
  { key: "coin-cap", label: "Coins at cap" },
];

type ToolbarProps = {
  query: string;
  onQuery: (value: string) => void;
  filter: FleetFilter;
  onFilter: (value: FleetFilter) => void;
  tab: ConsoleTab;
  onTab: (value: ConsoleTab) => void;
  onRefresh: () => void;
  archivedCount: number;
  searchRef?: RefObject<HTMLInputElement | null>;
};

export function Toolbar({
  query,
  onQuery,
  filter,
  onFilter,
  tab,
  onTab,
  onRefresh,
  archivedCount,
  searchRef,
}: ToolbarProps) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search email or notes…   (press / )"
          aria-label="Search accounts"
          className="h-10 w-full rounded-lg border border-white/10 bg-carbon-950/60 pl-9 pr-3 text-sm text-ash-100 placeholder:text-ash-600 focus:border-amber-glow/50 focus:outline-none"
        />
      </div>

      {tab === "fleet" ? (
        <label className="flex items-center gap-2">
          <span className="sr-only">Filter accounts</span>
          <select
            value={filter}
            onChange={(event) => onFilter(event.target.value as FleetFilter)}
            className="h-10 rounded-lg border border-white/10 bg-carbon-950/60 px-3 font-display text-[10px] uppercase tracking-[0.16em] text-ash-400 focus:border-amber-glow/50 focus:outline-none"
          >
            {FILTERS.map((item) => (
              <option key={item.key} value={item.key} className="bg-carbon-900 text-ash-200">
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex items-center gap-1 rounded-lg border border-white/10 p-1">
        {(
          [
            { key: "fleet", label: "Fleet" },
            { key: "archived", label: `Archived${archivedCount > 0 ? ` (${archivedCount})` : ""}` },
            { key: "log", label: "Activity log" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onTab(item.key)}
            className={`rounded-md px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.18em] transition ${
              tab === item.key
                ? "bg-amber-glow text-carbon-950"
                : "text-ash-500 hover:text-ash-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        title="Refresh"
        aria-label="Refresh fleet"
        className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-ash-500 transition hover:border-amber-glow/40 hover:text-amber-glow"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M20 11a8 8 0 10-1.6 5.6" strokeLinecap="round" />
          <path d="M20 4.5V11h-6.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
