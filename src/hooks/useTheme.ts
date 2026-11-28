"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_PALETTE,
  FLEET_DEFAULT_PALETTE,
  isPaletteId,
  type PaletteId,
  type ThemeMode,
} from "@/lib/themes";

export type ThemeName = ThemeMode;

type ThemeState = {
  mode: ThemeMode;
  palette: PaletteId;
};

/** Each app owns its own theme. The old single global key (`cpm2:theme:v2`)
 *  was shared by VANTA and Fleet, so toggling the theme in one silently
 *  re-themed the other. Storage is now namespaced per app, with a one-time
 *  migration from the legacy key so nobody loses the look they picked. */
const LEGACY_MODE_KEY = "cpm2:theme:v2";
const LEGACY_PALETTE_KEY = "cpm2:palette:v1";
type AppScope = "store" | "fleet";

function scopeFor(pathname: string | null | undefined): AppScope {
  return pathname?.startsWith("/store") ? "store" : "fleet";
}

function modeKey(scope: AppScope): string {
  return `${LEGACY_MODE_KEY}:${scope}`;
}

function paletteKey(scope: AppScope): string {
  return `${LEGACY_PALETTE_KEY}:${scope}`;
}
const SERVER_VANTA: ThemeState = { mode: "night", palette: DEFAULT_PALETTE };
const SERVER_NEON: ThemeState = { mode: "night", palette: FLEET_DEFAULT_PALETTE };
const listeners = new Set<() => void>();
let cached: ThemeState | null = null;

/** Fallback palette for the route on screen: /store keeps the house VANTA
 *  identity, Fleet Ledger opens in Neon 2 TONE. The active route is passed
 *  explicitly to the store readers instead of being cached in a module-level
 *  variable during render; a stored user choice always wins. */
function fallbackFor(pathname: string | null | undefined): PaletteId {
  return pathname?.startsWith("/store") ? DEFAULT_PALETTE : FLEET_DEFAULT_PALETTE;
}

function serverStateFor(fallback: PaletteId): ThemeState {
  return fallback === DEFAULT_PALETTE ? SERVER_VANTA : SERVER_NEON;
}

function readState(scope: AppScope, fallback: PaletteId): ThemeState {
  if (typeof window === "undefined") return serverStateFor(fallback);
  const storedMode =
    window.localStorage.getItem(modeKey(scope)) ?? window.localStorage.getItem(LEGACY_MODE_KEY);
  const mode: ThemeMode = storedMode === "paper" ? "paper" : "night";
  const storedPalette =
    window.localStorage.getItem(paletteKey(scope)) ?? window.localStorage.getItem(LEGACY_PALETTE_KEY);
  const palette = isPaletteId(storedPalette) ? storedPalette : fallback;
  if (!cached || cached.mode !== mode || cached.palette !== palette) {
    cached = { mode, palette };
  }
  return cached;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function apply(state: ThemeState) {
  const root = document.documentElement;
  root.setAttribute("data-theme", state.mode);
  root.setAttribute("data-palette", state.palette);
}

function write(next: ThemeState, scope: AppScope) {
  window.localStorage.setItem(modeKey(scope), next.mode);
  window.localStorage.setItem(paletteKey(scope), next.palette);
  cached = next;
  apply(next);
  for (const listener of listeners) listener();
}

export function useTheme() {
  const pathname = usePathname();
  const scope = scopeFor(pathname);
  const fallback = fallbackFor(pathname);
  const read = useCallback(() => readState(scope, fallback), [scope, fallback]);
  const server = useCallback(() => serverStateFor(fallback), [fallback]);

  const state = useSyncExternalStore(subscribe, read, server);

  useEffect(() => {
    apply(state);
  }, [state]);

  // One-time migration from the old shared key: copy the legacy value into
  // this app's own slot so each app keeps its own preference from now on.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(modeKey(scope)) === null) {
      const legacy = window.localStorage.getItem(LEGACY_MODE_KEY);
      if (legacy) window.localStorage.setItem(modeKey(scope), legacy);
    }
    if (window.localStorage.getItem(paletteKey(scope)) === null) {
      const legacy = window.localStorage.getItem(LEGACY_PALETTE_KEY);
      if (legacy) window.localStorage.setItem(paletteKey(scope), legacy);
    }
  }, [scope]);

  useEffect(() => {
    const onStorage = () => {
      cached = null;
      for (const listener of listeners) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    write({ ...readState(scope, fallback), mode }, scope);
  }, [scope, fallback]);

  const setPalette = useCallback((palette: PaletteId) => {
    write({ ...readState(scope, fallback), palette }, scope);
  }, [scope, fallback]);

  const toggleTheme = useCallback(() => {
    const current = readState(scope, fallback);
    write({ ...current, mode: current.mode === "night" ? "paper" : "night" }, scope);
  }, [scope, fallback]);

  return {
    theme: state.mode,
    mode: state.mode,
    palette: state.palette,
    setTheme: setMode,
    setMode,
    setPalette,
    toggleTheme,
  };
}
