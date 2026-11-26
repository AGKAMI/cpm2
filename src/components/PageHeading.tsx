"use client";

import type { ReactNode } from "react";
import { BackLink } from "@/components/ui/BackLink";

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
          {backHref && <BackLink href={backHref} label="Back" />}
          <h1 className="display-title min-w-0 leading-tight text-ink sm:text-[40px]">
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
