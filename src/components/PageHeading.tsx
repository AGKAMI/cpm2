"use client";

import type { ReactNode } from "react";

/**
 * Folio heading — the printed heading each ledger page opens with:
 * folio number, serif display title, meta line, double rule.
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
          <span className="num text-[10px] tracking-[0.2em] text-ink-faint">{folio}</span>
          <h1 className="wordmark text-[26px] leading-none text-ink sm:text-[30px]">{title}</h1>
        </div>
        {meta ? <div className="num text-[10px] text-ink-faint">{meta}</div> : null}
      </div>
      <div className="rule-double mt-3" />
    </div>
  );
}
