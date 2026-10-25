"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import { api, ApiRequestError } from "@/lib/client";
import { carsForGame, searchCars, type CarEntry } from "@/lib/car-catalog";
import { GAME_LABELS } from "@/lib/constants";
import type { GarageSummary } from "@/lib/types";

type CarPickerModalProps = {
  open: boolean;
  accountId: number;
  accountEmail: string;
  garage: GarageSummary;
  onClose: () => void;
  onGarage: (garage: GarageSummary) => void;
};

export function CarPickerModal({
  open,
  accountId,
  accountEmail,
  garage,
  onClose,
  onGarage,
}: CarPickerModalProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [busyCode, setBusyCode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  // The picker mounts fresh each time it opens, so its query starts empty.
  const parked = useMemo(() => {
    const counts = new Map<number, number>();
    for (const car of garage.cars) {
      counts.set(car.carCode, (counts.get(car.carCode) ?? 0) + 1);
    }
    return counts;
  }, [garage.cars]);

  // Search ONLY this account's game. Car codes collide between CPM1 and CPM2
  // (code 13 is a Peugeot 308 in one and a Honda Civic in the other), so
  // searching both would offer cars this account can never actually own, and
  // the add would silently park a different car than the one on screen.
  const catalogSize = useMemo(() => carsForGame(garage.game).length, [garage.game]);
  const results = useMemo(
    () => searchCars(debounced, catalogSize, garage.game),
    [debounced, catalogSize, garage.game],
  );

  const full = garage.count >= garage.capacity;
  const free = Math.max(0, garage.capacity - garage.count);
  const ratio = garage.capacity > 0 ? Math.min(1, garage.count / garage.capacity) : 0;

  async function add(entry: CarEntry) {
    if (full || busyCode !== null) return;
    const alreadyOwned = parked.get(entry.code) ?? 0;
    setBusyCode(entry.code);
    setError(null);
    try {
      const result = await api.addCar(accountId, { carCode: entry.code });
      onGarage(result.garage);
      toast.success(
        alreadyOwned > 0 ? "Another car parked" : "Car parked",
        `#${entry.code} ${entry.name} is now in ${accountEmail}'s garage${
          alreadyOwned > 0 ? ` (${alreadyOwned + 1} of this model)` : ""
        }.`,
      );
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Could not add that car.";
      setError(message);
      toast.error("Could not add the car", message);
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add a ${GAME_LABELS[garage.game]} car`}
      subtitle={`Searching the ${GAME_LABELS[garage.game]} catalog by code or name. Every car you park is logged to this account.`}
      width="max-w-2xl"
      footer={
        <Button variant="primary" onClick={onClose} type="button">
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="panel-tight rounded-[16px] px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="label-caps">Garage</span>
            <span className="num text-[12px] text-ink">
              {garage.count}/{garage.capacity}
              <span className={`ml-2 ${full ? "text-oxblood" : "text-ink-faint"}`}>
                {full ? "full" : `${free} free`}
              </span>
            </span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className={`h-full transition-[width] duration-500 ${full ? "bg-oxblood" : "bg-racing"}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="car-picker-search" className="label-caps">
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
              id="car-picker-search"
              name="car-search"
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
            {results.length} of {catalogSize} {GAME_LABELS[garage.game]} codes
          </p>
        </div>

        {full ? (
          <p className="rounded-[14px] border border-oxblood/35 bg-oxblood/8 px-3 py-2 text-xs text-oxblood">
            This garage is full ({garage.count}/{garage.capacity}). Free a car or buy a slot before
            adding another.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-[14px] border border-oxblood/35 bg-oxblood/8 px-3 py-2 text-xs text-oxblood">
            {error}
          </p>
        ) : null}

        <ul className="-mx-2 flex max-h-[46vh] flex-col overflow-y-auto pr-1">
          {results.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-ink-faint">
              No car matches “{debounced.trim()}”.
            </li>
          ) : (
            results.map((entry) => {
              const parkedCount = parked.get(entry.code) ?? 0;
              const working = busyCode === entry.code;
              const disabled = full || busyCode !== null;
              return (
                <li key={entry.code}>
                  <button
                    type="button"
                    onClick={() => void add(entry)}
                    disabled={disabled}
                    aria-label={`Add ${
                      parkedCount > 0 ? "another " : ""
                    }#${entry.code} ${entry.name} to the garage`}
                    className={`flex w-full items-center gap-3 rounded-[12px] border border-transparent px-3 py-2.5 text-left transition-colors ${
                      full
                        ? "cursor-not-allowed opacity-45"
                        : "cursor-pointer hover:border-racing/30 hover:bg-racing/6"
                    }`}
                  >
                    <span className="num w-11 shrink-0 text-[12px] text-ink-faint">
                      #{entry.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {entry.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {parkedCount > 0 ? (
                        <span className="num rounded-full border border-ink/12 px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-ink-faint">
                          ×{parkedCount}
                        </span>
                      ) : null}
                      {working ? (
                        <span className="num text-[10px] text-racing">Adding…</span>
                      ) : full ? (
                        <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.12em] text-oxblood">
                          Full
                        </span>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 text-racing"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
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
