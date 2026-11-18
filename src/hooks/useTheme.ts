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

const MODE_KEY = "cpm2:theme:v2";
const PALETTE_KEY = "cpm2:palette:v1";
const SERVER_VANTA: ThemeState = { mode: "night", palette: DEFAULT_PALETTE };
const SERVER_NEON: ThemeState = { mode: "night", palette: FLEET_DEFAULT_PALETTE };
const listeners = new Set<() => void>();
let cached: ThemeState | null = null;

/** Fallback palette for the route on screen: /store keeps the house VANTA
 *  identity, Fleet Ledger opens in Neon 2 TONE. Every useTheme() render
 *  refreshes this so module-level readers (readState/write) agree with the
 *  mounted route; a stored user choice always wins over either fallback. */
let routeFallback: PaletteId = FLEET_DEFAULT_PALETTE;

function fallbackFor(pathname: string | null): PaletteId {
  return pathname?.startsWith("/store") ? DEFAULT_PALETTE : FLEET_DEFAULT_PALETTE;
}

function serverStateFor(fallback: PaletteId): ThemeState {
  return fallback === DEFAULT_PALETTE ? SERVER_VANTA : SERVER_NEON;
}

function readState(): ThemeState {
  if (typeof window === "undefined") return serverStateFor(routeFallback);
  const mode: ThemeMode = window.localStorage.getItem(MODE_KEY) === "paper" ? "paper" : "night";
  const storedPalette = window.localStorage.getItem(PALETTE_KEY);
  const palette = isPaletteId(storedPalette) ? storedPalette : routeFallback;
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

function write(next: ThemeState) {
  window.localStorage.setItem(MODE_KEY, next.mode);
  window.localStorage.setItem(PALETTE_KEY, next.palette);
  cached = next;
  apply(next);
  for (const listener of listeners) listener();
}

export function useTheme() {
  const pathname = usePathname();
  const fallback = fallbackFor(pathname);
  if (routeFallback !== fallback) routeFallback = fallback;

  const state = useSyncExternalStore(subscribe, readState, () => serverStateFor(fallback));

  useEffect(() => {
    apply(state);
  }, [state]);

  useEffect(() => {
    const onStorage = () => {
      cached = null;
      for (const listener of listeners) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    write({ ...readState(), mode });
  }, []);

  const setPalette = useCallback((palette: PaletteId) => {
    write({ ...readState(), palette });
  }, []);

  const toggleTheme = useCallback(() => {
    const current = readState();
    write({ ...current, mode: current.mode === "night" ? "paper" : "night" });
  }, []);

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
