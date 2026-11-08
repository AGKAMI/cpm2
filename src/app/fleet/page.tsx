import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { GAMES, GAME_LABELS, formatNumber } from "@/lib/constants";
import { carsForGame } from "@/lib/car-catalog";
import { CarCodesList } from "@/components/CarCodesList";

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
    <div className="flex flex-col gap-5">
      <PageHeading
        folio="F-10"
        title="Fleet"
        meta="choose a game - each has its own catalog and garage"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((game) => (
          <Link
            key={game}
            href={`/fleet/${game}`}
            className="panel animate-rise group rounded-[24px] p-6 sm:p-8 hover:border-primary hover:text-primary-foreground hover:border-racing transition-all duration-300 ease-out border border-border"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="panel-title text-ink">{GAME_LABELS[game]}</span>
              <span className="num text-[10px] text-ink-faint">
                {formatNumber(carsForGame(game).length)} cars
              </span>
            </div>
            <p className="num mt-3 text-[10px] text-ink-soft">
              Car Parking Multiplayer {game === "cpm1" ? "1" : "2"} · own catalog, own garage
            </p>
            <p className="num mt-6 flex items-center gap-1.5 text-[11px] text-racing font-semibold">
              open the register
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="rounded-full border border-racing bg-racing px-3 py-1 text-[9px] uppercase tracking-[0.2em] text-racing">
                {game === "cpm1" ? "G1" : "G2"}
              </span>
              <span className="flex-1 h-px bg-border" />
            </div>
          </Link>
        ))}
      </div>

      <p className="num px-1 text-[10px] text-ink-faint">
        codes collide between the two games - #13 is a 2007 PEUGEOT 308 in CPM1 and a HONDA CIVIC in
        CPM2 - so each register only ever shows its own game&rsquo;s cars
      </p>

      <CarCodesList />
    </div>
  );
}
