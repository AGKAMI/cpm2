"use client";

import { PageHeading } from "@/components/PageHeading";
import { TradeDesk } from "@/components/TradeDesk";
import Link from "next/link";

export default function TradePage() {
  return (
    <>
        <div className="flex items-center justify-between gap-3 border-b border-ink pb-4 mb-6">
          <div className="flex items-center gap-2">
            <PageHeading folio="T-01" title="Trade Desk" meta="CPM2 · value every deal in Rands" />
          </div>
        </div>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Game">
        <button
          type="button"
          role="tab"
          aria-selected={true}
          className="cursor-default rounded-full border border-racing bg-racing px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-racing"
        >
          CPM2
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          disabled
          title="Coming soon"
          className="cursor-not-allowed rounded-full border border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint bg-background"
        >
          CPM1 · coming soon
        </button>
      </div>
      <TradeDesk />
    </>
  );
}
