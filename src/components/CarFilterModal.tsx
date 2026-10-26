"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/client";
import { carsForGame, searchCars } from "@/lib/car-catalog";
import { GAME_LABELS, type GameType } from "@/lib/constants";
import type { CarOwners } from "@/lib/types";

type CarFilterModalProps = {
  open: boolean;
  game: GameType;
  onClose: () => void;
  onSelect: (carCode: number) => void;
};

/**
 * "Which of my CPM1 accounts has this car?" — pick a car, see the accounts.
 *
 * The search is scoped to ONE game on purpose. Codes collide between CPM1 and
 * CPM2 (code 13 is a Peugeot 308 in one, a Honda Civic in the other), so a
 * cross-game search would list two different cars side by side and leave the
 * user picking between ambiguities. Scoping to the open page's game makes
 * every result a real, unambiguous answer.
 *
 * Each result row shows how many accounts hold it BEFORE you commit, so a
 * filter that would return nothing is visible as you search rather than
 * after clicking.
 */
export function CarFilterModal({ open, game, onClose, onSelect }: CarFilterModalProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [owners, setOwners] = useState<Record<number, number>>({});

  const label = GAME_LABELS[game];
  const total = useMemo(() => carsForGame(game).length, [game]);
  const results = useMemo(
    () => searchCars(debounced, 60, game),
    [debounced, game],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  // One fleet-wide pass gives every car's owner count, so the rows can show
  // "3 accounts" without a request per keystroke.
  // Busy is DERIVED, not stored: any visible car without a loaded count is by
  // definition still being checked. Keeping a `setBusy` call in the effect
  // body would be a synchronous setState on every render of the effect.
  const busy = useMemo(
    () => results.some((entry) => owners[entry.code] === undefined),
    [results, owners],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all(
      results.map((entry) =>
        api
          .carOwners(game, entry.code)
          .then((result: { owners: CarOwners }) => result.owners.owners.length)
          .catch(() => 0),
      ),
    )
      .then((counts) => {
        if (cancelled) return;
        const next: Record<number, number> = {};
        results.forEach((entry, index) => {
          next[entry.code] = counts[index] ?? 0;
        });
        setOwners(next);
      })
      .catch(() => {
        // A failed lookup leaves that code uncounted, which renders as "…"
        // rather than a wrong "no accounts".
      });
    return () => {
      cancelled = true;
    };
  }, [results, game, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Filter ${label} accounts by car`}
      subtitle={`Searching the ${label} catalog. Pick a car to see which ${label} accounts hold it — cars are matched by code within ${label} only.`}
      width="max-w-2xl"
      footer={null}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="car-filter-search" className="label-caps">
            Search the {label} catalog
          </label>
          <div className="relative mt-1.5">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              id="car-filter-search"
              name="car-filter-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="49, supra, civic…"
              autoComplete="off"
              spellCheck={false}
              className="field-rule pl-10 text-[13px]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear the car search"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-faint transition hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </div>
          <p className="num mt-1.5 text-[10px] text-ink-faint">
            {results.length} of {total} {label} codes
            {busy ? " · checking owners…" : ""}
          </p>
        </div>

        <ul className="-mx-2 flex max-h-[46vh] flex-col overflow-y-auto pr-1">
          {results.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-ink-faint">
              No {label} car matches “{debounced.trim()}”.
            </li>
          ) : (
            results.map((entry) => {
              const count = owners[entry.code];
              const loaded = count !== undefined;
              const none = loaded && count === 0;
              return (
                <li key={entry.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(entry.code);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-3 rounded-[12px] border border-transparent px-3 py-2.5 text-left transition-colors ${
                      none
                        ? "cursor-pointer opacity-60 hover:border-ink/15 hover:bg-ink/[0.03]"
                        : "cursor-pointer hover:border-racing/30 hover:bg-racing/6"
                    }`}
                  >
                    <span className="num w-11 shrink-0 text-[12px] text-ink-faint">
                      #{entry.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {entry.name}
                    </span>
                    <span className="w-20 shrink-0 text-right">
                      {!loaded ? (
                        <span className="num text-[10px] text-ink-faint">…</span>
                      ) : count === 0 ? (
                        <span className="num text-[10px] text-ink-faint">no accounts</span>
                      ) : (
                        <span className="num rounded-full border border-racing/30 bg-racing/10 px-2 py-0.5 text-[10px] font-semibold text-racing">
                          {count} account{count === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Modal>
  );
}
