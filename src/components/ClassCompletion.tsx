"use client";

import { TROPHY_CLASSES, TROPHY_CLASS_LABELS, type TrophyClass } from "@/lib/constants";
import type { TrophySummary } from "@/lib/types";

/**
 * Class completion board — which drag class is done, per metal, across the
 * fleet. A class is "gold-complete" for an account when that account holds
 * at least one gold in it; the count shows how many accounts cleared it.
 */
export function ClassCompletion({ trophies }: { trophies: Record<number, TrophySummary> }) {
  const summaries = Object.values(trophies);

  if (summaries.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-faint">
        Open an account and log its first trophy to light up the board.
      </p>
    );
  }

  const board = TROPHY_CLASSES.map((klass) => {
    const gold = summaries.filter((s) => (s.byClass.find((r) => r.class === klass)?.gold ?? 0) > 0).length;
    const silver = summaries.filter((s) => (s.byClass.find((r) => r.class === klass)?.silver ?? 0) > 0).length;
    const bronze = summaries.filter((s) => (s.byClass.find((r) => r.class === klass)?.bronze ?? 0) > 0).length;
    return { klass, gold, silver, bronze };
  });

  const accounts = summaries.length;

  return (
    <div>
      <div className="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-x-3 gap-y-1.5">
        <span className="label-caps">Class</span>
        {[
          { label: "Gold", dot: "bg-brass", text: "text-brass" },
          { label: "Silver", dot: "bg-silver", text: "text-silver" },
          { label: "Bronze", dot: "bg-bronze", text: "text-bronze" },
        ].map((metal) => (
          <span
            key={metal.label}
            className="num flex w-[72px] items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-faint"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${metal.dot}`} />
            {metal.label}
          </span>
        ))}

        {board.map(({ klass, gold, silver, bronze }) => {
          const complete = gold >= accounts && accounts > 0;
          return (
            <div key={klass} className="contents">
              <span className="num flex items-baseline gap-1.5 text-[12px] text-ink">
                {TROPHY_CLASS_LABELS[klass as TrophyClass]}
                {complete ? (
                  <span
                    className="inline-flex items-center text-brass"
                    title={`Every account holds a gold in ${klass}`}
                    aria-label={`${klass} complete: every account has a gold`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M4.5 12.5l5 5L19.5 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : null}
              </span>
              {[
                { metal: "gold", count: gold },
                { metal: "silver", count: silver },
                { metal: "bronze", count: bronze },
              ].map(({ metal, count }) => (
                <span key={metal} className="num w-[72px] text-center text-[12px]">
                  {count > 0 ? (
                    <span className={metal === "gold" ? "text-brass" : metal === "silver" ? "text-silver" : "text-bronze"}>
                      {count}/{accounts}
                    </span>
                  ) : (
                    <span className="text-ink-faint">·</span>
                  )}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      <p className="num mt-3 text-[10px] text-ink-faint">
        {accounts} account{accounts === 1 ? "" : "s"} tracked · a check means every account holds a gold in that class
      </p>
    </div>
  );
}
