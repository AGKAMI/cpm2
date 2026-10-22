"use client";

import type { ReactNode } from "react";

/**
 * Dash heading — a mint folio pill, a heavy display title and a hairline rule.
 */
export function PageHeading({
  folio,
  title,
  meta,
}: {
  folio: string;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="num shrink-0 rounded-full border border-racing/30 bg-racing/10 px-2.5 py-1 text-[9px] tracking-[0.2em] text-racing">
            {folio}
          </span>
          <h1 className="display-title min-w-0 text-[30px] leading-[0.95] text-ink sm:text-[40px]">
            {title}
          </h1>
        </div>
        {meta ? (
          <div className="glass-control num rounded-full px-3 py-1.5 text-[10px] text-ink-faint">
            {meta}
          </div>
        ) : null}
      </div>
      <div className="rule-double mt-4" />
    </div>
  );
}
