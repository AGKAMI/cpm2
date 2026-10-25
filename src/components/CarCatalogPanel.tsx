"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiRequestError } from "@/lib/client";
import { CAR_CATALOG, carsForGame, searchCars } from "@/lib/car-catalog";
import { GAMES, GAME_LABELS } from "@/lib/constants";
import type { GarageSummary } from "@/lib/types";

/**
 * The full code reference for BOTH games — 207 CPM1 + 208 CPM2 — searchable by
 * code or name, split into one region per game.
 *
 * The split is not cosmetic. Codes collide across titles (code 13 is a Peugeot
 * 308 in CPM1 and a Honda Civic in CPM2), so ownership must be keyed by
 * game + code. Keyed by code alone, one account owning a CPM1 car lights up the
 * CPM2 car of the same number, and React sees duplicate list keys.
 */
export function CarCatalogPanel() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [garages, setGarages] = useState<GarageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    api
      .garages()
      .then((result) => {
        if (!cancelled) {
          setGarages(result.garages);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Could not load the garages.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Owned counts keyed by "game:code" — a bare code is ambiguous. */
  const ownership = useMemo(() => {
    const counts = new Map<string, number>();
    for (const garage of garages ?? []) {
      for (const car of garage.cars) {
        const key = `${car.game}:${car.carCode}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [garages]);

  /** One result set per game, so a numeric query cannot blur the two together. */
  const sections = useMemo(
    () =>
      GAMES.map((game) => ({
        game,
        total: carsForGame(game).length,
        cars: searchCars(debounced, carsForGame(game).length, game),
      })),
    [debounced],
  );

  const shown = sections.reduce((sum, section) => sum + section.cars.length, 0);

  return (
    <section className="panel rounded-[20px] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Car codes</h2>
          <p className="num mt-1 text-[10px] text-ink-faint">
            {CAR_CATALOG.length} codes · CPM1 and CPM2 · dot = already in the fleet
          </p>
        </div>
        <div className="text-right">
          {error ? (
            <span className="num text-[10px] text-oxblood">{error}</span>
          ) : garages === null ? (
            <span className="num text-[10px] text-ink-faint">loading garages…</span>
          ) : (
            <span className="num text-[10px] text-ink-faint">
              <span className="text-racing">{ownership.size}</span> of {CAR_CATALOG.length} owned
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="car-catalog-search" className="label-caps">
            Search both catalogs
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
              id="car-catalog-search"
              name="catalog-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="49, supra, gt…"
              autoComplete="off"
              spellCheck={false}
              className="field-rule pl-10 text-[13px]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear the catalog search"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-faint transition hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
        <p className="num pb-2.5 text-[10px] text-ink-faint">
          {shown} of {CAR_CATALOG.length} codes
        </p>
      </div>

      {shown === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          No car matches “{debounced.trim()}”.
        </p>
      ) : (
        // One region per game, inside a single scroll area so the two blocks
        // read as neighbours rather than as separate widgets.
        <div className="mt-4 max-h-[420px] overflow-y-auto overscroll-contain pr-2">
          {sections
            .filter((section) => section.cars.length > 0)
            .map((section) => (
              <div key={section.game} className="mb-3 last:mb-0">
                {/* The game boundary is stated BEFORE the first row of each
                    block — a gap alone would leave the boundary implicit. */}
                <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink/12 bg-paper-raised/95 pb-2 pt-1 backdrop-blur">
                  <span className="label-caps w-11 shrink-0 text-blueprint">
                    {GAME_LABELS[section.game]}
                  </span>
                  <span className="label-caps flex-1">Model</span>
                  <span className="num w-16 shrink-0 text-right text-[10px] text-ink-faint">
                    {section.cars.length}/{section.total}
                  </span>
                </div>

                <ul>
                  {section.cars.map((entry) => {
                    const count = ownership.get(`${entry.game}:${entry.code}`) ?? 0;
                    return (
                      <li
                        key={`${entry.game}-${entry.code}`}
                        className="flex items-center gap-3 border-b border-ink/6 py-1.5 last:border-0 hover:bg-ink/[0.03]"
                      >
                        <span className="num w-11 shrink-0 text-[11px] text-ink-faint">#{entry.code}</span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">{entry.name}</span>
                        <span
                          className="flex w-16 shrink-0 items-center justify-end gap-1.5"
                          title={count > 0 ? `In the fleet${count > 1 ? ` · ${count} cars` : ""}` : undefined}
                        >
                          {count > 0 ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-racing" aria-hidden="true" />
                              <span className="num text-[10px] text-ink-faint">×{count}</span>
                              <span className="sr-only">
                                Owned{count > 1 ? ` (${count} cars in the fleet)` : ""}
                              </span>
                            </>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
