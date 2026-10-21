"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemeName = "paper" | "night";

const KEY = "cpm2:theme";
const listeners = new Set<() => void>();

function readTheme(): ThemeName {
  if (typeof window === "undefined") return "paper";
  return window.localStorage.getItem(KEY) === "night" ? "night" : "paper";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writeTheme(next: ThemeName) {
  window.localStorage.setItem(KEY, next);
  document.documentElement.setAttribute("data-theme", next);
  for (const listener of listeners) listener();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "paper" as ThemeName);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    writeTheme(theme === "night" ? "paper" : "night");
  }, [theme]);

  return { theme, toggleTheme, setTheme: writeTheme };
}
