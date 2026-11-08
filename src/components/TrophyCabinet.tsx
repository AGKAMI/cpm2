"use client";

import { useEffect, useState } from "react";
import { api, ApiRequestError } from "@/lib/client";
import { TROPHY_CLASSES, TROPHY_CLASS_LABELS, type TrophyClass } from "@/lib/constants";
import type { TrophyRecord } from "@/lib/types";

const METALS = [
  { key: "gold", label: "Gold", text: "text-racing", dot: "bg-racing border border-racing text-racing" },
  { key: "silver", label: "Silver", text: "text-ink-soft", dot: "bg-background border border-border text-ink-soft" },
  { key: "bronze", label: "Bronze", text: "text-ink-faint", dot: "bg-background border border-border text-ink-faint" },
] as const;

type MetalKey = (typeof METALS)[number]["key"];

/**
 * The trophy cabinet: one row per drag racing class, one column per metal.
 * Counts are set with the steppers and saved straight to the ledger.
 */
export function TrophyCabinet({
  accountId,
  readOnly = false,
  onChanged,
}: {
  accountId: number;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<TrophyRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .trophies(accountId)
      .then((result) => {
        if (!cancelled) {
          setRows(result.trophies);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Could not load the trophies.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const totals = rows.reduce(
    (sum, row) => ({
      gold: sum.gold + row.gold,
      silver: sum.silver + row.silver,
      bronze: sum.bronze + row.bronze,
    }),
    { gold: 0, silver: 0, bronze: 0 },
  );

  async function bump(klass: string, metal: MetalKey, delta: number) {
    const row = rows.find((item) => item.class === klass);
    if (!row) return;
    const next = Math.max(0, row[metal] + delta);
    setBusy(`${klass}:${metal}`);
    try {
      const result = await api.setTrophies(accountId, {
        class: klass,
        gold: metal === "gold" ? next : row.gold,
        silver: metal === "silver" ? next : row.silver,
        bronze: metal === "bronze" ? next : row.bronze,
      });
      setRows((current) =>
        current.map((item) => (item.class === klass ? result.trophy : item)),
      );
      setError(null);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not save the trophies.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="panel-title">Drag racing trophies</span>
        <span className="num text-[10px] text-ink-faint">
          {totals.gold + totals.silver + totals.bronze} won ·{" "}
          <span className="text-brass">{totals.gold}G</span>{" "}
          <span className="text-silver">{totals.silver}S</span>{" "}
          <span className="text-bronze">{totals.bronze}B</span>
        </span>
      </div>

      <div className="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-x-1.5 gap-y-1.5 sm:gap-x-3">
        <span className="label-caps">Class</span>
        {METALS.map((metal) => (
          <span key={metal.key} className="num w-[68px] text-center text-[10px] uppercase tracking-[0.12em] text-ink-faint sm:w-[68px]">
            {metal.label}
          </span>
        ))}

        {TROPHY_CLASSES.map((klass) => {
          const row = rows.find((item) => item.class === klass);
          return (
            <div key={klass} className="contents">
              <span className="num text-[12px] text-ink">
                {TROPHY_CLASS_LABELS[klass as TrophyClass]}
                {row && row.total > 0 ? (
                  <span className="ml-1.5 text-[10px] text-ink-faint">{row.total}</span>
                ) : null}
              </span>
              {METALS.map((metal) => {
                const value = row ? row[metal.key] : 0;
                return (
                  <span key={metal.key} className={`flex w-[68px] items-center justify-center gap-0.5 sm:gap-1 rounded-full border p-1 transition-all duration-150 ${value > 0 ? `border-${metal.key} bg-${metal.key}` : "border-border bg-background"}`}>
                    <button
                      type="button"
                      onClick={() => void bump(klass, metal.key, -1)}
                      disabled={readOnly || busy !== null || value === 0}
                      aria-label={`Remove one ${metal.label.toLowerCase()} trophy from class ${klass}`}
                      className={`square-btn h-6 w-6 text-[12px] transition-all duration-150 ${value > 0 ? "text-racing hover:border-primary hover:text-primary-foreground active:scale-95" : "text-ink-faint hover:border-primary hover:text-primary-foreground active:scale-95"}`}
                    >
                      −
                    </button>
                    <span className={`num w-4 text-center text-[12px] sm:w-5 ${value > 0 ? metal.text : "text-ink-faint"}`}>
                      {value}
                    </span>
                    <button
                      type="button"
                      onClick={() => void bump(klass, metal.key, 1)}
                      disabled={readOnly || busy !== null}
                      aria-label={`Add one ${metal.label.toLowerCase()} trophy to class ${klass}`}
                      className={`square-btn h-6 w-6 text-[12px] transition-all duration-150 ${value > 0 ? "text-racing hover:border-primary hover:text-primary-foreground active:scale-95" : "text-ink-faint hover:border-primary hover:text-primary-foreground active:scale-95"}`}
                    >
                      +
                    </button>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-[11px] text-oxblood">{error}</p> : null}
    </div>
  );
}
