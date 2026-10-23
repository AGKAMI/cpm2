"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiRequestError } from "@/lib/client";
import { CAR_CATALOG, searchCars } from "@/lib/car-catalog";
import type { GarageSummary } from "@/lib/types";

/**
 * The full 208-code reference list, searchable by code or name.
 * Cars already parked anywhere in the fleet carry a small owned dot.
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

  const ownership = useMemo(() => {
    const counts = new Map<number, number>();
    for (const garage of garages ?? []) {
      for (const car of garage.cars) {
        counts.set(car.carCode, (counts.get(car.carCode) ?? 0) + 1);
      }
    }
    return counts;
  }, [garages]);

  const results = useMemo(
    () => searchCars(debounced, CAR_CATALOG.length),
    [debounced],
  );

  return (
    <section className="panel rounded-[20px] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Car codes</h2>
          <p className="num mt-1 text-[10px] text-ink-faint">
            {CAR_CATALOG.length} codes · search by code or name · dot = already in the fleet
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
            Search the catalog
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
          {results.length} of {CAR_CATALOG.length} codes
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3 border-b border-ink/10 pb-2">
        <span className="label-caps w-11 shrink-0">Code</span>
        <span className="label-caps flex-1">Model</span>
        <span className="label-caps w-8 text-right">Fleet</span>
      </div>

      {results.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          No car matches “{debounced.trim()}”.
        </p>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto overscroll-contain pr-2">
          {results.map((entry) => {
            const count = ownership.get(entry.code) ?? 0;
            return (
              <li
                key={entry.code}
                className="flex items-center gap-3 border-b border-ink/6 py-1.5 last:border-0 hover:bg-ink/[0.03]"
              >
                <span className="num w-11 shrink-0 text-[11px] text-ink-faint">#{entry.code}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">{entry.name}</span>
                <span className="flex w-8 shrink-0 items-center justify-end" title={count > 0 ? `In the fleet${count > 1 ? ` · ${count} cars` : ""}` : undefined}>
                  {count > 0 ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-racing" aria-hidden="true" />
                      <span className="sr-only">Owned{count > 1 ? ` (${count} cars in the fleet)` : ""}</span>
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
