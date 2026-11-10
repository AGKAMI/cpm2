"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

/**
 * App selection screen — Fleet Ledger vs VANTA Garage.
 *
 * Full-screen dark showroom. Two animated cards, one per app, nothing else.
 * Tapping a card opens that app; each app shell carries a "back to
 * selection" control so you can switch without using the browser back button.
 *
 * Card animation: Uiverse.io blob-bounce. Colours match each app's theme:
 *   - VANTA Garage   → gold outline + gold blob
 *   - Fleet Ledger   → active theme palette colours (primary / deep)
 */
export function AppSelection() {
  const router = useRouter();
  const { mode } = useTheme();

  const open = (href: string) => {
    router.push(href);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 sm:p-10">
      {/* Brand mark - gold serif, no shield (that's the garage's). */}
      <div className="flex flex-col items-center gap-2">
        <span className="block text-[44px] font-display font-bold tracking-[-0.03em] text-ink">CPM</span>
        <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft">choose your app</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6 w-full max-w-[640px]">
        {/* Fleet Ledger card - theme palette colours */}
        <ThemeAppCard
          app="fleet"
          mode={mode}
          title="Fleet Ledger"
          subtitle="CPM1 • CPM2 accounts • balances • garage"
          description="Track every account, every balance, every car. Two games, two registers."
          label="Open register"
          href="/fleet/cpm2"
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
              <path d="M16 6v8M8 12h8" />
            </svg>
          }
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
          icon={
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          }
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
  icon: React.ReactNode;
}

function ThemeAppCard({ app, mode, title, subtitle, description, label, href, icon }: ThemeAppCardProps) {
  const isGarage = app === "garage";

  // Garage always uses brand-gold. Fleet uses theme palette classes.
  const borderCls = isGarage ? "border-brand-gold" : "border-primary";
  const bgCls = isGarage ? "bg-brand-gold/10" : "bg-primary/10";
  const blobCls = isGarage ? "bg-brand-gold" : "bg-primary";
  const iconCls = isGarage ? "text-brand-gold" : "text-primary";
  const labelCls = isGarage ? "text-brand-gold" : "text-primary";
  const hoverBorderCls = isGarage ? "hover:border-brand-gold" : "hover:border-primary";

  return (
    <Link
      href={href}
      onClick={() => open(href)}
      className={cn(
        "relative group",
        hoverBorderCls,
        "transition-colors duration-200"
      )}
      aria-label={`Open ${title}`}
    >
      {/* Animated card surface */}
      <div className="app-card">
        <div className="app-card__bg bg-background backdrop-blur-md border border-border/50" />
        <div className={`app-card__blob animate-blob-bounce ${blobCls}`} />
        <div className="app-card__content">
          <div className="flex items-center gap-3 mb-6">
            <div className={cn("h-10 w-10 rounded-[18px] flex items-center justify-center", bgCls)}>
              {icon}
            </div>
            <div>
              <span className={cn("block text-[16px] font-semibold text-foreground", labelCls)}>{title}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">{subtitle}</span>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-soft mb-6">{description}</p>
          <span className="mt-auto inline-flex items-center gap-1 text-[10px] font-semibold">
            {label} →
          </span>
        </div>
      </div>
    </Link>
  );
}
