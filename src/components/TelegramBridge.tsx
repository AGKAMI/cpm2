"use client";

import { useEffect } from "react";

/**
 * Adapts the console to a Telegram Mini App whenever it is opened from a bot,
 * and silently no-ops in a normal browser:
 *
 * - ready()/expand() drop Telegram's loading placeholder and go full height
 * - the webview header/background track the app's OWN paper colour, so the
 *   Telegram frame blends instead of showing the default grey strip — and
 *   repaints when the theme menu flips paper/night or the palette
 */
export function TelegramBridge() {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    let observer: MutationObserver | null = null;
    let frame = 0;

    const paint = () => {
      // --color-paper is the themed root colour (dark by default, the daylight
      // variant under [data-theme="paper"]). Read the resolved value, never a
      // hard-coded hex, so the frame follows whatever palette is active.
      const color = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--color-paper")
        .trim();
      if (!/^#[0-9a-f]{6}$/i.test(color)) return;
      try {
        webApp.setHeaderColor?.(color);
        webApp.setBackgroundColor?.(color);
        webApp.setBottomBarColor?.(color);
      } catch {
        // Older Telegram clients without these methods — cosmetic only.
      }
    };

    try {
      webApp.ready();
      webApp.expand();
      paint();

      observer = new MutationObserver(() => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(paint);
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "data-palette"],
      });
    } catch {
      // Telegram clients older than Bot API 6.1 — nothing to adapt.
    }

    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
