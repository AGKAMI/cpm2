"use client";

import { useCallback, useRef, useState } from "react";
import { searchCars, type CarEntry } from "@/lib/car-catalog";
import { api } from "@/lib/client";
import { type GarageSummary } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";

type CarPickerModalProps = {
  open: boolean;
  accountId: number;
  accountEmail: string;
  garage: GarageSummary;
  onClose: () => void;
  onGarage: (next: GarageSummary) => void;
};

export function CarPickerModal({
  open,
  accountId,
  accountEmail,
  garage,
  onClose,
  onGarage,
}: CarPickerModalProps) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Reset search when the modal opens.
  if (open) {
    setQuery("");
    setError(null);
  }

  // Filter the catalog client-side by game. ~208 rows, trivial cost.
  const matches = searchCars(query, 50, garage.game as "cpm1" | "cpm2");

  const alreadyOwned = new Set(garage.cars.map((c) => c.carCode));

  const handleAdd = useCallback(
    async (car: CarEntry) => {
      if (adding !== null) return;
      setError(null);
      setAdding(car.code);
      try {
        await api.addCar(accountId, { carCode: car.code });
        onGarage(garage);
        setQuery("");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not add the car.";
        if ((err as { code?: string }).code === "car_duplicate") {
          setError(`${car.name} (#${car.code}) is already in ${accountEmail}'s garage.`);
        } else if ((err as { code?: string }).code === "garage_full") {
          setError(`${accountEmail}'s garage is full. Unlock a slot or buy the new garage first.`);
        } else {
          setError(message);
        }
      } finally {
        setAdding(null);
      }
    },
    [accountId, accountEmail, garage, adding, onGarage],
  );

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add car to garage"
      subtitle={`Choose from the ${garage.game.toUpperCase()} catalog - ${garage.count}/${garage.capacity} slots used`}
      width="max-w-lg"
    >
      <div className="space-y-4">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a car name or code…"
            autoComplete="off"
            autoFocus
            className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {error && (
          <p className="rounded-md border border-oxblood bg-oxblood px-3 py-2 text-xs text-oxblood">
            {error}
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {matches.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[12px] text-ink-faint">
                No {garage.game.toUpperCase()} catalog car matches “{query}”.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {matches.map((car) => {
                const owned = alreadyOwned.has(car.code);
                return (
                  <button
                    key={`${garage.game}-${car.code}`}
                    type="button"
                    disabled={owned || adding === car.code}
                    onClick={() => void handleAdd(car)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm rounded-md border-b border-border last:border-b-0 transition-colors ${
                      owned
                        ? "bg-background text-muted-foreground cursor-not-allowed"
                        : "bg-background text-foreground hover:bg-background hover:border-primary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="font-mono text-muted-foreground shrink-0"
                        aria-hidden="true"
                      >
                        #{car.code}
                      </span>
                      <span className={owned ? "line-through" : ""}>{car.name}</span>
                      {owned && (
                        <span className="num text-[10px] text-muted-foreground">owned</span>
                      )}
                    </div>
                    {adding === car.code ? (
                      <svg
                        className="h-3.5 w-3.5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path d="M12 6v6m0 0v6m0-3h6m-6 0H6" strokeLinecap="round" />
                      </svg>
                    ) : owned ? (
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
