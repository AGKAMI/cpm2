"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * App selection screen — Fleet Ledger vs VANTA Garage.
 *
 * Full-screen dark showroom. Two cards, one per app, nothing else.
 * Tapping a card opens that app; each app shell carries a "back to
 * selection" control so you can switch without using the browser back button.
 */
export function AppSelection() {
  const router = useRouter();

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
        {/* Fleet Ledger card - blue racing accent. */}
        <Link
          href="/fleet/cpm2"
          onClick={() => open("/fleet/cpm2")}
          className="flex flex-col gap-3 rounded-[28px] border border-border bg-background p-8 sm:p-10 shadow-xl hover:border-primary hover:text-primary-foreground transition-colors duration-200 group"
          aria-label="Open Fleet Ledger"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[18px] border border-racing bg-racing flex items-center justify-center">
              <svg className="h-5 w-5 text-racing" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                <path d="M16 6v8M8 12h8" />
              </svg>
            </div>
            <div>
              <span className="block text-[16px] font-semibold text-foreground">Fleet Ledger</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">CPM1 &bull; CPM2 accounts &bull; balances &bull; garage</span>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Track every account, every balance, every car. Two games, two registers.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[10px] font-semibold text-racing group-hover:text-racing">
            Open register &rarr;
          </span>
        </Link>

        {/* VANTA Garage card - gold premium accent. */}
        <Link
          href="/store"
          onClick={() => open("/store")}
          className="flex flex-col gap-3 rounded-[28px] border border-border bg-background p-8 sm:p-10 shadow-xl hover:border-brand-gold hover:text-primary-foreground transition-colors duration-200 group"
          aria-label="Open VANTA Garage"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[18px] border border-brand-gold bg-brand-gold flex items-center justify-center">
              <svg className="h-5 w-5 text-brand-paper" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <span className="block text-[16px] font-semibold text-foreground">VANTA Garage</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-ink-faint">real cars &bull; real ZAR &bull; Telegram Mini App</span>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Premium vehicle storefront. Buy cars in-game, pay ZAR via EFT or PayFast.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-[10px] font-semibold text-brand-gold group-hover:text-brand-gold">
            Open store &rarr;
          </span>
        </Link>
      </div>

      <div className="w-full max-w-[640px] mt-8">
        <p className="text-[9px] uppercase tracking-[0.25em] text-ink-faint text-center">
          CPM2 &middot; Fleet Ledger + VANTA Garage
        </p>
      </div>
    </div>
  );
}
