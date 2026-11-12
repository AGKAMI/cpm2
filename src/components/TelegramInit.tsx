"use client";

import { useEffect } from "react";

/**
 * Loads the Telegram Web App SDK async after hydration — never blocks HTML parse.
 * Also sets touch-action: manipulation on the document root.
 * Calls WebApp.ready() and WebApp.expand() so the Mini App fills the screen
 * instead of staying collapsed in a small bubble.
 */
export function TelegramInit() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = () => {
      const twa = window.Telegram?.WebApp;
      if (twa) {
        try {
          twa.ready?.();
          twa.expand?.();
          // Match Telegram header color to VANTA Garage theme
          try {
            twa.setHeaderColor?.("#0a0a0a");
            twa.setBackgroundColor?.("#0a0a0a");
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
      }
    };
    document.head.appendChild(script);
    return () => {
      try {
        document.head.removeChild(script);
      } catch {
        // already removed
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.touchAction = "manipulation";
    if (document.body) {
      document.body.style.touchAction = "manipulation";
    }
  }, []);

  return null;
}
