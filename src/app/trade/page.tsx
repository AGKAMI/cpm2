"use client";

import { useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { TradeDesk } from "@/components/TradeDesk";
import type { GameType } from "@/lib/constants";

const GAMES: { id: GameType; label: string }[] = [
  { id: "cpm2", label: "CPM2" },
  { id: "cpm1", label: "CPM1" },
];

export default function TradePage() {
  const [game, setGame] = useState<GameType>("cpm2");

  return (
    <>
        <div className="flex items-center justify-between gap-3 border-b border-ink pb-4 mb-6">
          <div className="flex items-center gap-2">
            <PageHeading folio="T-01" title="Trade Desk" meta={`${game.toUpperCase()} · value every deal in Rands`} />
          </div>
        </div>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Game">
        {GAMES.map((entry) => {
          const active = entry.id === game;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGame(entry.id)}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                active
                  ? "cursor-default border-racing bg-racing text-racing"
                  : "cursor-pointer border-border bg-background text-ink-faint hover:border-racing hover:text-racing"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
      <TradeDesk game={game} />
    </>
  );
}
