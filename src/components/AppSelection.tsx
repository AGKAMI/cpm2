"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function AppSelection() {
  const router = useRouter();
  const { mode } = useTheme();

  const open = (href: string) => {
    router.push(href);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 sm:p-10 bg-background">
      {/* Brand mark - gold serif, no shield (that's the garage's). */}
      <div className="flex flex-col items-center gap-2">
        <span className="block text-[44px] font-display font-bold tracking-[-0.03em] text-ink">CPM</span>
        <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft">choose your app</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6 mx-auto w-auto max-w-[640px]">
        {/* Fleet Ledger card - theme palette colours */}
        <ThemeAppCard
          app="fleet"
          mode={mode}
          title="Fleet Ledger"
          subtitle="CPM1 • CPM2 accounts • balances • garage"
          description="Track every account, every balance, every car. Two games, two registers."
          label="Open register"
          href="/fleet/cpm2"
          iconSrc="/app/icon.svg"
        />

        {/* VANTA Garage card - gold */}
        <ThemeAppCard
          app="garage"
          mode={mode}
          title="VANTA Garage"
          subtitle="real cars • real ZAR • Telegram Mini App"
          description="Premium vehicle storefront. Buy cars in-game, pay ZAR via EFT or PayFast."
          label="Open store"
          href="/store"
          iconSrc="/kami-vanta-logo-no-wings.svg"
        />
      </div>

      <div className="w-full max-w-[640px] mt-8">
        <p className="text-[9px] uppercase tracking-[0.25em] text-ink-faint text-center">
          CPM2 · Fleet Ledger + VANTA Garage
        </p>
      </div>
    </div>
  );
}

interface ThemeAppCardProps {
  app: "fleet" | "garage";
  mode: "night" | "paper";
  title: string;
  subtitle: string;
  description: string;
  label: string;
  href: string;
  iconSrc: string;
}

function ThemeAppCard({ app, mode, title, subtitle, description, label, href, iconSrc }: ThemeAppCardProps) {
  const isGarage = app === "garage";

  return (
    <Link
      href={href}
      onClick={() => open(href)}
      className="relative group transition-colors duration-200"
      aria-label={`Open ${title}`}
    >
      {/* Card surface — matches reference structure: overflow hidden, no white backdrop */}
      <div className={`app-card ${isGarage ? "app-card--garage" : "app-card--fleet"}`}>
        <div className="app-card__bg bg-background border border-gold" />
        <div className="app-card__blob bg-primary" />
        <div className="app-card__content">
          <div className="flex items-center gap-3 mb-6">
            <img
              src={iconSrc}
              alt={title}
              className="h-10 w-10 rounded-[18px] object-cover object-center"
            />
          </div>
          <span className="block text-[16px] font-semibold text-foreground">{title}</span>
          <span className={cn("text-[10px] uppercase tracking-[0.15em] text-ink-faint text-shine", isGarage ? "text-gold" : "text-primary")}>
            {subtitle}
          </span>
          <p className="text-[11px] leading-relaxed text-ink-soft mb-6">{description}</p>
          <span className="mt-auto inline-flex items-center gap-1 text-[10px] font-semibold">
            {label} →
          </span>
        </div>
      </div>
    </Link>
  );
}
