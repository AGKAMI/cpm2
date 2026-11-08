"use client";

import { useEffect, useState } from "react";
import { CAR_CATALOG, searchCars, type CarEntry } from "@/lib/car-catalog";
import { api } from "@/lib/client";
import type { GarageSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export function CarCodesList() {
  const [query, setQuery] = useState("");
  const [garages, setGarages] = useState<GarageSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .garages()
      .then((result) => {
        if (cancelled) return;
        setGarages(result.garages);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load fleet garages.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build a set of (game, carCode) pairs owned across the fleet.
  const owned = new Set<string>();
  garages?.forEach((g) => {
    g.cars.forEach((c) => owned.add(`${g.game}:${c.carCode}`));
  });

  const matches = searchCars(query, 200).filter(
    (car) => car.game === "cpm2",
  );

  if (loading) {
    return (
      <div className="panel rounded-[20px] px-6 py-16 text-center">
        <p className="num text-[11px] text-ink-faint">Loading car codes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel rounded-[20px] px-6 py-16 text-center">
        <p className="text-[12px] text-oxblood">{error}</p>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            api.garages().then((r) => {
              setGarages(r.garages);
              setLoading(false);
            });
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const codesByGame = CAR_CATALOG.filter(
    (car: CarEntry) => car.game === "cpm2",
  );
  const filtered = matches.length > 0 ? matches : codesByGame;

  return (
    <section className="panel rounded-[20px] p-6 mb-8">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="panel-title">Car Codes · CPM2 Catalog</h2>
          <p className="num mt-1 text-[10px] text-ink-faint">
            {codesByGame.length} cars - search by name or code
          </p>
        </div>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a car name or code (e.g. supra, 49)…"
          autoComplete="off"
          className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-ink">
              <th className="text-[10px] uppercase tracking-[0.2em] text-ink-faint pb-2 font-medium">
                Code
              </th>
              <th className="text-[10px] uppercase tracking-[0.2em] text-ink-faint pb-2 font-medium pl-4">
                Name
              </th>
              <th className="text-[10px] uppercase tracking-[0.2em] text-ink-faint pb-2 font-medium">
                In Fleet
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((car) => {
              const inFleet = owned.has(`cpm2:${car.code}`);
              return (
                <tr
                  key={car.code}
                  className="border-b border-border hover:bg-background hover:border-primary"
                >
                  <td className="py-2.5 font-mono text-[11px] text-ink">
                    #{car.code}
                  </td>
                  <td className="py-2.5 pl-4 text-[11px] text-foreground">
                    {car.name}
                  </td>
                  <td className="py-2.5">
                    {inFleet ? (
                      <span className="flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-racing"
                          aria-hidden="true"
                        />
                        <span className="text-[10px] text-racing font-semibold">
                          in fleet
                        </span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-ink-faint">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && query && (
        <p className="mt-3 text-[11px] text-ink-faint">
          No CPM2 catalog car matches “{query}”.
        </p>
      )}
    </section>
  );
}
