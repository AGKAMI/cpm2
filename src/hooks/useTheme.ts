"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_PALETTE, isPaletteId, type PaletteId, type ThemeMode } from "@/lib/themes";

export type ThemeName = ThemeMode;

type ThemeState = {
  mode: ThemeMode;
  palette: PaletteId;
};

const MODE_KEY = "cpm2:theme:v2";
const PALETTE_KEY = "cpm2:palette:v1";
const SERVER_STATE: ThemeState = { mode: "night", palette: DEFAULT_PALETTE };
const listeners = new Set<() => void>();
let cached: ThemeState | null = null;

function readState(): ThemeState {
  if (typeof window === "undefined") return SERVER_STATE;
  const mode: ThemeMode = window.localStorage.getItem(MODE_KEY) === "paper" ? "paper" : "night";
  const storedPalette = window.localStorage.getItem(PALETTE_KEY);
  const palette = isPaletteId(storedPalette) ? storedPalette : DEFAULT_PALETTE;
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
  const state = useSyncExternalStore(subscribe, readState, () => SERVER_STATE);

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
