/**
 * Shared shell for a game hub (/store/cpm2, /store/cpm1).
 *
 * Each game is a doorway: pick a sub-catalogue and you get listings. No
 * product grid renders on the hub itself — only the section tiles.
 */

import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";

export type GameSection = {
  slug: string;
  label: string;
  hint: string;
};

function Tile({ href, label, hint, children }: {
  href: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary px-4 py-5 transition-colors hover:border-primary/60"
    >
      <span className="text-ink-soft">{children}</span>
      <span className="text-sm font-bold uppercase tracking-[0.14em] text-foreground">{label}</span>
      <span className="text-[11px] leading-relaxed text-ink-faint">{hint}</span>
    </Link>
  );
}

function IconAccount() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
    </svg>
  );
}

function IconCar() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 16h14M3 13l2-5h14l2 5v3h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3v-3Z" strokeLinecap="round" />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 6a4 4 0 1 0 4 4l-8 8a2.8 2.8 0 0 1-4-4l8-8Z" strokeLinecap="round" />
    </svg>
  );
}

const ICONS: Record<string, () => React.ReactElement> = {
  accounts: IconAccount,
  cars: IconCar,
  services: IconWrench,
};

export function GameHubShell({
  game,
  title,
  blurb,
  sections,
}: {
  game: "cpm1" | "cpm2";
  title: string;
  blurb: string;
  sections: GameSection[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24">
      <header className="py-6">
        <BackLink href="/store" label="Store" className="mb-3" />
        <h1 className="mt-3 text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">{blurb}</p>
      </header>

      <nav aria-label={title} className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => {
          const Icon = ICONS[s.slug] ?? IconCar;
          return (
            <Tile key={s.slug} href={`/store/${game}/${s.slug}`} label={s.label} hint={s.hint}>
              <Icon />
            </Tile>
          );
        })}
      </nav>
    </div>
  );
}