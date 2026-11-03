import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { GuestGate } from "@/components/GuestGate";
import { GAMES, GAME_LABELS, formatNumber } from "@/lib/constants";
import { carsForGame } from "@/lib/car-catalog";

/**
 * Fleet entry point — a game picker, not a register.
 *
 * Each game is its own page so the two car catalogs stay apart: sharing a
 * link, reloading, or pressing back can never silently land you in the wrong
 * game's register. /fleet/cpm1 and /fleet/cpm2 also give the nav a stable
 * place to show which game you are in.
 */
export default function FleetIndexPage() {
  return (
    <GuestGate>
      <div className="flex flex-col gap-5">
      <PageHeading
        folio="F-10"
        title="Fleet"
        meta="choose a game — each has its own catalog and garage"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((game) => (
          <Link
            key={game}
            href={`/fleet/${game}`}
            className="panel animate-rise group rounded-[20px] p-5 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="panel-title">{GAME_LABELS[game]}</span>
              <span className="num text-[10px] text-ink-faint">
                {formatNumber(carsForGame(game).length)} cars
              </span>
            </div>
            <p className="num mt-1 text-[10px] text-ink-faint">
              Car Parking Multiplayer {game === "cpm1" ? "1" : "2"} · own catalog, own garage
            </p>
            <p className="num mt-4 flex items-center gap-1.5 text-[11px] text-racing">
              open the register
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </p>
          </Link>
        ))}
      </div>

      <p className="num px-1 text-[10px] text-ink-faint">
        codes collide between the two games — #13 is a 2007 PEUGEOT 308 in CPM1 and a HONDA CIVIC in
        CPM2 — so each register only ever shows its own game&rsquo;s cars
      </p>
    </div>
    </GuestGate>
  );
}
