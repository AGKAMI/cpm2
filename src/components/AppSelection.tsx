"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PALETTES,
  DEFAULT_PALETTE,
  FLEET_DEFAULT_PALETTE,
  type PaletteId,
} from "@/lib/themes";

function storedPalette(key: string, fallback: PaletteId): PaletteId {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return (v && PALETTES.some((p) => p.id === v) ? v : fallback) as PaletteId;
}

function storedMode(key: string): "night" | "paper" {
  if (typeof window === "undefined") return "night";
  return window.localStorage.getItem(key) === "paper" ? "paper" : "night";
}

export function AppSelection() {
  const [fleetId, setFleetId] = useState<PaletteId>(FLEET_DEFAULT_PALETTE);
  const [storeId, setStoreId] = useState<PaletteId>(DEFAULT_PALETTE);
  const [fleetMode, setFleetMode] = useState<"night" | "paper">("night");
  const [storeMode, setStoreMode] = useState<"night" | "paper">("night");

  useEffect(() => {
    setFleetId(storedPalette("cpm2:palette:v1:fleet", FLEET_DEFAULT_PALETTE));
    setStoreId(storedPalette("cpm2:palette:v1:store", DEFAULT_PALETTE));
    setFleetMode(storedMode("cpm2:theme:v2:fleet"));
    setStoreMode(storedMode("cpm2:theme:v2:store"));
  }, []);

  const fleet = PALETTES.find((p) => p.id === fleetId)!;
  const store = PALETTES.find((p) => p.id === storeId)!;
  const fleetColors = fleet[fleetMode];
  const storeColors = store[storeMode];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 sm:p-10 bg-background">
      {/* Brand mark - gold serif, no shield (that's the garage's). */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="block text-[44px] font-display font-bold tracking-[-0.03em] text-ink">
          CPM
        </h1>
        <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft">
          choose your app
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6 mx-auto w-auto max-w-[640px]">
        {/* Fleet Ledger card — matches the fleet app's active theme */}
        <ThemeAppCard
          app="fleet"
          title="Fleet Ledger"
          subtitle="CPM1 • CPM2 accounts • balances • garage"
          description="Track every account, every balance, every car. Two games, two registers."
          label="Open register"
          href="/fleet/cpm2"
          iconSrc="/cpm-logo.png"
          primary={fleetColors.primary}
          deep={fleetColors.deep}
          secondary={fleetColors.secondary}
        />

        {/* VANTA Garage card — matches the store app's active theme */}
        <ThemeAppCard
          app="garage"
          title="VANTA Garage"
          subtitle="real cars • real ZAR • Telegram Mini App"
          description="Premium vehicle storefront. Buy cars in-game, pay ZAR via EFT or PayFast."
          label="Open store"
          href="/store"
          iconSrc="/kami-vanta-logo-no-wings.png"
          primary={storeColors.primary}
          deep={storeColors.deep}
          secondary={storeColors.secondary}
        />
      </div>

      <div className="w-full max-w-[640px] mt-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-ink-soft text-center">
          CPM2 · Fleet Ledger + VANTA Garage
        </p>
      </div>
    </div>
  );
}

interface ThemeAppCardProps {
  app: "fleet" | "garage";
  title: string;
  subtitle: string;
  description: string;
  label: string;
  href: string;
  iconSrc: string;
  primary: string;
  deep: string;
  secondary: string;
}

function ThemeAppCard({
  app,
  title,
  subtitle,
  description,
  label,
  href,
  iconSrc,
  primary,
  deep,
  secondary,
}: ThemeAppCardProps) {
  const isGarage = app === "garage";

  return (
    <Link
      href={href}
      className="app-card-link"
      aria-label={`Open ${title}`}
    >
      {/* Card surface — matches reference structure: overflow hidden, no white backdrop */}
      <div
        className={`app-card ${isGarage ? "app-card--garage" : "app-card--fleet"}`}
        style={{
          "--card-primary": primary,
          "--card-deep": deep,
          "--card-secondary": secondary,
        } as React.CSSProperties}
      >
        <div className="app-card__bg bg-background border border-border" />
        <div className="app-card__blob" />
        <div className="app-card__content">
          <div className="flex items-center gap-3 mb-4">
            <span className={`icon-shine ${isGarage ? "icon-shine--garage" : "icon-shine--fleet"}`}>
              <img
                src={iconSrc}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-[18px] object-cover object-center"
              />
            </span>
          </div>
          <span className="block text-[16px] font-bold text-foreground">{title}</span>
          <span className="mt-1 block text-[10px] uppercase tracking-[0.15em] text-shine">
            {subtitle.split(" • ").join("\u00A0• ")}
          </span>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">{description}</p>
          <span className="mt-auto app-card__cta">
            {label}
            <span aria-hidden="true" className="app-card__arrow">
              →
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
