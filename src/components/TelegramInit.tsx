"use client";

import { useEffect } from "react";

/**
 * Loads the Telegram Web App SDK async after hydration — never blocks HTML parse.
 * Also sets touch-action: manipulation on the document root.
 */
export function TelegramInit() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
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
