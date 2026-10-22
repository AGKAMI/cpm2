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
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span className="num rounded-full border border-racing/25 bg-racing/10 px-2.5 py-1 text-[9px] tracking-[0.2em] text-racing">
            {folio}
          </span>
          <h1 className="wordmark text-[28px] leading-none text-ink sm:text-[34px]">{title}</h1>
        </div>
        {meta ? <div className="num text-[10px] text-ink-faint">{meta}</div> : null}
      </div>
      <div className="rule-double mt-4" />
    </div>
  );
}
