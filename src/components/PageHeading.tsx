"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Dash heading — an accent folio pill, a heavy display title and a hairline rule.
 */
export function PageHeading({
  title,
  meta,
  backHref,
}: {
  /** Unused legacy accent label — kept so old call sites still compile; no longer rendered. */
  folio?: string;
  title: string;
  meta?: ReactNode;
  backHref?: string;
}) {
  return (
    <div className="mb-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-baseline gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-surface-deep active:scale-[0.98] transition-transform"
              aria-label="Back"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <h1 className="display-title min-w-0 text-[30px] leading-[0.95] text-ink sm:text-[40px]">
            {title}
          </h1>
        </div>
        {meta ? (
          <div className="num rounded-full px-3 py-1.5 text-[10px] text-ink-faint">
            {meta}
          </div>
        ) : null}
      </div>
      <div className="rule-double mt-4" />
    </div>
  );
}
