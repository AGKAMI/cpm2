"use client";

import { PageHeading } from "@/components/PageHeading";
import { TradeDesk } from "@/components/TradeDesk";

/**
 * The trade desk. CPM2 only for now — CPM1's plate is a promise, not a lie:
 * the valuation model there needs its own price book before it can be trusted.
 */
export default function TradePage() {
  return (
    <>
      <PageHeading folio="T-01" title="Trade Desk" meta="CPM2 · value every deal in Rands" />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Game">
        <button
          type="button"
          role="tab"
          aria-selected={true}
          className="cursor-default rounded-full border border-racing/45 bg-racing/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-racing"
        >
          CPM2
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          disabled
          title="Coming soon"
          className="cursor-not-allowed rounded-full border border-ink/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint opacity-60"
        >
          CPM1 · coming soon
        </button>
      </div>
      <TradeDesk />
    </>
  );
}
